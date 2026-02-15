"""Email notification service — SMTP and SendGrid support."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Send transactional emails via SMTP or SendGrid.

    Uses SendGrid API when SENDGRID_API_KEY is set,
    otherwise falls back to SMTP.
    """

    def __init__(self):
        self._settings = get_settings()

    # ─── Public API ──────────────────────────────────────────

    async def send_friend_request(self, to_email: str, from_name: str) -> bool:
        """Notify user of a new friend request."""
        subject = f"{from_name} sent you a friend request on FlaskAI"
        html = self._render_template(
            "friend_request",
            from_name=from_name,
            action_url=f"{self._settings.frontend_url}/dashboard",
        )
        return await self._send(to_email, subject, html)

    async def send_missed_call(
        self, to_email: str, from_name: str, call_type: str = "voice"
    ) -> bool:
        """Notify user of a missed call."""
        subject = f"Missed {call_type} call from {from_name}"
        html = self._render_template(
            "missed_call",
            from_name=from_name,
            call_type=call_type,
            action_url=f"{self._settings.frontend_url}/dashboard",
        )
        return await self._send(to_email, subject, html)

    async def send_welcome(self, to_email: str, display_name: str) -> bool:
        """Welcome email after signup."""
        subject = f"Welcome to FlaskAI, {display_name}!"
        html = self._render_template(
            "welcome",
            display_name=display_name,
            action_url=f"{self._settings.frontend_url}/dashboard",
        )
        return await self._send(to_email, subject, html)

    async def send_password_reset(self, to_email: str, reset_token: str) -> bool:
        """Password reset link."""
        subject = "Reset your FlaskAI password"
        reset_url = f"{self._settings.frontend_url}/reset-password?token={reset_token}"
        html = self._render_template(
            "password_reset",
            reset_url=reset_url,
        )
        return await self._send(to_email, subject, html)

    # ─── Sending ─────────────────────────────────────────────

    async def _send(self, to_email: str, subject: str, html_body: str) -> bool:
        """Send an email via SendGrid API or SMTP fallback."""
        try:
            if self._settings.sendgrid_api_key:
                return await self._send_sendgrid(to_email, subject, html_body)
            elif self._settings.smtp_host:
                return self._send_smtp(to_email, subject, html_body)
            else:
                logger.warning("No email provider configured. Skipping email to %s", to_email)
                return False
        except Exception as e:
            logger.error("Failed to send email to %s: %s", to_email, e)
            return False

    async def _send_sendgrid(self, to_email: str, subject: str, html_body: str) -> bool:
        """Send via SendGrid v3 API."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {self._settings.sendgrid_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {
                        "email": self._settings.email_from_address,
                        "name": self._settings.email_from_name,
                    },
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_body}],
                },
                timeout=10.0,
            )
            if resp.status_code in (200, 202):
                logger.info("Email sent to %s via SendGrid", to_email)
                return True
            logger.error("SendGrid error %d: %s", resp.status_code, resp.text)
            return False

    def _send_smtp(self, to_email: str, subject: str, html_body: str) -> bool:
        """Send via SMTP (synchronous)."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self._settings.email_from_name} <{self._settings.email_from_address}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(self._settings.smtp_host, self._settings.smtp_port) as server:
            if self._settings.smtp_use_tls:
                server.starttls()
            if self._settings.smtp_username:
                server.login(self._settings.smtp_username, self._settings.smtp_password)
            server.send_message(msg)

        logger.info("Email sent to %s via SMTP", to_email)
        return True

    # ─── Templates ───────────────────────────────────────────

    def _render_template(self, template_name: str, **kwargs) -> str:
        """Render an email template. Inline HTML for now (no Jinja dependency)."""
        templates = {
            "welcome": self._template_welcome,
            "friend_request": self._template_friend_request,
            "missed_call": self._template_missed_call,
            "password_reset": self._template_password_reset,
        }
        renderer = templates.get(template_name, self._template_generic)
        return renderer(**kwargs)

    @staticmethod
    def _base_html(title: str, body: str) -> str:
        return f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>{title}</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                      background: #0a0a0a; color: #e5e5e5; padding: 40px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: #171717;
                      border-radius: 12px; padding: 32px; border: 1px solid #333;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #818cf8; margin: 0;">FlaskAI</h1>
              <p style="color: #666; margin: 4px 0 0;">Real-Time Voice Translation</p>
            </div>
            {body}
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #333;
                        text-align: center; color: #666; font-size: 12px;">
              <p>FlaskAI — Break Language Barriers</p>
            </div>
          </div>
        </body>
        </html>
        """

    def _template_welcome(self, display_name: str = "", action_url: str = "", **kw) -> str:
        body = f"""
        <h2 style="color: #f5f5f5;">Welcome, {display_name}! 🎉</h2>
        <p>Your FlaskAI account is ready. Start connecting with people across languages.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="{action_url}" style="background: #818cf8; color: white; padding: 12px 32px;
             border-radius: 8px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
        </div>
        """
        return self._base_html("Welcome to FlaskAI", body)

    def _template_friend_request(self, from_name: str = "", action_url: str = "", **kw) -> str:
        body = f"""
        <h2 style="color: #f5f5f5;">New Friend Request</h2>
        <p><strong>{from_name}</strong> wants to connect with you on FlaskAI.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="{action_url}" style="background: #818cf8; color: white; padding: 12px 32px;
             border-radius: 8px; text-decoration: none; font-weight: 600;">View Request</a>
        </div>
        """
        return self._base_html("Friend Request", body)

    def _template_missed_call(
        self, from_name: str = "", call_type: str = "voice", action_url: str = "", **kw
    ) -> str:
        body = f"""
        <h2 style="color: #f5f5f5;">Missed {call_type.title()} Call</h2>
        <p>You missed a {call_type} call from <strong>{from_name}</strong>.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="{action_url}" style="background: #818cf8; color: white; padding: 12px 32px;
             border-radius: 8px; text-decoration: none; font-weight: 600;">Call Back</a>
        </div>
        """
        return self._base_html("Missed Call", body)

    def _template_password_reset(self, reset_url: str = "", **kw) -> str:
        body = f"""
        <h2 style="color: #f5f5f5;">Reset Your Password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="{reset_url}" style="background: #818cf8; color: white; padding: 12px 32px;
             border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
        </div>
        <p style="color: #888; font-size: 13px;">If you didn't request this, ignore this email.</p>
        """
        return self._base_html("Password Reset", body)

    def _template_generic(self, **kwargs) -> str:
        body = "<p>" + str(kwargs) + "</p>"
        return self._base_html("FlaskAI Notification", body)


# Singleton
email_service = EmailService()
