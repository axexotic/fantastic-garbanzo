"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
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

        <h1 className="mb-2 text-4xl font-bold">Terms of Service</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Last updated: February 19, 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using FlaskAI (&ldquo;VoiceTranslate&rdquo;, &ldquo;the Service&rdquo;),
              you agree to be bound by these Terms of Service. If you do not agree to these terms,
              do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p>
              FlaskAI provides real-time voice and text translation services, including but not
              limited to:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Real-time chat messaging with automatic translation</li>
              <li>Voice and video calls with live translation</li>
              <li>Voice cloning for personalized call translation</li>
              <li>Group chat with multi-language support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. User Accounts</h2>
            <p>
              You must create an account to use certain features. You are responsible for
              maintaining the confidentiality of your account credentials. You agree to:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Provide accurate and complete registration information</li>
              <li>Keep your password secure and confidential</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Accept responsibility for all activity under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Voice Data & Recording</h2>
            <p>
              Our voice cloning feature requires audio samples of your voice. By using this feature:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>You consent to the recording and processing of your voice data</li>
              <li>Your voice data is processed by third-party AI providers (ElevenLabs)</li>
              <li>Voice profiles are stored securely and used only for translation</li>
              <li>You may delete your voice profile at any time from Settings</li>
              <li>You must not upload voice recordings of other people without their consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Impersonate others using voice cloning technology</li>
              <li>Transmit harmful, offensive, or inappropriate content</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use the Service to harass, abuse, or threaten others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Intellectual Property</h2>
            <p>
              The Service, including its original content, features, and functionality, is owned
              by FlaskAI and is protected by international copyright, trademark, and other
              intellectual property laws. You retain ownership of content you create or share
              through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Third-Party Services</h2>
            <p>
              The Service utilizes third-party APIs and services, including but not limited to
              Deepgram (speech-to-text), OpenAI (translation), ElevenLabs (text-to-speech and
              voice cloning), and LiveKit (WebRTC). Your use of the Service is also subject to
              the terms of these providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Payments & Pricing</h2>
            <p className="mb-2">
              FlaskAI offers two payment options, both one-time purchases with no recurring fees:
            </p>
            <ul className="list-disc space-y-1 pl-6 mb-2">
              <li>
                <strong>Lifetime Chat Plan ($15 USD):</strong> A one-time purchase that unlocks
                unlimited text messaging forever. Non-refundable.
              </li>
              <li>
                <strong>Voice & Video Credits ($1 USD minimum):</strong> Pay-as-you-go credits
                consumed during real-time voice and video call translation (speech-to-text,
                translation, and text-to-speech). Credits never expire. Non-refundable.
              </li>
            </ul>
            <p>
              There are no free tiers, trials, or subscription plans. All payments are processed
              by Stripe and subject to their terms of service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind. FlaskAI
              shall not be liable for any indirect, incidental, special, consequential, or punitive
              damages arising from your use of the Service. Translation accuracy is not guaranteed
              and should not be relied upon for critical communications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Termination</h2>
            <p>
              We may terminate or suspend your account at any time for violation of these terms.
              Upon termination, your right to use the Service ceases immediately. You may delete
              your account at any time through Settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Material changes will be
              communicated via email or in-app notification. Continued use of the Service after
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">12. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href="mailto:support@flaskai.xyz" className="text-primary hover:underline">
                support@flaskai.xyz
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
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
