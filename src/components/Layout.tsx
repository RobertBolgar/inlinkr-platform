import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth as useClerkAuth, useUser as useClerkUser } from '../lib/auth/clerk';
import { useAuth } from '../contexts/AuthContext';
import { getDisplayAvatar } from '../lib/avatar';
import { LogOut, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get display avatar using centralized logic
  const displayAvatarUrl = getDisplayAvatar(user, clerkUser?.imageUrl);

  const handleSignOut = async () => {
    await clerkSignOut();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-950 overflow-x-hidden">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center min-w-0">
              <Link to="/dashboard" className="text-xl font-bold text-white whitespace-nowrap">
                TubeLinkr
              </Link>
            </div>
            
            {user && (
              <>
                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center space-x-4">
                  <Link
                    to="/dashboard"
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/links"
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Links
                  </Link>
                  <Link
                    to="/links/new"
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    New Smart Link
                  </Link>
                  <Link
                    to="/analytics"
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Analytics
                  </Link>
                  <Link
                    to="/proofs"
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    My Proofs
                  </Link>
                  <Link
                    to="/settings"
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Your Profile
                  </Link>
                  
                  <div className="flex items-center gap-2">
                    <Avatar
                      user={{
                        avatarUrl: displayAvatarUrl || undefined,
                        firstName: clerkUser?.firstName || undefined,
                        lastName: clerkUser?.lastName || undefined,
                        username: user?.username,
                        displayName: user?.display_name,
                        email: user?.email
                      }}
                      size="sm"
                    />
                    <span className="text-sm text-gray-300">@{user.username}</span>
                  </div>
                  
                  <button
                    onClick={handleSignOut}
                    className="text-gray-300 hover:text-white p-2 rounded-md"
                    title="Sign out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Avatar Menu Button */}
                <div className="md:hidden flex items-center">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="relative flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    aria-label="Toggle account menu"
                  >
                    {mobileMenuOpen ? (
                      <div className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 text-gray-300 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                      </div>
                    ) : (
                      <Avatar
                        user={{
                          avatarUrl: displayAvatarUrl || undefined,
                          firstName: clerkUser?.firstName || undefined,
                          lastName: clerkUser?.lastName || undefined,
                          username: user?.username,
                          displayName: user?.display_name,
                          email: user?.email
                        }}
                        size="md"
                      />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {user && mobileMenuOpen && (
          <div className="md:hidden bg-gray-900 border-t border-gray-800">
            <div className="px-4 pt-2 pb-4 space-y-1">
              <Link
                to="/dashboard"
                onClick={handleNavClick}
                className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/links"
                onClick={handleNavClick}
                className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
              >
                Links
              </Link>
              <Link
                to="/links/new"
                onClick={handleNavClick}
                className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
              >
                New Link
              </Link>
              <Link
                to="/analytics"
                onClick={handleNavClick}
                className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
              >
                Analytics
              </Link>
              <Link
                to="/proofs"
                onClick={handleNavClick}
                className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
              >
                My Proofs
              </Link>
              <Link
                to="/settings"
                onClick={handleNavClick}
                className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
              >
                Your Profile
              </Link>
              
              <div className="border-t border-gray-800 pt-4 mt-4">
                <div className="px-3 py-2 text-gray-300">
                  @{user.username}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="overflow-x-hidden pb-16 md:pb-0">{children}</main>

      {/* Footer */}
      <footer className={`bg-gray-900 border-t border-gray-800 mt-auto ${user ? 'hidden md:block' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} TubeLinkr
            </div>
            <div className="flex items-center gap-6">
              <Link
                to="/privacy"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                to="/support"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      {user && <BottomNav />}
    </div>
  );
}
