/** Minimal Supabase PostgREST client using native fetch.
 * Keeps the server dependency-free and ensures the service-role key never reaches the browser.
 */
export class SupabaseRestClient {
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor(url = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!url || !serviceKey) throw new Error('SUPABASE_NOT_CONFIGURED');
    this.baseUrl = url.replace(/\/$/, '') + '/rest/v1';
    this.serviceKey = serviceKey;
  }

  private headers(extra: Record<string, string> = {}) {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  async select<T>(table: string, query = '', options: { single?: boolean } = {}): Promise<T | T[]> {
    const response = await fetch(`${this.baseUrl}/${table}${query ? `?${query}` : ''}`, {
      headers: this.headers({ Prefer: options.single ? 'return=representation' : 'return=representation' }),
    });
    if (!response.ok) throw new Error(`SUPABASE_SELECT_${response.status}: ${await response.text()}`);
    const data = await response.json();
    if (options.single) return data[0] as T;
    return data as T[];
  }

  async upsert<T>(table: string, rows: unknown | unknown[], onConflict?: string): Promise<T[]> {
    const params = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
    const response = await fetch(`${this.baseUrl}/${table}${params}`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
    });
    if (!response.ok) throw new Error(`SUPABASE_UPSERT_${response.status}: ${await response.text()}`);
    return await response.json();
  }

  async rpc<T>(functionName: string, args: Record<string, unknown>): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/rpc/${functionName}`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`SUPABASE_RPC_${response.status}: ${await response.text()}`);
    const data = await response.json();
    return Array.isArray(data) ? data as T[] : [data as T];
  }

  async update<T>(table: string, query: string, patch: unknown): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/${table}?${query}`, {
      method: 'PATCH',
      headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(patch),
    });
    if (!response.ok) throw new Error(`SUPABASE_UPDATE_${response.status}: ${await response.text()}`);
    return await response.json();
  }
}

export function createSupabaseRestClient(): SupabaseRestClient | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return new SupabaseRestClient();
}
