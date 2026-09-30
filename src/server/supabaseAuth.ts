import { SupabaseRestClient } from './supabaseRest.ts';

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<AuthUser | null> {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey || !accessToken) return null;
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (!user?.id || typeof user.id !== 'string') return null;
  return { id: user.id, email: user.email, role: user.role };
}

export async function userCanAccessStudent(db: SupabaseRestClient, userId: string, studentLegacyId: string): Promise<boolean> {
  let rows = await db.select<any>('students', `select=id,parent_id,auth_user_id&legacy_id=eq.${encodeURIComponent(studentLegacyId)}&limit=1`) as any[];
  if (!rows[0] && /^[0-9a-f-]{36}$/i.test(studentLegacyId)) {
    rows = await db.select<any>('students', `select=id,parent_id,auth_user_id&id=eq.${encodeURIComponent(studentLegacyId)}&limit=1`) as any[];
  }
  if (!rows[0]) return false;
  if (rows[0].auth_user_id === userId) return true;
  const parents = await db.select<any>('parents', `select=id,auth_user_id&auth_user_id=eq.${encodeURIComponent(userId)}&limit=1`) as any[];
  return !!parents[0] && parents[0].id === rows[0].parent_id;
}