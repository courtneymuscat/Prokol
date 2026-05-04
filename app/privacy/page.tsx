import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Prokol Health',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <Link href="/" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          ← Prokol Health
        </Link>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: April 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. About this policy</h2>
            <p>
              Prokol Health (ABN 33 972 014 877), trading as Prokol ("we", "us", "our"), operates the Prokol
              platform — a nutrition coaching, food logging, and health tracking application available at
              prokol.io and via mobile app ("the Service"). This Privacy Policy explains how we collect, use,
              disclose, and protect personal information in accordance with the <em>Privacy Act 1988</em> (Cth)
              and the Australian Privacy Principles (APPs).
            </p>
            <p className="mt-3">
              By creating an account or using the Service you consent to the practices described in this policy.
              If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Who we collect information from</h2>
            <p>We collect personal information from:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Individual users</strong> who create an account to track their own nutrition, workouts, and health data.</li>
              <li><strong>Coaches</strong> who use the platform to manage clients, create meal plans, and communicate with clients.</li>
              <li><strong>Coached clients</strong> who are invited to the platform by a coach.</li>
              <li><strong>Organisation administrators</strong> who manage a white-label deployment of the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. What information we collect</h2>
            <p>We collect the following categories of personal information:</p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.1 Account information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email address and password (hashed)</li>
              <li>Name and profile details you choose to provide</li>
              <li>Account type (individual, coach, or coached client)</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.2 Health and nutrition data</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Age, sex, height, body weight, and body composition measurements</li>
              <li>Dietary preferences and restrictions</li>
              <li>Food logs, meals, and macro/calorie targets</li>
              <li>Workout and activity logs</li>
              <li>Menstrual cycle data (if provided)</li>
              <li>Progress photos (if uploaded)</li>
              <li>Check-in responses and goal notes</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.3 Communications</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Messages exchanged between coaches and clients within the platform</li>
              <li>Notes and annotations made by coaches about client progress</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.4 Usage and technical data</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Device type, browser, and operating system</li>
              <li>IP address and approximate location</li>
              <li>Pages visited and features used within the Service</li>
              <li>Log data including errors and timestamps</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.5 Payment data</h3>
            <p>
              Payments are processed by Stripe. We do not store full card numbers. We receive and store
              subscription status, plan type, and Stripe customer/subscription identifiers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. How we use your information</h2>
            <p>We use personal information to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide, operate, and improve the Service</li>
              <li>Calculate nutritional targets, macros, and progress metrics</li>
              <li>Enable coaches to manage and communicate with their clients</li>
              <li>Send transactional emails (account confirmation, password reset, subscription notices)</li>
              <li>Send service-related notifications (trial reminders, coach invites)</li>
              <li>Process subscription payments via Stripe</li>
              <li>Respond to support requests</li>
              <li>Comply with legal obligations</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information or use it for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. How we share your information</h2>
            <p>We share personal information only in the following circumstances:</p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">5.1 With your coach</h3>
            <p>
              If you are a coached client, your food logs, check-ins, progress data, messages, and health
              metrics are visible to your assigned coach(es). You accept this when accepting a coaching invite.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">5.2 Service providers</h3>
            <p>We use the following third-party service providers who process data on our behalf:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Supabase</strong> — database and authentication hosting (data stored in Australian or US-East AWS regions)</li>
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
              <li><strong>Vercel</strong> — application hosting</li>
            </ul>
            <p className="mt-3">
              Each provider is bound by data processing agreements and their own privacy policies.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">5.3 Legal requirements</h3>
            <p>
              We may disclose information where required by law, court order, or government authority, or where
              necessary to protect the rights, property, or safety of Prokol Health, our users, or the public.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">5.4 Business transfers</h3>
            <p>
              In the event of a merger, acquisition, or sale of all or part of our business, user data may be
              transferred. We will notify affected users by email and/or prominent notice on the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Security</h2>
            <p>
              We implement industry-standard security measures including encrypted data transmission (TLS),
              hashed passwords, row-level security on all database tables, and access controls. Health data is
              treated as sensitive information under the APPs.
            </p>
            <p className="mt-3">
              No method of transmission over the internet is completely secure. While we take reasonable steps
              to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Data retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide
              the Service. If you delete your account, we will delete or anonymise your personal information
              within 30 days, except where we are required to retain it for legal or regulatory purposes.
            </p>
            <p className="mt-3">
              Backup copies may persist for up to 90 days before being overwritten.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Your rights</h2>
            <p>Under the Australian Privacy Principles you have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Access</strong> the personal information we hold about you</li>
              <li><strong>Correct</strong> inaccurate or out-of-date information</li>
              <li><strong>Request deletion</strong> of your account and associated data</li>
              <li><strong>Complain</strong> to the Office of the Australian Information Commissioner (OAIC) if you believe we have breached the APPs</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at <a href="mailto:info@prokol.io" className="text-blue-600 hover:underline">info@prokol.io</a>.
              We will respond within 30 days. Account deletion can also be initiated directly from Settings → Account → Delete Account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Cookies and tracking</h2>
            <p>
              We use cookies and similar technologies to maintain your login session and remember your
              preferences. We do not use third-party advertising or tracking cookies. You can disable cookies
              in your browser settings, but this may prevent you from logging in or using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Children</h2>
            <p>
              The Service is not directed to children under 16 years of age. We do not knowingly collect
              personal information from children under 16. If we become aware that a child under 16 has
              provided us with personal information, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by
              email or by prominent notice within the Service at least 14 days before the change takes effect.
              Continued use of the Service after the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Contact us</h2>
            <div className="bg-gray-50 rounded-xl p-5 space-y-1">
              <p className="font-semibold text-gray-900">Prokol Health</p>
              <p>ABN 33 972 014 877</p>
              <p>502 Castlereagh Rd, Agnes Banks NSW 2753, Australia</p>
              <p>
                Email:{' '}
                <a href="mailto:info@prokol.io" className="text-blue-600 hover:underline">
                  info@prokol.io
                </a>
              </p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-100 px-6 py-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Prokol Health (ABN 33 972 014 877) trading as Prokol</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
