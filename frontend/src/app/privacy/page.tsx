"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="mb-2 text-4xl font-bold">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Last updated: February 19, 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>

            <h3 className="mt-4 text-lg font-medium text-foreground">a) Account Information</h3>
            <p>
              When you create an account, we collect your email address, username, display name,
              and preferred language. This information is necessary to provide the Service.
            </p>

            <h3 className="mt-4 text-lg font-medium text-foreground">b) Voice Data</h3>
            <p>
              If you opt in to voice cloning, we collect audio recordings of your voice (minimum
              60 seconds). This data is used to create a personalized voice profile for call
              translation. Your voice data is:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Processed by ElevenLabs for voice cloning</li>
              <li>Stored as a voice profile ID (not raw audio) in our database</li>
              <li>Cached in Redis for performance</li>
              <li>Deletable at any time via your account settings</li>
            </ul>

            <h3 className="mt-4 text-lg font-medium text-foreground">c) Messages & Translations</h3>
            <p>
              We store chat messages and their translations to provide the messaging service.
              Translation logs (source text, translated text, languages, latency) are retained
              for service improvement and debugging.
            </p>

            <h3 className="mt-4 text-lg font-medium text-foreground">d) Call Data</h3>
            <p>
              We store call metadata (participants, duration, type) but do not store call audio
              unless you explicitly enable call recording. Real-time voice translation audio is
              processed in-memory and not persisted.
            </p>

            <h3 className="mt-4 text-lg font-medium text-foreground">e) Usage Data</h3>
            <p>
              We collect standard usage data including IP addresses, browser type, and interaction
              patterns to improve the Service and for security purposes (rate limiting, abuse
              prevention).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process and deliver real-time translations</li>
              <li>Create and manage your voice profile</li>
              <li>Send service-related notifications and security alerts</li>
              <li>Prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Third-Party Data Sharing</h2>
            <p>
              We share data with the following third-party services as necessary to provide the Service:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li><strong>Deepgram:</strong> Audio data for speech-to-text transcription</li>
              <li><strong>OpenAI / Anthropic:</strong> Text for translation processing</li>
              <li><strong>ElevenLabs:</strong> Audio samples for voice cloning and TTS</li>
              <li><strong>LiveKit:</strong> WebRTC signaling for real-time calls</li>
              <li><strong>Stripe:</strong> Payment information for credit purchases</li>
              <li><strong>Sentry:</strong> Error reports (no personally identifiable information)</li>
              <li><strong>AWS S3:</strong> Voice profile storage</li>
            </ul>
            <p className="mt-2">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Data Security</h2>
            <p>We implement security measures including:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>HTTPS/TLS encryption for all data in transit</li>
              <li>HTTP-only secure cookies for authentication tokens</li>
              <li>Bcrypt hashing for passwords</li>
              <li>Redis-backed rate limiting on all API endpoints</li>
              <li>CSRF protection for state-changing operations</li>
              <li>Regular rotation of API keys and secrets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Data Retention</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li><strong>Account data:</strong> Retained while your account is active</li>
              <li><strong>Messages:</strong> Retained while the associated chat exists</li>
              <li><strong>Voice profiles:</strong> Retained until you delete them or your account</li>
              <li><strong>Translation logs:</strong> Retained for 90 days for service improvement</li>
              <li><strong>Call metadata:</strong> Retained for 90 days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update inaccurate personal information</li>
              <li><strong>Deletion:</strong> Delete your account and associated data</li>
              <li><strong>Portability:</strong> Export your data in a standard format</li>
              <li><strong>Objection:</strong> Object to certain processing of your data</li>
              <li><strong>Withdraw consent:</strong> Revoke voice cloning consent at any time</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@flaskai.xyz" className="text-primary hover:underline">
                privacy@flaskai.xyz
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Cookies</h2>
            <p>We use the following cookies:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li><strong>access_token:</strong> HTTP-only authentication cookie (15 min)</li>
              <li><strong>refresh_token:</strong> HTTP-only token refresh cookie (7 days)</li>
              <li><strong>csrf_token:</strong> CSRF protection cookie (7 days)</li>
            </ul>
            <p className="mt-2">
              These are strictly necessary cookies for security and functionality. We do not use
              tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for children under 13. We do not knowingly collect
              personal information from children under 13. If we discover we have collected
              such information, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. International Data Transfers</h2>
            <p>
              Your data may be processed in countries other than your own. Our servers are hosted
              on AWS (ap-southeast-1). Third-party processors may process data in their own
              data centers. We ensure appropriate safeguards are in place.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes via email or in-app notification. Continued use of the Service after changes
              constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Contact Us</h2>
            <p>
              For privacy-related questions or data requests, contact us at:{" "}
              <a href="mailto:privacy@flaskai.xyz" className="text-primary hover:underline">
                privacy@flaskai.xyz
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/" className="text-primary hover:underline">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
