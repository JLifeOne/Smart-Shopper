import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/src/lib/supabase';
import { supabaseEnv } from '@/src/lib/env';
import { ensureCatalogSeeded } from '@/src/catalog';
import { syncService } from '@/src/database/sync-service';
import { ensureBrandBackfillCompleted } from '@/src/database/backfill/brand-backfill';
import { refreshRuntimeConfig } from '@/src/lib/runtime-config';

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
  signupProfileSetupCountryCode: string | null;
  markSignupProfileSetup: (countryCode: string) => void;
  clearSignupProfileSetup: () => void;
  signInWithPassword: (params: { email: string; password: string }) => Promise<AuthActionResult>;
  signUpWithPassword: (params: { email: string; password: string }) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  requestPhoneOtp: (params: { phone: string }) => Promise<AuthActionResult>;
  verifyPhoneOtp: (params: { phone: string; token: string }) => Promise<AuthActionResult>;
  updateProfile: (params: {
    displayName?: string;
    locale?: string;
    currency?: string;
    includeTax?: boolean;
    defaultStoreId?: string | null;
    contactEmail?: string | null;
    dateOfBirth?: string | null;
    gender?: 'male' | 'female' | 'prefer_not_to_say' | null;
    locationCity?: string | null;
    locationCounty?: string | null;
    locationRegion?: string | null;
    locationPostalCode?: string | null;
    locationCountry?: string | null;
  }) => Promise<AuthActionResult>;
  updateAccountEmail: (email: string) => Promise<AuthActionResult>;
  updateAccountPassword: (password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseClient();
  const isMockMode = !supabase && supabaseEnv.enableMockAuth;
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [signupProfileSetupCountryCode, setSignupProfileSetupCountryCode] = useState<string | null>(null);

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

  useEffect(() => {
    syncService.setSession(session);
    if (session) {
      ensureCatalogSeeded().catch((error) => {
        console.warn('Catalog seeding failed', error);
      });
      ensureBrandBackfillCompleted().catch((error) => {
        console.warn('Brand backfill failed', error);
      });
      refreshRuntimeConfig().catch((error) => {
        console.warn('Runtime config refresh failed', error);
      });
    }
  }, [session]);

  const buildErrorResult = useCallback((message: string): AuthActionResult => {
    setLastError(message);
    return { success: false, errorMessage: message };
  }, []);

  const markSignupProfileSetup = useCallback<AuthContextValue['markSignupProfileSetup']>((countryCode) => {
    const normalized = countryCode.trim().toUpperCase();
    setSignupProfileSetupCountryCode(normalized || null);
  }, []);

  const clearSignupProfileSetup = useCallback<AuthContextValue['clearSignupProfileSetup']>(() => {
    setSignupProfileSetupCountryCode(null);
  }, []);

  const signInWithPassword = useCallback<AuthContextValue['signInWithPassword']>(
    async ({ email, password }) => {
      if (!supabase) {
        if (isMockMode) {
          const mockSession = createMockSession(email);
          setSession(mockSession);
          setLastError(null);
          return { success: true };
        }
        return buildErrorResult(
          'Supabase is not configured yet. Update EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
        );
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
      syncService.flushPending().catch((flushError) => {
        console.warn('Sync flush failed', flushError);
      });
      return { success: true };
    },
    [buildErrorResult, isMockMode, supabase]
  );

  const signUpWithPassword = useCallback<AuthContextValue['signUpWithPassword']>(
    async ({ email, password }) => {
      if (!supabase) {
        if (isMockMode) {
          setLastError(null);
          return { success: true };
        }
        return buildErrorResult(
          'Supabase is not configured yet. Update EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
        );
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
      syncService.flushPending().catch((flushError) => {
        console.warn('Sync flush failed', flushError);
      });
      return { success: true };
    },
    [buildErrorResult, isMockMode, supabase]
  );

  const requestPasswordReset = useCallback<AuthContextValue['requestPasswordReset']>(
    async (email) => {
      if (!supabase) {
        if (isMockMode) {
          setLastError(null);
          return { success: true };
        }
        return buildErrorResult(
          'Supabase is not configured yet. Update EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
        );
      }
      setLastError(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        return buildErrorResult(error.message);
      }
      return { success: true };
    },
    [buildErrorResult, isMockMode, supabase]
  );

  const requestPhoneOtp = useCallback<AuthContextValue['requestPhoneOtp']>(
    async ({ phone }) => {
      if (!supabase) {
        return buildErrorResult('Supabase phone auth is not configured. Check environment variables.');
      }
      setIsAuthenticating(true);
      setLastError(null);
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          channel: 'sms'
        }
      });
      setIsAuthenticating(false);
      if (error) {
        return buildErrorResult(error.message);
      }
      return { success: true };
    },
    [buildErrorResult, supabase]
  );

  const verifyPhoneOtp = useCallback<AuthContextValue['verifyPhoneOtp']>(
    async ({ phone, token }) => {
      if (!supabase) {
        return buildErrorResult('Supabase phone auth is not configured. Check environment variables.');
      }
      setIsAuthenticating(true);
      setLastError(null);
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms'
      });
      setIsAuthenticating(false);
      if (error) {
        return buildErrorResult(error.message);
      }
      setSession(data.session ?? null);
      syncService.flushPending().catch((flushError) => {
        console.warn('Sync flush failed', flushError);
      });
      return { success: true };
    },
    [buildErrorResult, supabase]
  );

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(
    async ({
      displayName,
      locale,
      currency,
      includeTax,
      defaultStoreId,
      contactEmail,
      dateOfBirth,
      gender,
      locationCity,
      locationCounty,
      locationRegion,
      locationPostalCode,
      locationCountry
    }) => {
      if (!supabase || !session?.user?.id) {
        return buildErrorResult('User session not ready.');
      }
      const payload: Record<string, unknown> = { id: session.user.id };
      const normalizedPhone = session.user.phone?.trim();
      if (normalizedPhone) {
        payload.phone = normalizedPhone;
      }
      if (contactEmail !== undefined) {
        payload.email = contactEmail;
      }
      if (displayName !== undefined) {
        payload.display_name = displayName;
      }
      if (locale !== undefined) {
        payload.locale = locale;
      }
      if (currency !== undefined) {
        payload.currency = currency;
      }
      if (includeTax !== undefined) {
        payload.include_tax = includeTax;
      }
      if (defaultStoreId !== undefined) {
        payload.default_store_id = defaultStoreId;
      }
      if (dateOfBirth !== undefined) {
        payload.date_of_birth = dateOfBirth;
      }
      if (gender !== undefined) {
        payload.gender = gender;
      }
      if (locationCity !== undefined) {
        payload.location_city = locationCity;
      }
      if (locationCounty !== undefined) {
        payload.location_county = locationCounty;
      }
      if (locationRegion !== undefined) {
        payload.location_region = locationRegion;
      }
      if (locationPostalCode !== undefined) {
        payload.location_postal_code = locationPostalCode;
      }
      if (locationCountry !== undefined) {
        payload.location_country = locationCountry;
      }
      const { error } = await supabase.from('profiles').upsert(payload as never).select('id').single();
      if (error) {
        return buildErrorResult(error.message);
      }
      return { success: true };
    },
    [buildErrorResult, session, supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      setSession(null);
      setSignupProfileSetupCountryCode(null);
      await syncService.reset();
      return null;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLastError(error.message);
      return error.message;
    }
    setSession(null);
    setSignupProfileSetupCountryCode(null);
    await syncService.reset();
    return null;
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

  const updateAccountEmail = useCallback<AuthContextValue['updateAccountEmail']>(
    async (email) => {
      if (!supabase) {
        return buildErrorResult('Supabase is not configured yet.');
      }
      if (!session) {
        return buildErrorResult('User session not ready.');
      }

      setIsAuthenticating(true);
      setLastError(null);
      const { error } = await supabase.auth.updateUser({ email });
      setIsAuthenticating(false);

      if (error) {
        return buildErrorResult(error.message);
      }

      await refreshSession();
      await updateProfile({ contactEmail: email });
      return { success: true };
    },
    [buildErrorResult, refreshSession, session, supabase, updateProfile]
  );

  const updateAccountPassword = useCallback<AuthContextValue['updateAccountPassword']>(
    async (password) => {
      if (!supabase) {
        return buildErrorResult('Supabase is not configured yet.');
      }
      if (!session) {
        return buildErrorResult('User session not ready.');
      }

      setIsAuthenticating(true);
      setLastError(null);
      const { error } = await supabase.auth.updateUser({ password });
      setIsAuthenticating(false);

      if (error) {
        return buildErrorResult(error.message);
      }

      return { success: true };
    },
    [buildErrorResult, session, supabase]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      client: supabase,
      session,
      user: session?.user ?? null,
      initializing,
      isAuthenticating,
      lastError,
      signupProfileSetupCountryCode,
      markSignupProfileSetup,
      clearSignupProfileSetup,
      signInWithPassword,
      signUpWithPassword,
      requestPasswordReset,
      requestPhoneOtp,
      verifyPhoneOtp,
      updateProfile,
      updateAccountEmail,
      updateAccountPassword,
      signOut,
      refreshSession
    }),
    [
      supabase,
      session,
      initializing,
      isAuthenticating,
      lastError,
      signupProfileSetupCountryCode,
      markSignupProfileSetup,
      clearSignupProfileSetup,
      signInWithPassword,
      signUpWithPassword,
      requestPasswordReset,
      requestPhoneOtp,
      verifyPhoneOtp,
      updateProfile,
      updateAccountEmail,
      updateAccountPassword,
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

function createMockSession(email: string): Session {
  const timestamp = new Date().toISOString();
  const expiresIn = 60 * 60 * 24;
  const user = {
    id: `mock-${email}`,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: timestamp,
    phone: '',
    confirmed_at: timestamp,
    last_sign_in_at: timestamp,
    app_metadata: { provider: 'mock', providers: ['mock'] },
    user_metadata: { mock: true },
    identities: [],
    created_at: timestamp,
    updated_at: timestamp
  } as unknown as User;

  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: 'mock-refresh-token',
    provider_token: null,
    provider_refresh_token: null,
    user
  } as Session;
}
