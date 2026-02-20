"""Stripe service — one-time credit purchases, webhooks."""

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

STRIPE_API = "https://api.stripe.com/v1"


class StripeService:
    """Stripe API client for credit-based payments (no subscriptions)."""

    def __init__(self):
        self._settings = get_settings()

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._settings.stripe_secret_key}",
        }

    def _enabled(self) -> bool:
        return bool(self._settings.stripe_secret_key)

    # ─── Customers ───────────────────────────────────────────

    async def create_customer(self, email: str, name: str, user_id: str) -> str | None:
        """Create a Stripe customer. Returns the customer ID."""
        if not self._enabled():
            logger.warning("Stripe not configured")
            return None

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{STRIPE_API}/customers",
                headers=self._headers,
                data={
                    "email": email,
                    "name": name,
                    "metadata[user_id]": user_id,
                },
                timeout=10.0,
            )
            if resp.status_code == 200:
                return resp.json()["id"]
            logger.error("Stripe create_customer error: %s", resp.text)
            return None

    # ─── Chat Plan ($15 lifetime) ─────────────────────────────

    async def create_chat_plan_checkout(
        self, customer_id: str, user_id: str
    ) -> str | None:
        """Create a Stripe Checkout for the $15 lifetime chat plan."""
        if not self._enabled():
            return None

        settings = self._settings
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{STRIPE_API}/checkout/sessions",
                headers=self._headers,
                data={
                    "mode": "payment",
                    "customer": customer_id,
                    "line_items[0][price_data][currency]": "usd",
                    "line_items[0][price_data][unit_amount]": str(settings.chat_plan_price_cents),
                    "line_items[0][price_data][product_data][name]": "FlaskAI Chat — Lifetime Access",
                    "line_items[0][price_data][product_data][description]": "One-time $15 purchase for unlimited text messaging forever",
                    "line_items[0][quantity]": "1",
                    "payment_intent_data[metadata][user_id]": user_id,
                    "payment_intent_data[metadata][purchase_type]": "chat_plan",
                    "metadata[user_id]": user_id,
                    "metadata[purchase_type]": "chat_plan",
                    "success_url": f"{settings.frontend_url}/dashboard?chat_plan=success",
                    "cancel_url": f"{settings.frontend_url}/dashboard?chat_plan=canceled",
                },
                timeout=15.0,
            )
            if resp.status_code == 200:
                return resp.json().get("url")
            logger.error("Stripe chat plan checkout error: %s", resp.text)
            return None

    # ─── Credit Checkout (one-time payment) ───────────────────

    async def create_credit_checkout(
        self, customer_id: str, amount_cents: int, user_id: str
    ) -> str | None:
        """
        Create a Stripe Checkout session for a one-time credit purchase.
        amount_cents: minimum 100 ($1.00).
        Returns the session URL.
        """
        if not self._enabled():
            return None

        if amount_cents < 100:
            logger.error("Credit purchase below minimum: %d cents", amount_cents)
            return None

        settings = self._settings
        # Build dollar string for display (e.g. "$5.00")
        amount_display = f"${amount_cents / 100:.2f}"

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{STRIPE_API}/checkout/sessions",
                headers=self._headers,
                data={
                    "mode": "payment",
                    "customer": customer_id,
                    "line_items[0][price_data][currency]": "usd",
                    "line_items[0][price_data][unit_amount]": str(amount_cents),
                    "line_items[0][price_data][product_data][name]": f"FlaskAI Credits — {amount_display}",
                    "line_items[0][price_data][product_data][description]": "Pay-as-you-go credits for translation, STT, and TTS services",
                    "line_items[0][quantity]": "1",
                    "payment_intent_data[metadata][user_id]": user_id,
                    "payment_intent_data[metadata][purchase_type]": "credits",
                    "payment_intent_data[metadata][credit_cents]": str(amount_cents),
                    "metadata[user_id]": user_id,
                    "metadata[purchase_type]": "credits",
                    "metadata[credit_cents]": str(amount_cents),
                    "success_url": f"{settings.frontend_url}/dashboard?credits=success&amount={amount_cents}",
                    "cancel_url": f"{settings.frontend_url}/dashboard?credits=canceled",
                },
                timeout=15.0,
            )
            if resp.status_code == 200:
                return resp.json().get("url")
            logger.error("Stripe checkout error: %s", resp.text)
            return None

    # ─── Webhook Verification ────────────────────────────────

    def verify_webhook(self, payload: bytes, sig_header: str) -> dict | None:
        """
        Verify a Stripe webhook signature and return the event.
        Uses HMAC-SHA256 verification.
        """
        import hashlib
        import hmac
        import time

        secret = self._settings.stripe_webhook_secret
        if not secret:
            logger.warning("No Stripe webhook secret configured")
            return None

        try:
            # Parse the Stripe-Signature header
            elements = dict(
                item.split("=", 1) for item in sig_header.split(",")
            )
            timestamp = elements.get("t", "")
            signature = elements.get("v1", "")

            # Verify timestamp (replay attack prevention — 5 min tolerance)
            if abs(time.time() - int(timestamp)) > 300:
                logger.warning("Stripe webhook timestamp too old")
                return None

            # Compute expected signature
            signed_payload = f"{timestamp}.{payload.decode()}"
            expected = hmac.new(
                secret.encode(), signed_payload.encode(), hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(expected, signature):
                logger.warning("Stripe webhook signature mismatch")
                return None

            import json
            return json.loads(payload)

        except Exception as e:
            logger.error("Webhook verification error: %s", e)
            return None


# Singleton
stripe_service = StripeService()
