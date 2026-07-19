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
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-x-hidden">
      <nav className="border-b border-border bg-surface/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center min-w-0">
              <Link to="/dashboard" className="text-xl font-bold tracking-tight text-text whitespace-nowrap">
                InLinkr
              </Link>
            </div>
            
            {user && (
              <>
                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center space-x-4">
                  <Link
                    to="/dashboard"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/links"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
                  >
                    Links
                  </Link>
                  <Link
                    to="/links/new"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
                  >
                    New Smart Link
                  </Link>
                  <Link
                    to="/analytics"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
                  >
                    Analytics
                  </Link>
                  <Link
                    to="/proofs"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
                  >
                    My Proofs
                  </Link>
                  <Link
                    to="/settings"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
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
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
                    title="Sign out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Avatar Menu Button */}
                <div className="md:hidden flex items-center">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="relative flex items-center justify-center rounded-full text-text"
                    aria-label="Toggle account menu"
                  >
                    {mobileMenuOpen ? (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated text-text-muted transition-colors hover:text-text">
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
          <div className="animate-ink-enter border-t border-border bg-surface md:hidden">
            <div className="px-4 pt-2 pb-4 space-y-1">
              <Link
                to="/dashboard"
                onClick={handleNavClick}
                className="block rounded-lg px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
              >
                Dashboard
              </Link>
              <Link
                to="/links"
                onClick={handleNavClick}
                className="block rounded-lg px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
              >
                Links
              </Link>
              <Link
                to="/links/new"
                onClick={handleNavClick}
                className="block rounded-lg px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
              >
                New Link
              </Link>
              <Link
                to="/analytics"
                onClick={handleNavClick}
                className="block rounded-lg px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
              >
                Analytics
              </Link>
              <Link
                to="/proofs"
                onClick={handleNavClick}
                className="block rounded-lg px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
              >
                My Proofs
              </Link>
              <Link
                to="/settings"
                onClick={handleNavClick}
                className="block rounded-lg px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
              >
                Your Profile
              </Link>
              
              <div className="mt-4 border-t border-border pt-4">
                <div className="px-3 py-2 text-text-muted">
                  @{user.username}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center rounded-lg px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
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
      <footer className={`mt-auto border-t border-border bg-surface ${user ? 'hidden md:block' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-text-muted">
              © {new Date().getFullYear()} InLinkr
            </div>
            <div className="flex items-center gap-6">
              <Link
                to="/privacy"
                className="text-sm text-text-muted transition-colors hover:text-text"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-sm text-text-muted transition-colors hover:text-text"
              >
                Terms of Service
              </Link>
              <Link
                to="/support"
                className="text-sm text-text-muted transition-colors hover:text-text"
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
