import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/src/lib/supabase';

export interface AuthActionResult {
  success: boolean;
  errorMessage?: string;
}

interface AuthContextValue {
  client: ReturnType<typeof getSupabaseClient>;
  session: Session | null;
  user: User | null;
  initializing: boolean;
  isAuthenticating: boolean;
  lastError?: string | null;
  signInWithPassword: (params: { email: string; password: string }) => Promise<AuthActionResult>;
  signUpWithPassword: (params: { email: string; password: string }) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setInitializing(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }
        if (error) {
          setLastError(error.message);
        }
        setSession(data.session ?? null);
        setInitializing(false);
      })
      .catch((error) => {
        if (__DEV__) {
          console.error('Failed to fetch initial Supabase session', error);
        }
        setLastError((error as Error).message);
        setInitializing(false);
      });

    const subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, [supabase]);

  const buildErrorResult = useCallback((message: string): AuthActionResult => {
    setLastError(message);
    return { success: false, errorMessage: message };
  }, []);

  const signInWithPassword = useCallback<AuthContextValue['signInWithPassword']>(
    async ({ email, password }) => {
      if (!supabase) {
        const message =
          'Supabase is not configured yet. Update EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
        return buildErrorResult(message);
      }
      setIsAuthenticating(true);
      setLastError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      setIsAuthenticating(false);
      if (error) {
        return buildErrorResult(error.message);
      }
      setSession(data.session ?? null);
      return { success: true };
    },
    [buildErrorResult, supabase]
  );

  const signUpWithPassword = useCallback<AuthContextValue['signUpWithPassword']>(
    async ({ email, password }) => {
      if (!supabase) {
        const message =
          'Supabase is not configured yet. Update EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
        return buildErrorResult(message);
      }
      setIsAuthenticating(true);
      setLastError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      setIsAuthenticating(false);
      if (error) {
        return buildErrorResult(error.message);
      }
      setSession(data.session ?? null);
      return { success: true };
    },
    [buildErrorResult, supabase]
  );

  const requestPasswordReset = useCallback<AuthContextValue['requestPasswordReset']>(
    async (email) => {
      if (!supabase) {
        const message =
          'Supabase is not configured yet. Update EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
        return buildErrorResult(message);
      }
      setLastError(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        return buildErrorResult(error.message);
      }
      return { success: true };
    },
    [buildErrorResult, supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      setSession(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLastError(error.message);
    } else {
      setSession(null);
    }
  }, [supabase]);

  const refreshSession = useCallback(async () => {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      setLastError(error.message);
    } else {
      setSession(data.session ?? null);
    }
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      client: supabase,
      session,
      user: session?.user ?? null,
      initializing,
      isAuthenticating,
      lastError,
      signInWithPassword,
      signUpWithPassword,
      requestPasswordReset,
      signOut,
      refreshSession
    }),
    [
      supabase,
      session,
      initializing,
      isAuthenticating,
      lastError,
      signInWithPassword,
      signUpWithPassword,
      requestPasswordReset,
      signOut,
      refreshSession
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
