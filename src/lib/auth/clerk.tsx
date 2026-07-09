import { Navigate } from 'react-router-dom';
import {
  ClerkProvider as RealClerkProvider,
  SignIn as RealSignIn,
  SignUp as RealSignUp,
  SignedIn as RealSignedIn,
  SignedOut as RealSignedOut,
  useAuth as realUseAuth,
  useUser as realUseUser,
} from '@clerk/clerk-react';
import { isDevAuthEnabled, DEV_AUTH_TOKEN, DEV_CLERK_USER } from './dev';

export function useAuth() {
  if (isDevAuthEnabled) {
    return {
      isLoaded: true,
      isSignedIn: true,
      userId: 'dev-user',
      sessionId: 'dev-session',
      actor: undefined,
      getToken: () => Promise.resolve(DEV_AUTH_TOKEN),
      signOut: () => Promise.resolve(),
      has: () => true,
      orgId: undefined,
      orgRole: undefined,
      orgPermissions: undefined,
      orgSlug: undefined,
      factorVerificationAge: undefined,
    } as any;
  }
  return realUseAuth();
}

export function useUser() {
  if (isDevAuthEnabled) {
    return { isLoaded: true, isSignedIn: true, user: DEV_CLERK_USER } as any;
  }
  return realUseUser();
}

export function ClerkProvider(props: any) {
  if (isDevAuthEnabled) {
    return <>{props.children}</>;
  }

  if (!props.publishableKey) {
    throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable');
  }

  return <RealClerkProvider {...props} />;
}

export function SignIn(props: any) {
  if (isDevAuthEnabled) {
    return <Navigate to="/dashboard" replace />;
  }
  return <RealSignIn {...props} />;
}

export function SignUp(props: any) {
  if (isDevAuthEnabled) {
    return <Navigate to="/dashboard" replace />;
  }
  return <RealSignUp {...props} />;
}

export function SignedIn({ children, ...rest }: any) {
  if (isDevAuthEnabled) {
    return <>{children}</>;
  }
  return <RealSignedIn {...rest}>{children}</RealSignedIn>;
}

export function SignedOut({ children, ...rest }: any) {
  if (isDevAuthEnabled) {
    return null;
  }
  return <RealSignedOut {...rest}>{children}</RealSignedOut>;
}
