import { Link } from 'react-router-dom'
import LandingNav from '../components/LandingNav'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: February 7, 2026 | Version 1.0</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By creating an account or using Costra ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms constitute a legally binding agreement between you and Costra.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 leading-relaxed">
              Costra is a multi-cloud cost management platform that allows you to connect cloud provider accounts (AWS, Azure, GCP, and others), view and analyze cloud spending data, set budgets, receive alerts, and generate cost reports. The Service includes AI-powered cost analysis features and multi-currency support.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Account Registration</h2>
            <p className="text-gray-700 leading-relaxed">
              You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to use the Service. You must notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Subscription Plans and Payment</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>Costra offers a 7-day free trial followed by paid subscription plans (Starter and Pro). All payments are processed by <strong>Dodo Payments</strong>, who acts as the Merchant of Record for all transactions.</p>
              <p><strong>Pricing:</strong> Prices are displayed in USD and INR. Applicable taxes (VAT, GST, sales tax) are calculated and collected by Dodo Payments based on your location.</p>
              <p><strong>Billing:</strong> Subscriptions are billed monthly or annually, depending on your chosen plan. Your subscription will automatically renew unless cancelled before the renewal date.</p>
              <p><strong>Free Trial:</strong> The 7-day free trial provides access to core features. No credit card is required to start a trial.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Cancellation and Refund Policy</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p><strong>Cancellation:</strong> You may cancel your subscription at any time through the billing settings. Your access will continue until the end of the current billing period.</p>
              <p><strong>EU Right of Withdrawal:</strong> If you are an EU consumer, you have the right to withdraw from a purchase within 14 days without giving any reason. To exercise this right, contact us at support@costra.dev. Refunds under the right of withdrawal will be processed through Dodo Payments.</p>
              <p><strong>Refunds:</strong> Refund requests outside the EU withdrawal period will be evaluated on a case-by-case basis. Contact support@costra.dev for assistance.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Acceptable Use</h2>
            <p className="text-gray-700 leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Use the Service to store or transmit malicious code</li>
              <li>Resell, sublicense, or redistribute the Service without our written consent</li>
              <li>Use automated means to access the Service beyond normal API usage</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Cloud Provider Credentials</h2>
            <p className="text-gray-700 leading-relaxed">
              You are responsible for the cloud provider credentials you connect to Costra. We recommend using read-only, least-privilege IAM roles. We encrypt all credentials using AES-256-GCM and do not access your cloud resources beyond what is necessary to retrieve cost and usage data. You may disconnect your cloud providers and revoke credentials at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. AI Features</h2>
            <p className="text-gray-700 leading-relaxed">
              Costra offers AI-powered cost analysis features. When you use these features, aggregated cost data (not personal information) may be sent to our AI provider (Anthropic) for analysis. AI-generated insights are provided for informational purposes only and should not be considered financial advice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Data Protection</h2>
            <p className="text-gray-700 leading-relaxed">
              Your use of the Service is also governed by our <Link to="/privacy" className="text-accent-700 hover:underline font-medium">Privacy Policy</Link>, which describes how we collect, use, and protect your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              To the maximum extent permitted by law, Costra shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities arising from your use of the Service. Our total liability for any claims related to the Service shall not exceed the amount you have paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Service Availability</h2>
            <p className="text-gray-700 leading-relaxed">
              We strive to maintain high availability but do not guarantee uninterrupted access to the Service. We may perform scheduled maintenance, and third-party cloud provider APIs may experience downtime beyond our control. We are not liable for any losses resulting from service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              The Service, including its design, features, and content, is owned by Costra and protected by intellectual property laws. Your subscription grants you a limited, non-exclusive, non-transferable license to use the Service for its intended purpose.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We may suspend or terminate your account if you violate these Terms. Upon termination, your right to use the Service ceases immediately. You may export your data before termination using the data export feature. Data will be deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may modify these Terms from time to time. We will notify you of material changes via email or in-app notification at least 30 days before the changes take effect. Continued use of the Service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by applicable laws based on your jurisdiction. For EU users, EU consumer protection laws apply. For Indian users, Indian laws including the DPDPA apply. Any disputes shall be resolved through good-faith negotiation first, and if necessary, through the courts of the applicable jurisdiction.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-8">
            <p className="text-gray-600">
              For any questions about these Terms, please contact us at <strong>support@costra.dev</strong>.
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
          <p className="text-center text-xs text-gray-500 mt-4">
            A product of{' '}
            <a href="https://indraopstech.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">Indraops Technologies</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
