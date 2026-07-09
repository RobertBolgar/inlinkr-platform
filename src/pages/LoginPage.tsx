import { SignIn } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { savePendingRedirect, getPendingRedirect, clearPendingRedirect } from '../lib/pending-redirect';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirectUrl');
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  // Store redirectUrl in sessionStorage when present
  // If redirectUrl is explicitly /dashboard, clear any existing pending redirect (e.g., checkout intent)
  useEffect(() => {
    if (redirectUrl) {
      if (redirectUrl === '/dashboard') {
        // Clear any pending checkout intent since user explicitly wants to go to dashboard
        clearPendingRedirect();
        // Don't save /dashboard since it's the default anyway (Clerk fallback)
      } else {
        savePendingRedirect(redirectUrl);
      }
    }
  }, [redirectUrl]);

  // Navigate to pending redirect after successful auth
  useEffect(() => {
    if (isSignedIn) {
      const pending = getPendingRedirect();
      if (pending) {
        clearPendingRedirect();
        navigate(pending, { replace: true });
      }
    }
  }, [isSignedIn, navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 overflow-x-hidden">
      <div className="w-full max-w-md overflow-x-hidden">
        <SignIn 
          routing="path" 
          path="/login"
          signUpUrl={redirectUrl ? `/signup?redirectUrl=${encodeURIComponent(redirectUrl)}` : '/signup'}
          forceRedirectUrl={redirectUrl || undefined}
          fallbackRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-gray-900 border border-gray-800 shadow-xl',
              headerTitle: 'text-white text-2xl font-bold',
              headerSubtitle: 'text-gray-400',
              socialButtonsBlock: 'space-y-2',
              socialButtonsBlockButton: 'bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white',
              formFieldLabel: 'text-gray-300',
              formFieldInput: 'bg-gray-950 border border-gray-800 text-white',
              formButton: 'bg-blue-600 hover:bg-blue-700 text-white',
              footerAction: 'text-gray-400',
              footerActionLink: 'text-blue-500 hover:text-blue-400',
            },
          }}
        />
        <p className="text-center text-xs text-gray-500 mt-4">
          New users will create an account automatically
        </p>
      </div>
    </div>
  );
}
