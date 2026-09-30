import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../auth/supabaseClient';
import { AuthView } from '../../views/AuthView';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoading(false); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);
  if (loading) return <div className="min-h-[70vh] flex items-center justify-center text-sm text-slate-500">Loading secure session…</div>;
  if (!supabase || !session) return <AuthView />;
  return <>{children}</>;
};