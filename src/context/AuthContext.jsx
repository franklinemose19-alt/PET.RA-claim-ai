// src/context/AuthContext.jsx
//
// PET.RA Claims AI — Auth Context
//
// Fix: profile creation no longer depends on happening synchronously at
// signup time. If a logged-in user has no matching `profiles` row yet
// (e.g. because email confirmation delayed it, or signup was interrupted),
// fetchProfile now creates a default 'customer' profile on the fly rather
// than throwing a 406 forever. Company/role-specific signups still set
// the correct role explicitly at signup when possible; this is the
// safety net for every case that falls through.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId, userEmail) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, phone, company_id')
      .eq('id', userId)
      .maybeSingle(); // maybeSingle: returns null instead of throwing when no row exists

    if (error) {
      console.error('Failed to fetch profile:', error.message);
      setProfile(null);
      return;
    }

    if (data) {
      setProfile(data);
      return;
    }

    // No profile row exists yet for this auth user — this is the gap we
    // hit repeatedly during testing. Create a default customer profile
    // now, on first successful login, rather than leaving the account
    // permanently broken.
    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        role: 'customer',
        full_name: userEmail ? userEmail.split('@')[0] : 'New User',
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create fallback profile:', createError.message);
      setProfile(null);
      return;
    }

    setProfile(created);
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id, initialSession.user.email).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        if (newSession?.user) {
          await fetchProfile(newSession.user.id, newSession.user.email);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUpCustomer = useCallback(async ({ email, password, fullName, phone }) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    const userId = data.user?.id;
    if (!userId) {
      return { needsEmailConfirmation: true };
    }

    // Try to create the profile immediately with the right name/phone.
    // If this fails (e.g. race condition) fetchProfile's fallback above
    // will still create a basic one on next login, so this is best-effort.
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      role: 'customer',
      full_name: fullName,
      phone,
    });
    if (profileError && profileError.code !== '23505') {
      // 23505 = already exists, fine to ignore. Anything else, surface it.
      console.error('Profile creation at signup failed:', profileError.message);
    }

    await fetchProfile(userId, email);
    return { needsEmailConfirmation: false };
  }, [fetchProfile]);

  const signUpCompany = useCallback(async ({ email, password, fullName, companyName }) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    const userId = data.user?.id;
    if (!userId) {
      return { needsEmailConfirmation: true };
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({ name: companyName, business_email: email })
      .select()
      .single();
    if (companyError) throw companyError;

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      role: 'company_admin',
      full_name: fullName,
      company_id: company.id,
    });
    if (profileError && profileError.code !== '23505') {
      console.error('Profile creation at signup failed:', profileError.message);
    }

    await fetchProfile(userId, email);
    return { needsEmailConfirmation: false, company };
  }, [fetchProfile]);

  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    companyId: profile?.company_id ?? null,
    loading,
    signUpCustomer,
    signUpCompany,
    signIn,
    signOut,
    refreshProfile: () => fetchProfile(session?.user?.id, session?.user?.email),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
