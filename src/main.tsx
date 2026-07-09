import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from './lib/auth/clerk';
import { initializeDevAuth } from './lib/auth/dev';
import App from './App.tsx';
import './index.css';

initializeDevAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <App />
    </ClerkProvider>
  </StrictMode>
);
