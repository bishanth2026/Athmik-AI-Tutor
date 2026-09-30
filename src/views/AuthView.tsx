import React, { useState } from 'react';
import { LogIn, Sparkles, Loader2 } from 'lucide-react';
import { supabase, isSupabaseAuthConfigured } from '../auth/supabaseClient';

export const AuthView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    if (!supabase) { setError('Supabase authentication is not configured for this deployment.'); return; }
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError(signInError.message);
  };
  if (!isSupabaseAuthConfigured) return <div className="min-h-[70vh] flex items-center justify-center px-4"><div className="max-w-lg w-full rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center"><h1 className="text-xl font-bold text-slate-900">Supabase Auth is not configured</h1><p className="mt-2 text-sm text-slate-600">Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the deployment environment, then redeploy.</p></div></div>;
  return <div className="min-h-[70vh] flex items-center justify-center px-4 py-10"><form onSubmit={signIn} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><div className="text-center mb-7"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Sparkles className="h-6 w-6" /></div><h1 className="text-2xl font-extrabold text-slate-900">AthmiK AI Tutor</h1><p className="mt-1 text-sm text-slate-500">Sign in to continue to the learning portal.</p></div><label className="block text-sm font-semibold text-slate-700">Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="mt-2 mb-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" placeholder="Parent email" /><label className="block text-sm font-semibold text-slate-700">Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" placeholder="Password" />{error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}<button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{busy ? 'Signing in…' : 'Sign in'}</button></form></div>;
};