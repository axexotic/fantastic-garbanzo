"""Webhook / third-party integration service — Slack, Teams, generic webhooks."""

import logging
from enum import Enum

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class WebhookProvider(str, Enum):
    SLACK = "slack"
    TEAMS = "teams"
    GENERIC = "generic"


class WebhookService:
    """Dispatch notifications to external services via webhooks."""

    async def send_slack(self, webhook_url: str, text: str, blocks: list | None = None) -> bool:
        """Send a message to a Slack incoming webhook."""
        payload: dict = {"text": text}
        if blocks:
            payload["blocks"] = blocks
        return await self._post(webhook_url, payload)

    async def send_teams(self, webhook_url: str, text: str, title: str = "FlaskAI") -> bool:
        """Send a message to a Microsoft Teams incoming webhook."""
        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "summary": title,
            "themeColor": "818cf8",
            "title": title,
            "sections": [{"activityTitle": title, "text": text}],
        }
        return await self._post(webhook_url, payload)

    async def send_generic(self, webhook_url: str, payload: dict, headers: dict | None = None) -> bool:
        """Send a JSON payload to any webhook URL."""
        return await self._post(webhook_url, payload, extra_headers=headers)

    async def dispatch(
        self,
        provider: WebhookProvider,
        webhook_url: str,
        event_type: str,
        data: dict,
    ) -> bool:
        """Route an event to the right provider."""
        text = f"[{event_type}] {data.get('message', str(data))}"

        if provider == WebhookProvider.SLACK:
            return await self.send_slack(webhook_url, text)
        elif provider == WebhookProvider.TEAMS:
            return await self.send_teams(webhook_url, text, title=event_type)
        else:
            return await self.send_generic(webhook_url, {"event": event_type, "data": data})

    # ─── Internal ───────────────────────────────────────

    @staticmethod
    async def _post(url: str, payload: dict, extra_headers: dict | None = None) -> bool:
        headers = {"Content-Type": "application/json"}
        if extra_headers:
            headers.update(extra_headers)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code < 300:
                    logger.info("Webhook delivered to %s", url[:60])
                    return True
                logger.warning("Webhook %s returned %d: %s", url[:60], resp.status_code, resp.text[:200])
                return False
        except Exception as e:
            logger.error("Webhook delivery failed: %s", e)
            return False


# Singleton
webhook_service = WebhookService()
