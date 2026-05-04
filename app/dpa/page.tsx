import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Data Processing Agreement — Prokol Health',
}

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4">
        <Link href="/" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          ← Prokol Health
        </Link>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Data Processing Agreement</h1>
        <p className="text-sm text-gray-500">For White-Label and Organisation Clients</p>
        <p className="text-sm text-gray-500">ABN 33 972 014 877 &nbsp;|&nbsp; Trading as Prokol &nbsp;|&nbsp; April 2026</p>
        <p className="text-sm text-gray-500 mb-10">&nbsp;</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Parties and purpose</h2>
            <p>
              This Data Processing Agreement ("DPA") is entered into between Prokol Health (ABN 33 972 014 877),
              trading as Prokol ("Processor", "we", "us") and the Organisation Client identified in the executed
              Services Agreement ("Controller", "you").
            </p>
            <p className="mt-3">
              This DPA governs the processing of personal data by the Processor on behalf of the Controller in
              connection with the delivery of the Prokol platform services under the Services Agreement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Definitions</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>"Personal data"</strong> means any information relating to an identified or identifiable natural person.</li>
              <li><strong>"Processing"</strong> means any operation performed on personal data, including collection, storage, use, disclosure, and deletion.</li>
              <li><strong>"Data subject"</strong> means the individual to whom personal data relates (including the Controller's clients and end users).</li>
              <li><strong>"Sub-processor"</strong> means a third party engaged by the Processor to assist in processing personal data.</li>
              <li><strong>"Services Agreement"</strong> means the commercial agreement between the parties for access to the Platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Roles and responsibilities</h2>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.1 Controller responsibilities</h3>
            <p>
              The Controller is the data controller in respect of personal data collected from its clients and end
              users through the Platform. The Controller is responsible for:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Ensuring it has a lawful basis for collecting and processing personal data.</li>
              <li>Providing appropriate privacy notices to data subjects.</li>
              <li>Obtaining any necessary consents from data subjects.</li>
              <li>Ensuring the Platform is used in compliance with applicable privacy laws including the <em>Privacy Act 1988</em> (Cth) and any other applicable legislation.</li>
              <li>Responding to data subject access requests and complaints.</li>
            </ul>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">3.2 Processor responsibilities</h3>
            <p>
              The Processor will process personal data only on documented instructions from the Controller, which
              includes processing necessary to provide the Platform services. The Processor will:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Process personal data only for the purposes specified in this DPA and the Services Agreement.</li>
              <li>Not disclose personal data to third parties except as permitted by this DPA.</li>
              <li>Implement and maintain appropriate technical and organisational security measures.</li>
              <li>Assist the Controller in responding to data subject requests to the extent technically feasible.</li>
              <li>Notify the Controller without undue delay upon becoming aware of a personal data breach affecting the Controller's data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Data isolation and security</h2>
            <p>
              The Processor maintains strict data isolation between Organisation Clients. The Controller's data is:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Tagged with a unique organisation identifier at the database level.</li>
              <li>Accessible only to coaches and administrators within the Controller's organisation.</li>
              <li>Not accessible to coaches, clients, or administrators in other organisations.</li>
              <li>Protected by row-level security policies enforced at the database engine level.</li>
              <li>Not used by the Processor to contact the Controller's clients for Processor's own marketing purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Types of personal data processed</h2>
            <p>The Processor will process the following categories of personal data on behalf of the Controller:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Identity data:</strong> name, email address, date of birth, phone number.</li>
              <li><strong>Health and fitness data:</strong> nutrition logs, workout records, weight history, progress photos.</li>
              <li><strong>Physiological data:</strong> menstrual cycle data (which are non-clinical estimates), HRV, resting heart rate, sleep data.</li>
              <li><strong>Communication data:</strong> messages between clients and coaches.</li>
              <li>Form and check-in responses submitted by clients.</li>
              <li>Subscription and billing information (processed via Stripe; full card data not stored by Processor).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Sub-processors</h2>
            <p className="mb-3">
              The Processor engages the following sub-processors in the delivery of Platform services:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 border-b border-gray-200">Sub-processor</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 border-b border-gray-200">Purpose</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 border-b border-gray-200">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ['Supabase Inc.', 'Database, auth, storage', 'United States'],
                    ['Vercel Inc.', 'Hosting, deployment', 'United States'],
                    ['Stripe Inc.', 'Payment processing', 'United States'],
                    ['Resend Inc.', 'Transactional email', 'United States'],
                  ].map(([name, purpose, location]) => (
                    <tr key={name}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{purpose}</td>
                      <td className="px-4 py-2.5 text-gray-600">{location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              The Processor will notify the Controller of any intended changes to sub-processors and provide an
              opportunity to object.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. International data transfers</h2>
            <p>
              Sub-processors listed above are located in the United States. The Processor takes reasonable steps to
              ensure these transfers comply with the Australian Privacy Principles, including entering into data
              processing agreements with sub-processors that require equivalent data protection standards.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Data breach notification</h2>
            <p>
              In the event of a personal data breach affecting the Controller's data, the Processor will:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Notify the Controller without undue delay and in any case within 72 hours of becoming aware.</li>
              <li>Provide details of the nature of the breach, categories and approximate number of data subjects affected, likely consequences, and measures taken or proposed.</li>
              <li>Cooperate with the Controller in managing the breach and fulfilling any notification obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Data subject rights</h2>
            <p>
              Where data subjects exercise rights under applicable privacy law (including rights of access, correction,
              and deletion), the Controller is responsible for responding. The Processor will provide reasonable
              assistance to the Controller in fulfilling these obligations, including by providing data exports and
              executing deletions upon written request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Return and deletion of data</h2>
            <p>Upon termination of the Services Agreement, the Processor will:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide the Controller with a complete export of the Controller's data in a machine-readable format within 30 days of a written request.</li>
              <li>Delete or de-identify the Controller's personal data within 90 days of termination, except where retention is required by law.</li>
              <li>Confirm in writing when deletion is complete.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Audit rights</h2>
            <p>
              The Controller may request written confirmation that the Processor is complying with this DPA no more
              than once per calendar year. The Processor will respond within 30 days. Physical audits may be agreed in
              writing and conducted at the Controller's expense with reasonable prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Liability</h2>
            <p>
              Each party's liability under this DPA is subject to the limitations set out in the Services Agreement.
              The Processor is not liable for breaches caused by the Controller's instructions or the Controller's
              failure to comply with its data controller obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">13. Term</h2>
            <p>
              This DPA remains in effect for the duration of the Services Agreement and terminates automatically upon
              termination of the Services Agreement, subject to clauses relating to data return, deletion, and
              survival.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">14. Governing law</h2>
            <p>This DPA is governed by the laws of New South Wales, Australia.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">15. Execution</h2>
            <p>
              This DPA is incorporated into and forms part of the Services Agreement. By executing the Services
              Agreement, the parties agree to be bound by this DPA.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="font-semibold text-gray-800">Signed for and on behalf of Prokol Health:</p>
                <div className="space-y-3 text-sm">
                  <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Name</p><p>Courtney Muscat</p></div>
                  <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Title</p><p>Director, Prokol Health</p></div>
                  <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Signature</p><div className="border-b border-gray-300 mt-6 w-48" /></div>
                  <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Date</p><div className="border-b border-gray-300 mt-6 w-48" /></div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="font-semibold text-gray-800">Signed for and on behalf of the Controller:</p>
                <div className="space-y-3 text-sm">
                  <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Organisation name</p><div className="border-b border-gray-300 mt-6 w-full" /></div>
                  <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Name</p><div className="border-b border-gray-300 mt-6 w-full" /></div>
                  <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Title</p><div className="border-b border-gray-300 mt-6 w-full" /></div>
                  <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Signature</p><div className="border-b border-gray-300 mt-6 w-full" /></div>
                  <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Date</p><div className="border-b border-gray-300 mt-6 w-full" /></div>
                </div>
              </div>
            </div>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-100 flex gap-6 text-xs text-gray-400">
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <Link href="/health-data" className="hover:text-gray-600">Health Data Processing</Link>
        </div>
      </main>
    </div>
  )
}
