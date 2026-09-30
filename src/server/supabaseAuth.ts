import { SupabaseRestClient } from './supabaseRest.ts';

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

const TOKEN_CACHE_TTL_MS = 30_000;
const ACCESS_CACHE_TTL_MS = 30_000;
const tokenCache = new Map<string, { expiresAt: number; user: AuthUser | null }>();
const accessCache = new Map<string, { expiresAt: number; allowed: boolean }>();

export async function verifySupabaseAccessToken(accessToken: string): Promise<AuthUser | null> {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey || !accessToken) return null;

  const cached = tokenCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    tokenCache.set(accessToken, { expiresAt: Date.now() + 5_000, user: null });
    return null;
  }

  const user = await response.json();
  const result = user?.id && typeof user.id === 'string'
    ? { id: user.id, email: user.email, role: user.role }
    : null;

  tokenCache.set(accessToken, { expiresAt: Date.now() + TOKEN_CACHE_TTL_MS, user: result });
  return result;
}

export async function userCanAccessStudent(
  db: SupabaseRestClient,
  userId: string,
  studentLegacyId: string
): Promise<boolean> {
  const cacheKey = `${userId}:${studentLegacyId}`;
  const cached = accessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;

  let rows = await db.select<any>(
    'students',
    `select=id,parent_id,auth_user_id&legacy_id=eq.${encodeURIComponent(studentLegacyId)}&limit=1`
  ) as any[];

  if (!rows[0] && /^[0-9a-f-]{36}$/i.test(studentLegacyId)) {
    rows = await db.select<any>(
      'students',
      `select=id,parent_id,auth_user_id&id=eq.${encodeURIComponent(studentLegacyId)}&limit=1`
    ) as any[];
  }

  if (!rows[0]) {
    accessCache.set(cacheKey, { expiresAt: Date.now() + 5_000, allowed: false });
    return false;
  }

  if (rows[0].auth_user_id === userId) {
    accessCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS, allowed: true });
    return true;
  }

  const parents = await db.select<any>(
    'parents',
    `select=id,auth_user_id&auth_user_id=eq.${encodeURIComponent(userId)}&limit=1`
  ) as any[];

  const allowed = !!parents[0] && parents[0].id === rows[0].parent_id;
  accessCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS, allowed });
  return allowed;
}
