import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { config } from '../lib/config/frontend';

export function RedirectPage() {
  const { username, slug } = useParams<{ username: string; slug: string }>();

  useEffect(() => {
    if (!username || !slug) {
      return;
    }

    // Preserve query string and hash
    const queryString = window.location.search;
    const hash = window.location.hash;

    // Redirect to development redirect worker which handles the actual redirect logic
    const targetUrl = `${config.redirectBaseUrl}/${username}/${slug}${queryString}${hash}`;
    window.location.href = targetUrl;
  }, [username, slug]);

  if (!username || !slug) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 overflow-x-hidden">
        <div className="text-center max-w-md overflow-x-hidden">
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4">404</h1>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-300 mb-4">Link not found</h2>
          <p className="text-gray-400 mb-8">
            This link doesn't exist or has been deactivated.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Go to TubeLinkr
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center overflow-x-hidden">
      <div className="text-gray-400">Redirecting...</div>
    </div>
  );
}
