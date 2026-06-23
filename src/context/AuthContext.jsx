// src/context/AuthContext.jsx
//
// PET.RA Claims AI — Auth Context

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

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, phone, company_id')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch profile:', error.message);
      setProfile(null);
      return;
    }
    setProfile(data);
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id).finally(() => {
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
          await fetchProfile(newSession.user.id);
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

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      role: 'customer',
      full_name: fullName,
      phone,
    });
    if (profileError) throw profileError;

    await fetchProfile(userId);
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
    if (profileError) throw profileError;

    await fetchProfile(userId);
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
    refreshProfile: () => fetchProfile(session?.user?.id),
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
