import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

const AuthContext = createContext(null);
const PENDING_COMPANY_KEY = 'pendingCompanyName';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // Surfaced to ProtectedRoute so it can show a "finish setup" form
  const [pendingOnboarding, setPendingOnboarding] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      setProfileError(null);
      const me = await api.get('/me');
      setPendingOnboarding(false);
      setProfile(me);
    } catch (err) {
      const pendingCompany = localStorage.getItem(PENDING_COMPANY_KEY);
      if (pendingCompany) {
        try {
          await api.post('/onboarding/company', { companyName: pendingCompany });
          localStorage.removeItem(PENDING_COMPANY_KEY);
          const me = await api.get('/me');
          setPendingOnboarding(false);
          setProfile(me);
          return;
        } catch (onboardErr) {
          // Onboarding failed — but keep pendingCompanyName so the user can
          // retry from ProtectedRoute's "complete setup" screen.
          setPendingOnboarding(true);
          setProfile(null);
          setProfileError(onboardErr.message);
          return;
        }
      }
      // No pending company — this user genuinely has no company row yet.
      // Show the "complete setup" form so they can enter a company name.
      setPendingOnboarding(true);
      setProfile(null);
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const completeOnboarding = useCallback(async (companyName) => {
    try {
      await api.post('/onboarding/company', { companyName });
      localStorage.removeItem(PENDING_COMPANY_KEY);
      await loadProfile();
    } catch (err) {
      throw err;
    }
  }, [loadProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadProfile();
    else { setProfile(null); setPendingOnboarding(false); }
  }, [session, loadProfile]);

  const signIn = async (email, password, expectedCompanyName) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return result;

    if (expectedCompanyName && expectedCompanyName.trim()) {
      try {
        const me = await api.get('/me');
        if (me?.company_name && me.company_name.trim().toLowerCase() !== expectedCompanyName.trim().toLowerCase()) {
          await supabase.auth.signOut();
          setProfile(null);
          return {
            error: {
              message: `This user account does not belong to "${expectedCompanyName}".`,
            },
          };
        }
        setProfile(me);
      } catch (err) {
        // If profile loading fails or is pending, let loadProfile handle it
      }
    }
    return result;
  };
  const signOut = () => supabase.auth.signOut();

  const signUpWithCompany = async (companyName, email, password) => {
    localStorage.setItem(PENDING_COMPANY_KEY, companyName);
    const result = await supabase.auth.signUp({ email, password });
    if (result.error) localStorage.removeItem(PENDING_COMPANY_KEY);
    return result;
  };

  const value = {
    session,
    profile,
    profileError,
    profileLoading,
    pendingOnboarding,
    loading: session === undefined,
    signIn,
    signOut,
    signUpWithCompany,
    reloadProfile: loadProfile,
    completeOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const ROLE_RANK = { viewer: 0, manager: 1, accountant: 2, admin: 3 };
export function hasRole(profile, minRole) {
  if (!profile) return false;
  return ROLE_RANK[profile.role] >= ROLE_RANK[minRole];
}
