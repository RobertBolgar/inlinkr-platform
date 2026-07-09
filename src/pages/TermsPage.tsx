import { PublicNav } from '../components/PublicNav';

export function TermsPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-950">
      <PublicNav />

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>
        
        <div className="prose prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Acceptable Use</h2>
            <p className="text-gray-300 mb-3">
              By using TubeLinkr, you agree to use our service for legitimate purposes only. You may not use TubeLinkr to redirect to malicious, illegal, or harmful content. You are responsible for ensuring your links comply with applicable laws and regulations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Account Responsibility</h2>
            <p className="text-gray-300 mb-3">
              You are responsible for maintaining the security of your account and all activities that occur under your account. You must notify us immediately of any unauthorized use of your account or any other breach of security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Link Tracking and Redirects</h2>
            <p className="text-gray-300 mb-3">
              TubeLinkr provides link tracking and redirection services. You acknowledge that we do not control the content of the destination URLs you create. We are not responsible for the content or availability of external websites.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">No Abuse or Spam</h2>
            <p className="text-gray-300 mb-3">
              You may not use TubeLinkr to send spam, distribute malware, or engage in fraudulent activities. We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">YouTube API Services</h2>
            <p className="text-gray-300 mb-3">
              TubeLinkr integrates with YouTube API Services to allow users to connect their YouTube accounts and associate links with YouTube videos for analytics and attribution purposes. By connecting your YouTube account, you agree that your use of those features is also subject to Google's Terms of Service (<a href="https://www.youtube.com/t/terms" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">https://www.youtube.com/t/terms</a>) and Google's Privacy Policy (<a href="https://policies.google.com/privacy" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a>). You may revoke TubeLinkr's access to your Google account at any time through your Google account permissions settings at <a href="https://myaccount.google.com/permissions" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">https://myaccount.google.com/permissions</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Third-Party Services</h2>
            <p className="text-gray-300 mb-3">
              TubeLinkr uses third-party providers including Clerk for authentication and user management, and Cloudflare for hosting and infrastructure. Your use of TubeLinkr is subject to these providers' applicable terms and policies. TubeLinkr is not affiliated with or endorsed by Google or YouTube.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Service Availability</h2>
            <p className="text-gray-300 mb-3">
              We strive to maintain high availability but do not guarantee uninterrupted service. We may experience downtime for maintenance or other reasons. We are not liable for any losses resulting from service interruptions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Limitation of Liability</h2>
            <p className="text-gray-300 mb-3">
              TubeLinkr is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, or consequential damages arising from your use of our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Changes to Terms</h2>
            <p className="text-gray-300 mb-3">
              We may update these terms from time to time. Continued use of our service after changes constitutes acceptance of the updated terms. We will notify users of significant changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Contact Information</h2>
            <p className="text-gray-300 mb-3">
              If you have questions about these terms, please contact us through the support options in your account settings.
            </p>
          </section>

          <section className="mb-8">
            <p className="text-gray-400 text-sm">
              Last updated: May 2026
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
