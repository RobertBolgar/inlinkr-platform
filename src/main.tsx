import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from './lib/auth/clerk';
import { isDevAuthEnabled, initializeDevAuth } from './lib/auth/dev';
import App from './App.tsx';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

initializeDevAuth();

if (!isDevAuthEnabled && !PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <App />
    </ClerkProvider>
  </StrictMode>
);
