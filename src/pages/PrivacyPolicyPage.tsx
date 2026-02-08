import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/">
              <Logo height={40} />
            </Link>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium">
                Sign In
              </Link>
              <Link to="/signup" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: February 7, 2026 | Version 1.0</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Costra ("we", "our", "us") is a multi-cloud cost management platform. This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our services. We are committed to compliance with the EU General Data Protection Regulation (GDPR), India's Digital Personal Data Protection Act (DPDPA) 2023, and other applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Data Controller</h2>
            <p className="text-gray-700 leading-relaxed">
              Costra acts as the Data Controller (GDPR) / Data Fiduciary (DPDPA) for personal data processed through our platform. For any privacy-related inquiries, you may contact our Grievance Officer at: <strong>privacy@costra.dev</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Data We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-4">We collect the following categories of personal data:</p>
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">Account Information</h3>
                <p className="text-gray-600 text-sm">Name, email address, and hashed password (or Google OAuth profile data).</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Cloud Provider Connection Data</h3>
                <p className="text-gray-600 text-sm">Encrypted credentials (AWS IAM role ARNs, Azure service principals, etc.) used to retrieve cost data from your cloud accounts. These are encrypted using AES-256-GCM.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Cloud Cost Data</h3>
                <p className="text-gray-600 text-sm">Cost data, usage metrics, resource information, and budget configurations retrieved from your connected cloud provider accounts.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Usage Data</h3>
                <p className="text-gray-600 text-sm">Feature usage, preferences (currency, email notification settings), and interaction data necessary to provide and improve our services.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Payment Data</h3>
                <p className="text-gray-600 text-sm">Subscription and billing data processed through our payment provider (Dodo Payments), who acts as the Merchant of Record. We do not store your credit card or payment instrument details.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Purpose and Legal Basis for Processing</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Purpose</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Legal Basis (GDPR)</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">DPDPA Basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-700">
                  <tr>
                    <td className="px-4 py-3">Providing the cost management service</td>
                    <td className="px-4 py-3">Contract performance (Art. 6(1)(b))</td>
                    <td className="px-4 py-3">Consent (Sec. 6)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Account creation and authentication</td>
                    <td className="px-4 py-3">Contract performance (Art. 6(1)(b))</td>
                    <td className="px-4 py-3">Consent (Sec. 6)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Processing payments and subscriptions</td>
                    <td className="px-4 py-3">Contract performance (Art. 6(1)(b))</td>
                    <td className="px-4 py-3">Consent (Sec. 6)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">AI-powered cost insights</td>
                    <td className="px-4 py-3">Consent (Art. 6(1)(a))</td>
                    <td className="px-4 py-3">Consent (Sec. 6)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Email notifications and alerts</td>
                    <td className="px-4 py-3">Consent (Art. 6(1)(a))</td>
                    <td className="px-4 py-3">Consent (Sec. 6)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Error monitoring and service stability</td>
                    <td className="px-4 py-3">Legitimate interest (Art. 6(1)(f))</td>
                    <td className="px-4 py-3">Legitimate use (Sec. 7)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Third-Party Data Processors</h2>
            <p className="text-gray-700 leading-relaxed mb-4">We share data with the following third-party processors to provide our services:</p>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Processor</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Purpose</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Data Shared</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-700">
                  <tr>
                    <td className="px-4 py-3 font-medium">Dodo Payments</td>
                    <td className="px-4 py-3">Payment processing (MoR)</td>
                    <td className="px-4 py-3">Name, email, payment data</td>
                    <td className="px-4 py-3">Global</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Anthropic (Claude AI)</td>
                    <td className="px-4 py-3">AI-powered cost analysis</td>
                    <td className="px-4 py-3">Aggregated cost data (no PII)</td>
                    <td className="px-4 py-3">United States</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Amazon Web Services</td>
                    <td className="px-4 py-3">Infrastructure hosting</td>
                    <td className="px-4 py-3">All application data</td>
                    <td className="px-4 py-3">United States (us-east-1)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Sentry</td>
                    <td className="px-4 py-3">Error monitoring</td>
                    <td className="px-4 py-3">Error logs, request metadata</td>
                    <td className="px-4 py-3">United States</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">SendGrid</td>
                    <td className="px-4 py-3">Transactional emails</td>
                    <td className="px-4 py-3">Email address, name</td>
                    <td className="px-4 py-3">United States</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Google</td>
                    <td className="px-4 py-3">OAuth authentication</td>
                    <td className="px-4 py-3">OAuth tokens, profile info</td>
                    <td className="px-4 py-3">United States</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. International Data Transfers</h2>
            <p className="text-gray-700 leading-relaxed">
              Your data may be transferred to and processed in the United States and other countries. For transfers from the EU/EEA, we rely on the EU-US Data Privacy Framework certifications of our processors and/or Standard Contractual Clauses (SCCs) as appropriate. For transfers from India, we comply with applicable DPDPA provisions on cross-border data transfer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
            <div className="bg-gray-50 rounded-lg p-6 space-y-3 text-sm text-gray-700">
              <p><strong>Account data:</strong> Retained while your account is active, deleted within 30 days of account deletion request.</p>
              <p><strong>Cloud cost data:</strong> Retained while your account is active (up to 12 months of historical data depending on plan).</p>
              <p><strong>Application logs:</strong> Retained for 14 days, then automatically deleted.</p>
              <p><strong>Consent records:</strong> Retained for the duration of the consent and 3 years after withdrawal for compliance purposes.</p>
              <p><strong>Payment records:</strong> Retained as required by applicable tax and financial regulations (typically 7 years), managed by Dodo Payments.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">Under GDPR and DPDPA, you have the following rights:</p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start space-x-2">
                <span className="font-semibold text-gray-900 min-w-[180px]">Right of Access:</span>
                <span>Request a copy of your personal data (available via Settings &gt; Export Data).</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-semibold text-gray-900 min-w-[180px]">Right to Rectification:</span>
                <span>Correct inaccurate personal data (available via Profile settings).</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-semibold text-gray-900 min-w-[180px]">Right to Erasure:</span>
                <span>Delete your account and all associated data (available via Settings &gt; Delete Account).</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-semibold text-gray-900 min-w-[180px]">Right to Data Portability:</span>
                <span>Export your data in machine-readable JSON format.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-semibold text-gray-900 min-w-[180px]">Right to Withdraw Consent:</span>
                <span>Withdraw consent at any time (available via Settings &gt; Privacy).</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-semibold text-gray-900 min-w-[180px]">Right to Lodge a Complaint:</span>
                <span>Submit a grievance via our in-app grievance form or contact privacy@costra.dev.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies and Tracking</h2>
            <p className="text-gray-700 leading-relaxed">
              We use essential browser storage (localStorage) for authentication tokens, which is strictly necessary for the service to function. We use Sentry for error monitoring, which requires your consent. We do not use advertising cookies or third-party tracking pixels. You can manage your cookie preferences through the cookie consent banner.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your data, including: AES-256-GCM encryption for cloud credentials, bcrypt password hashing, JWT authentication, HTTPS/TLS in transit, parameterized database queries, rate limiting, and security headers (CSP, HSTS, X-Frame-Options).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Children's Data</h2>
            <p className="text-gray-700 leading-relaxed">
              Costra is not intended for use by individuals under the age of 18. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us at privacy@costra.dev.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Grievance Redressal (DPDPA)</h2>
            <p className="text-gray-700 leading-relaxed">
              In accordance with DPDPA Section 13, you may submit grievances regarding the processing of your personal data. Our Grievance Officer will acknowledge your grievance within 48 hours and provide a resolution within 30 days. Contact: <strong>privacy@costra.dev</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or through a notice in our application. Your continued use of the service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-8">
            <p className="text-gray-600">
              For any questions about this Privacy Policy, please contact us at <strong>privacy@costra.dev</strong>.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600 space-y-2 sm:space-y-0">
            <p>&copy; {new Date().getFullYear()} Costra. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link to="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-gray-900">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
