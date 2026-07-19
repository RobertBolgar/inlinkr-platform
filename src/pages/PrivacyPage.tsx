import { PublicNav } from '../components/PublicNav';

export function PrivacyPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-950">
      <PublicNav />

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Information We Collect</h2>
            <p className="text-gray-300 mb-3">
              InLinkr collects information you provide directly, including your email address, username, and profile information when you create an account. We also collect information about the links you create and track, including destination URLs, placement names, associated YouTube videos, and click analytics data.
            </p>
            <p className="text-gray-300 mb-3">
              If you connect your YouTube account, InLinkr may access limited YouTube account and channel information authorized by you through Google OAuth, including channel metadata and video information necessary to support InLinkr features.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">How We Use Your Information</h2>
            <p className="text-gray-300 mb-3">
              We use your information to provide and improve InLinkr services, including creating and managing links, associating links with YouTube videos, tracking click analytics, and providing creator attribution dashboards and analytics.
            </p>
            <p className="text-gray-300 mb-3">
              We do not sell your personal information or Google user data to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Google User Data & YouTube API Services</h2>
            <p className="text-gray-300 mb-3">
              InLinkr uses YouTube API Services to allow users to connect their YouTube accounts and associate creator links with YouTube videos for analytics and attribution purposes.
            </p>
            <p className="text-gray-300 mb-3">
              InLinkr only accesses and uses Google user data that is necessary to provide the application's core functionality. This may include limited YouTube channel and video metadata authorized by the user during the Google OAuth consent process.
            </p>
            <p className="text-gray-300 mb-3">
              InLinkr does not sell Google user data.
            </p>
            <p className="text-gray-300 mb-3">
              InLinkr does not share, transfer, or disclose Google user data to third parties except:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-3 ml-4">
              <li>as necessary to provide the application's core functionality,</li>
              <li>to comply with applicable laws or legal requests,</li>
              <li>or to protect the security, integrity, and operation of the service.</li>
            </ul>
            <p className="text-gray-300 mb-3">
              InLinkr does not use Google user data for advertising purposes.
            </p>
            <p className="text-gray-300 mb-3">
              Users may revoke InLinkr's access to their Google account at any time through their Google account permissions settings at:
            </p>
            <p className="text-gray-300 mb-3">
              <a href="https://myaccount.google.com/permissions" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">https://myaccount.google.com/permissions</a>
            </p>
            <p className="text-gray-300 mb-3">
              InLinkr's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.
            </p>
            <p className="text-gray-300 mb-3">
              Learn more:
            </p>
            <p className="text-gray-300 mb-3">
              <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">https://developers.google.com/terms/api-services-user-data-policy</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Authentication</h2>
            <p className="text-gray-300 mb-3">
              InLinkr uses Clerk for authentication and account management. When you sign in with Google or another provider, we may receive basic profile information such as your name, email address, and profile image from that provider.
            </p>
            <p className="text-gray-300 mb-3">
              InLinkr does not store your Google password and does not have access to your full Google account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Cookies and Sessions</h2>
            <p className="text-gray-300 mb-3">
              We use cookies and session tokens to keep you logged in and maintain your authentication state. Clerk manages authentication cookies on our behalf. We may also use cookies for basic analytics and service functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Analytics and Link Tracking</h2>
            <p className="text-gray-300 mb-3">
              When you create a Smart Link, InLinkr collects click analytics data including:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-3 ml-4">
              <li>click timestamps,</li>
              <li>placement sources (such as YouTube descriptions, pinned comments, bios, or other placements),</li>
              <li>associated YouTube video references,</li>
              <li>and basic browser/device information.</li>
            </ul>
            <p className="text-gray-300 mb-3">
              This data is used solely to provide analytics and attribution reporting for your links and placements.
            </p>
            <p className="text-gray-300 mb-3">
              InLinkr does not collect unnecessary personal information about users who click links.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Third-Party Services</h2>
            <p className="text-gray-300 mb-3">
              InLinkr may use third-party providers including:
            </p>
            <ul className="list-disc list-inside text-gray-300 mb-3 ml-4">
              <li>Clerk for authentication and user management</li>
              <li>Cloudflare for hosting, databases, and infrastructure</li>
              <li>Google YouTube API Services for YouTube integrations</li>
            </ul>
            <p className="text-gray-300 mb-3">
              These providers maintain their own privacy policies and security practices.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Data Retention</h2>
            <p className="text-gray-300 mb-3">
              We retain account data and link analytics information for as long as your account remains active or as necessary to provide the service.
            </p>
            <p className="text-gray-300 mb-3">
              You may request account deletion at any time. Upon deletion, your account and associated personal data will be removed, except where retention is required for legal, security, or operational purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Data Security and Protection</h2>
            <p className="text-gray-300 mb-3">
              InLinkr implements industry-standard security measures to protect your personal information and Google user data from unauthorized access, disclosure, alteration, or destruction.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Encryption in Transit:</strong> All data transmitted between your browser and InLinkr is protected using HTTPS/TLS encryption to ensure secure communication.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Authentication Credentials:</strong> InLinkr uses Clerk, a secure authentication provider, to handle user authentication. Authentication credentials and access tokens are stored securely using industry-standard practices. InLinkr does not store your Google account password.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">OAuth Access Tokens:</strong> OAuth access tokens obtained from Google are stored securely and used only to perform authorized actions on your behalf. Access tokens are handled according to OAuth security best practices and are never exposed to unauthorized parties.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Access Controls:</strong> Access to personal information and Google user data is strictly limited to authorized personnel and systems that require such access to operate the service. We implement role-based access controls and regularly review access permissions.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Cloudflare Security:</strong> InLinkr uses Cloudflare for hosting, databases, and infrastructure. Cloudflare provides security protections including DDoS mitigation, web application firewall (WAF), and secure content delivery network (CDN) services.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Clerk Security:</strong> InLinkr uses Clerk for authentication and user management. Clerk implements security measures including secure session management, multi-factor authentication options, and compliance with industry security standards.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Monitoring and Incident Response:</strong> We monitor our systems for unauthorized access attempts, security incidents, and misuse. In the event of a security incident, we will take reasonable steps to investigate and respond, including notifying affected users if required by law.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Reasonable Safeguards:</strong> We implement reasonable administrative, technical, and organizational safeguards designed to protect the security of your information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>

            <h3 className="text-lg font-semibold text-white mb-3 mt-6">Google User Data Protection</h3>
            <p className="text-gray-300 mb-3">
              InLinkr implements specific protections for Google user data accessed through YouTube API Services:
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">User Consent:</strong> Google user data is only accessed after you provide explicit consent through the Google OAuth authorization process. You control which permissions you grant to InLinkr.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Limited Use:</strong> Google user data is used solely to provide InLinkr functionality, including associating creator links with YouTube videos, displaying channel information, and providing analytics and attribution features.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">No Sale of Data:</strong> InLinkr never sells Google user data to third parties.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">No Advertising Use:</strong> InLinkr does not use Google user data for advertising purposes, including targeted advertising, ad personalization, or building advertising profiles.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Limited Sharing:</strong> Google user data is not shared with third parties except as necessary to operate the service (such as with infrastructure providers like Cloudflare and Clerk under strict data processing agreements) or to comply with applicable laws or legal requests.
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">User Control:</strong> You may revoke InLinkr's access to your Google account at any time through your Google account permissions settings. Revoking access will prevent InLinkr from accessing your Google data going forward. To revoke access, visit:
            </p>
            <p className="text-gray-300 mb-3">
              <a href="https://myaccount.google.com/permissions" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">https://myaccount.google.com/permissions</a>
            </p>
            <p className="text-gray-300 mb-3">
              <strong className="text-white">Data Deletion:</strong> You may request deletion of your Google user data from InLinkr by deleting your account. Upon account deletion, your Google user data will be removed from InLinkr's systems, except where retention is required for legal, security, or operational purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-3">Contact Information</h2>
            <p className="text-gray-300 mb-3">
              If you have questions about this Privacy Policy or how InLinkr handles your data, please contact us through the support options available within the application.
            </p>
          </section>

          <section className="mb-8">
            <p className="text-gray-400 text-sm">
              Last updated: June 2026
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
