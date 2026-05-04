import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Health Data Processing — Prokol Health',
}

export default function HealthDataPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4">
        <Link href="/" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          ← Prokol Health
        </Link>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Health Data Processing</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: April 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. What is health data?</h2>
            <p>
              Prokol collects and processes health information as defined under the <em>Privacy Act 1988</em> (Cth), including:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Body weight, body composition measurements, and physical measurements</li>
              <li>Food and nutrition logs, including calorie and macronutrient data</li>
              <li>Exercise and training data, including workout logs and performance metrics</li>
              <li>Menstrual cycle data, including period dates, symptoms, basal body temperature (BBT), cervical mucus, and cycle predictions</li>
              <li>Sleep quality, heart rate variability (HRV), resting heart rate, and energy levels</li>
              <li>Check-in responses relating to physical and emotional wellbeing</li>
              <li>Supplement usage and protocol information assigned by coaches</li>
              <li>Progress photographs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Legal basis for processing</h2>
            <p>
              We process health data on the following grounds:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Consent:</strong> You explicitly consent to health data collection when you create an account and use the Service. You may withdraw consent at any time by deleting your account.</li>
              <li><strong>Contract:</strong> Processing is necessary to deliver the coaching and health tracking services you have subscribed to.</li>
              <li><strong>Legitimate interests:</strong> Aggregated, de-identified data may be used to improve platform features and performance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How health data is used</h2>
            <p>Your health data is used to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Display your progress, trends, and insights within the platform</li>
              <li>Allow your coach to review your data and provide personalised coaching</li>
              <li>Generate cycle predictions, phase estimations, and personalised insights</li>
              <li>Send contextual push notifications (e.g. cycle tracking reminders)</li>
              <li>Calculate nutritional targets, TDEE estimates, and training recommendations</li>
            </ul>
            <p className="mt-3">
              Your health data is <strong>never sold to third parties</strong>, used for advertising, or shared with any party other than your assigned coach and the infrastructure providers listed below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Who can access your health data</h2>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">4.1 Your assigned coach</h3>
            <p>
              If you are a coached client, your assigned coach has access to all health data you log within the platform, including cycle data, food logs, weight, check-in responses, progress photos, and workout data. This access is the core purpose of the coaching relationship. You consent to this access when accepting an invitation from your coach.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">4.2 Cycle tracking data</h3>
            <p>
              Menstrual cycle data is treated as sensitive health information. Coaches with nutritionist-level access can view cycle logs within the client file to inform nutrition and training programming. Cycle predictions are statistical estimates based on your logged data and are not clinically validated — see our <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> for the full cycle tracking disclaimer.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">4.3 Infrastructure providers</h3>
            <p>We use the following sub-processors who may process health data as part of delivering the Service:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Supabase</strong> — database and authentication (data stored in AWS Sydney region)</li>
              <li><strong>Vercel</strong> — application hosting and edge functions</li>
              <li><strong>Stripe</strong> — payment processing (does not receive health data)</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
            </ul>
            <p className="mt-3">Each provider is bound by data processing agreements and operates under their own privacy policies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data storage and security</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>All health data is stored in encrypted databases within the AWS Sydney region</li>
              <li>Row-level security (RLS) ensures you can only access your own data</li>
              <li>Progress photos are stored in private, access-controlled cloud storage with signed URLs that expire after 1 hour</li>
              <li>All data in transit is encrypted via TLS 1.2 or higher</li>
              <li>Access to production data is restricted to authorised personnel only</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Data retention and deletion</h2>
            <p>
              Your health data is retained for as long as your account is active. When you delete your account, all personal health data — including food logs, cycle data, check-ins, progress photos, workout records, and coach notes — is permanently deleted within 30 days, except where retention is required by law.
            </p>
            <p className="mt-3">
              Account deletion can be initiated from <strong>Settings → Delete Account</strong> within the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Your rights</h2>
            <p>Under the Australian Privacy Principles, you have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access the health data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent and deactivate your account</li>
              <li>Lodge a complaint with the Office of the Australian Information Commissioner (OAIC)</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:info@prokol.io" className="text-blue-600 hover:underline">info@prokol.io</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Changes to this document</h2>
            <p>
              We may update this Health Data Processing statement from time to time. Material changes will be communicated via email or in-app notification. Continued use of the Service after notification constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Contact</h2>
            <p>
              For questions about how we handle your health data, contact our Privacy Officer:
            </p>
            <div className="mt-3 space-y-1">
              <p><strong>Prokol Health</strong></p>
              <p>ABN 33 972 014 877</p>
              <p>Email: <a href="mailto:info@prokol.io" className="text-blue-600 hover:underline">info@prokol.io</a></p>
            </div>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-gray-100 flex gap-6 text-xs text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
        </div>
      </main>
    </div>
  )
}
