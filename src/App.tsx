import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { AuthProvider, useAuth as useAppAuth } from './contexts/AuthContext';
import { captureReferralFromUrl, isValidReferralCode } from './lib/referral';
import { hasProAccess } from './lib/plan';
import { useEffect } from 'react';
import { getPendingRedirect, clearPendingRedirect } from './lib/pending-redirect';
import { updateCanonicalTag } from './lib/og-metadata';
import { HomePage } from './pages/HomePage';
import { HomePageB } from './pages/HomePageB';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { SetupUsernamePage } from './pages/SetupUsernamePage';
import { DashboardPage } from './pages/DashboardPage';
import { LinksPage } from './pages/LinksPage';
import { NewLinkPage } from './pages/NewLinkPage';
import { EditLinkPage } from './pages/EditLinkPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { RedirectPage } from './pages/RedirectPage';
import { SettingsPage } from './pages/SettingsPage';
import { HubSettingsPage } from './pages/HubSettingsPage';
import { PlacementsPage } from './pages/PlacementsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { SupportPage } from './pages/SupportPage';
import { UpgradePage } from './pages/UpgradePage';
import { SuccessPage } from './pages/SuccessPage';
import { AdminDevPage } from './pages/AdminDevPage';
import { PublicLinkHubPage } from './pages/PublicLinkHubPage';
import { RewardsPage } from './pages/RewardsPage';
import { PublicProofPage } from './pages/PublicProofPage';
import { ProofsPage } from './pages/ProofsPage';
import { VideoPerformancePage } from './pages/VideoPerformancePage';
import { PricingPage } from './pages/PricingPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { QRCodeTrackingPage } from './pages/QRCodeTrackingPage';

function StaticImage() {
  const location = useLocation();
  const imagePath = location.pathname;
  // Redirect to the actual static file by letting the browser handle it
  window.location.href = imagePath;
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAppAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AuthRedirectHandler() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isSignedIn) {
      const pending = getPendingRedirect();
      
      // Only redirect if we're on a path that should trigger the redirect
      // This prevents redirecting when a logged-in user visits /pricing directly
      const shouldRedirect = 
        location.pathname === '/dashboard' ||
        location.pathname === '/login' ||
        location.pathname === '/signup' ||
        location.pathname === '/';
      
      if (pending && shouldRedirect) {
        clearPendingRedirect();
        navigate(pending, { replace: true });
      }
    }
  }, [isSignedIn, navigate, location.pathname]);

  return null;
}

function UsernameSetupRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAppAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Free users can proceed with auto-generated username
  // Only Pro users need to confirm/set their custom username
  const userHasProAccess = hasProAccess(user);
  if (!user.username && userHasProAccess) {
    return <Navigate to="/setup-username" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();

  // Update canonical tag on route change
  useEffect(() => {
    updateCanonicalTag(location.pathname);
  }, [location.pathname]);

  // Detect branded subdomains
  const isBrandedSubdomain = () => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return (
      hostname.endsWith(".tubelinkr.com") &&
      hostname !== "tubelinkr.com" &&
      hostname !== "www.tubelinkr.com" &&
      hostname !== "go.tubelinkr.com" &&
      hostname !== "pro-dev.tubelinkr.com" &&
      hostname !== "free-dev.tubelinkr.com"
    );
  };

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          isBrandedSubdomain() ? <PublicLinkHubPage /> : <HomePage />
        } 
      />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/qr-code-tracking" element={<QRCodeTrackingPage />} />
      <Route 
        path="/login" 
        element={
          <>
            <SignedIn>
              <Navigate to="/" replace />
            </SignedIn>
            <SignedOut>
              <LoginPage />
            </SignedOut>
          </>
        } 
      />
      <Route 
        path="/signup" 
        element={
          <>
            <SignedIn>
              <Navigate to="/" replace />
            </SignedIn>
            <SignedOut>
              <SignupPage />
            </SignedOut>
          </>
        } 
      />
      <Route 
        path="/login/sso-callback" 
        element={<LoginPage />} 
      />
      <Route 
        path="/signup/sso-callback" 
        element={<SignupPage />} 
      />
      <Route 
        path="/setup-username" 
        element={
          <ProtectedRoute>
            <SetupUsernamePage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <UsernameSetupRoute>
            <DashboardPage />
          </UsernameSetupRoute>
        } 
      />
      <Route 
        path="/links" 
        element={
          <UsernameSetupRoute>
            <LinksPage />
          </UsernameSetupRoute>
        } 
      />
      <Route 
        path="/links/new" 
        element={
          <UsernameSetupRoute>
            <NewLinkPage />
          </UsernameSetupRoute>
        } 
      />
      <Route 
        path="/links/:id/edit" 
        element={
          <UsernameSetupRoute>
            <EditLinkPage />
          </UsernameSetupRoute>
        } 
      />
      <Route
        path="/analytics"
        element={
          <UsernameSetupRoute>
            <AnalyticsPage />
          </UsernameSetupRoute>
        }
      />
      <Route
        path="/video/:videoId"
        element={
          <UsernameSetupRoute>
            <VideoPerformancePage />
          </UsernameSetupRoute>
        }
      />
      <Route
        path="/proofs"
        element={
          <UsernameSetupRoute>
            <ProofsPage />
          </UsernameSetupRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <UsernameSetupRoute>
            <SettingsPage />
          </UsernameSetupRoute>
        }
      />
      <Route
        path="/settings/hub"
        element={
          <UsernameSetupRoute>
            <HubSettingsPage />
          </UsernameSetupRoute>
        }
      />
      <Route
        path="/upgrade"
        element={
          <UsernameSetupRoute>
            <UpgradePage />
          </UsernameSetupRoute>
        }
      />
      <Route path="/success" element={<SuccessPage />} />
      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/links/:linkId/placements"
        element={
          <UsernameSetupRoute>
            <PlacementsPage />
          </UsernameSetupRoute>
        }
      />
      {/* Dev admin page - not linked in navigation */}
      <Route
        path="/admin/dev"
        element={
          <UsernameSetupRoute>
            <AdminDevPage />
          </UsernameSetupRoute>
        }
      />
      {/* Public proof page - shareable proof links */}
      <Route path="/proof/:token" element={<PublicProofPage />} />
      {/* Public link hub page - fallback/debug route */}
      <Route path="/hub/:subdomain" element={<PublicLinkHubPage />} />
      <Route
        path="/rewards"
        element={
          <UsernameSetupRoute>
            <RewardsPage />
          </UsernameSetupRoute>
        }
      />
      {/* Split-test homepage B */}
      <Route path="/b" element={<HomePageB />} />
      {/* Static image assets - must come before catch-all route */}
      <Route path="/tubelinkr-social.png" element={<StaticImage />} />
      <Route path="/tubelinkr-icon.png" element={<StaticImage />} />
      <Route path="/tubelinkr.png" element={<StaticImage />} />
      <Route path="/:username/:slug" element={<RedirectPage />} />
    </Routes>
  );
}

function App() {
  // Capture referral code from URL on app initialization and after Clerk redirects
  useEffect(() => {
    captureReferralFromUrl();
    
    // Also capture referral code from current URL (important after Clerk redirects)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');
      
      if (refCode) {
        // Store immediately to prevent loss
        if (isValidReferralCode(refCode)) {
          localStorage.setItem('tubelinkr_referral_code', refCode.trim());
        }
      }
    }
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen min-h-[100dvh] bg-gray-950">
          <AuthRedirectHandler />
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
