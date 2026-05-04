import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Prokol Health',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4">
        <Link href="/" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          ← Prokol Health
        </Link>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Terms of Service</h1>
        <p className="text-sm text-gray-500">ABN 33 972 014 877 &nbsp;|&nbsp; Trading as Prokol</p>
        <p className="text-sm text-gray-500 mb-10">Effective date: April 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Agreement to terms</h2>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between you and Prokol Health
              (ABN 33 972 014 877), trading as Prokol ("Prokol", "we", "us", "our"). By accessing or using the Prokol
              platform at www.prokol.io ("Platform"), you agree to be bound by these Terms.
            </p>
            <p className="mt-3">
              If you are using the Platform on behalf of a business or organisation, you represent that you have
              authority to bind that entity to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Description of service</h2>
            <p>
              Prokol is a software-as-a-service (SaaS) nutrition and coaching platform that provides tools for health
              tracking, nutrition monitoring, coaching management, and related wellness services. The Platform is
              available to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Individual users for personal health and nutrition tracking.</li>
              <li>Coaches and nutrition practitioners for client management and coaching delivery.</li>
              <li>Businesses and organisations for team coaching, white-label deployment, and enterprise management.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Accounts and eligibility</h2>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.1 Age requirement</h3>
            <p>
              You must be at least 18 years of age to create an account. By creating an account, you represent that
              you meet this requirement.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.2 Account responsibility</h3>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activity
              that occurs under your account. You must notify us immediately of any unauthorised use of your account.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.3 Accurate information</h3>
            <p>
              You agree to provide accurate, complete, and current information when creating your account and to update
              this information as necessary.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Subscriptions and payment</h2>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">4.1 Subscription plans</h3>
            <p>
              The Platform is offered on a subscription basis. Available plans and current pricing are set out at the
              pricing page on our website. We reserve the right to change pricing with 30 days written notice to
              existing subscribers.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">4.2 Free trials</h3>
            <p>
              Coach plans may include a 14-day free trial. A valid payment method is required to start a trial. If you
              do not cancel before the trial ends, your subscription will automatically commence and your payment method
              will be charged.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">4.3 Billing</h3>
            <p>
              Subscriptions are billed monthly in advance. Seat-based overages (additional clients or coaches beyond
              your plan limits) are calculated and billed at the end of each billing period. All prices are in
              Australian Dollars (AUD) and include GST where applicable.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">4.4 Cancellation</h3>
            <p>
              You may cancel your subscription at any time through your account settings or by contacting us.
              Cancellation takes effect at the end of the current billing period. We do not provide refunds for partial
              periods except where required by Australian Consumer Law.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">4.5 Payment processing</h3>
            <p>
              Payments are processed by Stripe Inc. By providing payment information, you agree to Stripe&apos;s terms of
              service. We do not store your full payment card details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Coach and client relationships</h2>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">5.1 Independent relationship</h3>
            <p>
              Prokol is a technology platform only. We do not provide nutrition advice, health advice, medical advice,
              or coaching services. Coaches using the Platform are independent practitioners and are solely responsible
              for the services they provide to their clients.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">5.2 Coach responsibilities</h3>
            <p>Coaches using the Platform represent and warrant that they:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Hold appropriate qualifications and registrations required to provide their services in their jurisdiction.</li>
              <li>Comply with all applicable laws, regulations, and professional standards.</li>
              <li>Obtain appropriate consent from clients before collecting and using their personal information.</li>
              <li>Maintain appropriate professional indemnity insurance.</li>
            </ul>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">5.3 Client data access</h3>
            <p>
              Coaches can access client data within the Platform as permitted by these Terms and our{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>. Coaches must not
              access client data for any purpose other than providing coaching services to that client.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">5.4 Coached client downgrade</h3>
            <p>
              When a coaching relationship ends (either by the coach removing the client or the client leaving), the
              client&apos;s account will be downgraded to the free individual tier. The client retains access to their own
              historical data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. White-label and organisation terms</h2>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">6.1 Organisation accounts</h3>
            <p>
              Businesses subscribing to organisation or white-label plans ("Organisation Clients") may deploy the
              Platform under their own branding. Organisation Clients are responsible for ensuring their use of the
              Platform complies with all applicable laws.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">6.2 Data controller relationship</h3>
            <p>
              Where an Organisation Client deploys the Platform to their own end users, the Organisation Client acts as
              the data controller and Prokol Health acts as the data processor. A Data Processing Agreement governs
              this relationship.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">6.3 No poaching</h3>
            <p>
              Prokol Health will not use contact information of clients belonging to Organisation Clients to market
              Prokol Health services to those clients. Clients using a white-label deployment will not be redirected to
              or downgraded to the Prokol Health platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Platform for any unlawful purpose or in violation of these Terms.</li>
              <li>Upload or transmit content that is harmful, offensive, defamatory, or infringes third-party rights.</li>
              <li>Attempt to gain unauthorised access to any part of the Platform or other users&apos; accounts.</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Platform.</li>
              <li>Use the Platform to provide services to minors without appropriate parental consent.</li>
              <li>Misrepresent your qualifications or professional credentials.</li>
              <li>Share your account credentials with unauthorised third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Health disclaimer</h2>
            <p>
              The Prokol Platform provides tools for tracking and managing health and nutrition data. The Platform is
              not a medical device and does not provide medical advice, diagnosis, or treatment. Information on the
              Platform should not be relied upon as a substitute for professional medical advice.
            </p>
            <p className="mt-3">
              Always consult a qualified health professional before making significant changes to your diet, exercise,
              or health management. In an emergency, contact emergency services immediately.
            </p>
            <p className="mt-3">
              <strong>Cycle Tracking is not a contraception tool.</strong> Cycle predictions and fertile window
              estimates are based on your logged data and statistical averages. They are not medically accurate and
              should not be used to prevent or plan pregnancy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Intellectual property</h2>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">9.1 Our intellectual property</h3>
            <p>
              The Platform, including all software, design, content, trademarks, and technology, is owned by Prokol
              Health and protected by Australian and international intellectual property laws. Nothing in these Terms
              grants you any ownership rights in the Platform.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">9.2 Your content</h3>
            <p>
              You retain ownership of content you upload to the Platform (such as custom resources, meal plans, and
              exercise videos). By uploading content, you grant us a non-exclusive, royalty-free licence to store,
              display, and process that content as necessary to provide the Platform services.
            </p>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">9.3 Coach content isolation</h3>
            <p>
              Content created by a coach (including custom templates, exercise video links, resources, and programmes)
              is private to that coach and is not shared with other coaches or organisations without explicit action by
              the coach.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Prokol Health&apos;s liability to you for any loss or damage arising
              from your use of the Platform is limited to the amount you paid us in the 12 months preceding the claim.
            </p>
            <p className="mt-3">
              We are not liable for indirect, consequential, incidental, or special damages, including loss of data,
              loss of profits, or loss of business opportunity, even if we have been advised of the possibility of such
              damages.
            </p>
            <p className="mt-3">
              Nothing in these Terms limits our liability for death or personal injury caused by negligence, fraud, or
              any other liability that cannot be excluded by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Australian Consumer Law</h2>
            <p>
              Nothing in these Terms excludes, restricts, or modifies any right or remedy, or any guarantee, warranty,
              or other term or condition, implied or imposed by the Australian Consumer Law that cannot lawfully be
              excluded or limited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Termination</h2>
            <p>
              We may suspend or terminate your account immediately if you breach these Terms, engage in fraudulent
              activity, or use the Platform in a way that harms other users or the Platform.
            </p>
            <p className="mt-3">
              You may terminate your account at any time through your account settings. Termination does not relieve
              you of any payment obligations incurred prior to termination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">13. Governing law</h2>
            <p>
              These Terms are governed by the laws of New South Wales, Australia. You agree to submit to the
              non-exclusive jurisdiction of the courts of New South Wales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">14. Third-party services</h2>
            <p>
              Our platform integrates with third-party services, including YouTube API Services. By using features that
              display or interact with YouTube content, you agree to be bound by the{' '}
              <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                YouTube Terms of Service
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">15. Changes to terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by email at least 14
              days before they take effect. Continued use of the Platform after changes take effect constitutes
              acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">16. Contact</h2>
            <div className="space-y-1">
              <p><strong>Prokol Health</strong> (trading as Prokol)</p>
              <p>ABN: 33 972 014 877</p>
              <p>Address: 502 Castlereagh Rd, Agnes Banks NSW 2753</p>
              <p>Email: <a href="mailto:info@prokol.io" className="text-blue-600 hover:underline">info@prokol.io</a></p>
              <p>Website: <a href="https://www.prokol.io" className="text-blue-600 hover:underline">www.prokol.io</a></p>
            </div>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-100 flex gap-6 text-xs text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <Link href="/health-data" className="hover:text-gray-600">Health Data Processing</Link>
        </div>
      </main>
    </div>
  )
}
