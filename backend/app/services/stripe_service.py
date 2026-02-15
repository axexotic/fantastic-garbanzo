"""Stripe service — subscription management, webhooks."""

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

STRIPE_API = "https://api.stripe.com/v1"


class StripeService:
    """Stripe API client for subscription management."""

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

    # ─── Checkout Session ────────────────────────────────────

    async def create_checkout_session(
        self, customer_id: str, price_id: str, user_id: str
    ) -> str | None:
        """Create a Stripe Checkout session. Returns the session URL."""
        if not self._enabled():
            return None

        settings = self._settings
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{STRIPE_API}/checkout/sessions",
                headers=self._headers,
                data={
                    "mode": "subscription",
                    "customer": customer_id,
                    "line_items[0][price]": price_id,
                    "line_items[0][quantity]": "1",
                    "success_url": f"{settings.frontend_url}/dashboard?subscription=success",
                    "cancel_url": f"{settings.frontend_url}/dashboard?subscription=canceled",
                    "metadata[user_id]": user_id,
                },
                timeout=15.0,
            )
            if resp.status_code == 200:
                return resp.json().get("url")
            logger.error("Stripe checkout error: %s", resp.text)
            return None

    # ─── Customer Portal ─────────────────────────────────────

    async def create_portal_session(self, customer_id: str) -> str | None:
        """Create a Stripe Customer Portal session for managing subscriptions."""
        if not self._enabled():
            return None

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{STRIPE_API}/billing_portal/sessions",
                headers=self._headers,
                data={
                    "customer": customer_id,
                    "return_url": f"{self._settings.frontend_url}/dashboard",
                },
                timeout=10.0,
            )
            if resp.status_code == 200:
                return resp.json().get("url")
            logger.error("Stripe portal error: %s", resp.text)
            return None

    # ─── Subscription Info ───────────────────────────────────

    async def get_subscription(self, subscription_id: str) -> dict | None:
        """Retrieve subscription details from Stripe."""
        if not self._enabled():
            return None

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{STRIPE_API}/subscriptions/{subscription_id}",
                headers=self._headers,
                timeout=10.0,
            )
            if resp.status_code == 200:
                return resp.json()
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
