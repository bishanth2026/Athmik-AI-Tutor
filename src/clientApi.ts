import { supabase } from './auth/supabaseClient';

const TOKEN_KEY = 'athmik_supabase_access_token_v1';

export function getAccessToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  let token = getAccessToken();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || token;
    if (token) setAccessToken(token);
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}