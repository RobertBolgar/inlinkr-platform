import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth/clerk';

export function PublicNav() {
  const { isSignedIn } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link to="/">
          <img src="/tubelinkr.png" alt="InLinkr" className="h-6 opacity-80" />
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/pricing" className="hidden text-sm text-text-muted transition-colors hover:text-text sm:block">
            Pricing
          </Link>
          {isSignedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-ink-sm transition-colors hover:bg-primary"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-text-muted transition-colors hover:text-text">
                Sign In
              </Link>
              <Link
                to="/signup"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-ink-sm transition-colors hover:bg-primary"
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
