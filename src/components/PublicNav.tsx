import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

export function PublicNav() {
  const { isSignedIn } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link to="/">
          <img src="/tubelinkr.png" alt="TubeLinkr" className="h-6 opacity-80" />
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/pricing" className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors">
            Pricing
          </Link>
          {isSignedIn ? (
            <Link
              to="/dashboard"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                Start Free <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
