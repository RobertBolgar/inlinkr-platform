import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/cloudflare';
import { CheckCircle2, XCircle } from 'lucide-react';
import { hasProAccess } from '../lib/plan';

export function SetupUsernamePage() {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Check if user has Pro access
  const userHasProAccess = hasProAccess(user);

  // Pre-fill username from signup if available
  useEffect(() => {
    const pendingUsername = localStorage.getItem('pending_username');
    if (pendingUsername) {
      setUsername(pendingUsername);
      localStorage.removeItem('pending_username');
    }
  }, []);

  const sanitizeUsername = (value: string): string => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (usernameToCheck.length < 3) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    try {
      const result = await db.checkUsernameAvailability(usernameToCheck);
      setIsAvailable(result.available);
    } catch (error) {
      console.error('Error checking username:', error);
      // If database isn't set up yet, assume it's available
      console.warn('Database not available, assuming username is available');
      setIsAvailable(true);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (username.length >= 3) {
        checkUsernameAvailability(username);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeUsername(e.target.value);
    setUsername(sanitized);
    setIsAvailable(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAvailable) {
      setError('This username is not available');
      return;
    }

    if (!user?.clerk_user_id) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/users/username', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, clerk_user_id: user.clerk_user_id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save username');
      }

      await refreshUser();
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Failed to save username');
    } finally {
      setLoading(false);
    }
  };

  // If user doesn't have Pro access, skip username setup and go to dashboard
  useEffect(() => {
    if (user && !userHasProAccess) {
      // Free users keep their auto-generated username
      navigate('/dashboard');
    }
  }, [user, userHasProAccess, navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 overflow-x-hidden">
      <div className="max-w-md w-full space-y-8 overflow-x-hidden">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">Choose your username</h2>
          <p className="mt-2 text-gray-400">
            This will be part of all your public links
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-4">Your links will look like:</div>
          <div className="bg-gray-950 border border-gray-800 rounded px-4 py-3 text-sm text-blue-400 font-mono break-all">
            {window.location.host}/<span className="text-blue-300">{username || 'yourname'}</span>/link-slug
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <div className="relative">
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={handleUsernameChange}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="yourname"
              />
              {username.length >= 3 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isChecking ? (
                    <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                  ) : isAvailable ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Lowercase letters, numbers, and hyphens only. Choose carefully - this becomes part of your public links.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !isAvailable || username.length < 3}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Creating...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
