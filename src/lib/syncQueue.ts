import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabase';

export type Mutation = { id: string; enqueuedAt: number; userId: string; table: string; rows?: Record<string, unknown>[]; deletedIds?: string[]; conflict?: string };
const prefix = (user: string) => `fii_sync_item_v1_${user}_`;
export const SYNC_EVENT = 'fii-sync-status';
let sequence = 0;
export function readQueue(user: string): Mutation[] {
  if (typeof window === 'undefined') return [];
  const items: Mutation[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix(user))) items.push(JSON.parse(localStorage.getItem(key)!));
  }
  return items.sort((a,b) => a.enqueuedAt - b.enqueuedAt || a.id.localeCompare(b.id));
}
export function enqueueMutation(mutation: Omit<Mutation, 'id' | 'enqueuedAt'>) {
  const item = { ...mutation, id: crypto.randomUUID(), enqueuedAt: Date.now() * 1000 + sequence++ % 1000 };
  // Each mutation has its own key: another tab cannot overwrite the entire queue.
  localStorage.setItem(prefix(item.userId) + item.id, JSON.stringify(item));
  window.dispatchEvent(new Event(SYNC_EVENT));
}
export async function processQueue(user: string, send: (item: Mutation) => Promise<boolean>): Promise<boolean> {
  while (readQueue(user).length) {
    const item = readQueue(user)[0];
    if (!await send(item)) return false;
    localStorage.removeItem(prefix(user) + item.id);
    window.dispatchEvent(new Event(SYNC_EVENT));
  }
  return true;
}
const active = new Map<string, Promise<boolean>>();
export function flushQueue(client: SupabaseClient, user: string): Promise<boolean> {
  const existing = active.get(user);
  if (existing) return existing;
  const task = (async () => {
    try {
      if (!readQueue(user).length) return true;
      const { data: session } = await client.auth.getSession();
      const token = session.session?.access_token;
      if (!token || session.session?.user.id !== user) return false;
      const { data: verified } = await client.auth.getUser(token);
      if (verified.user?.id !== user) return false;
      const config = getSupabaseConfig();
      // Freeze the credential for this flush, even if the UI changes accounts during an await.
      const transport = createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const run = () => processQueue(user, async item => {
        const result = item.deletedIds
          ? await transport.rpc('delete_portfolio_rows', { target_table: item.table, row_ids: item.deletedIds })
          : await transport.from(item.table).upsert(item.rows!, item.conflict ? { onConflict: item.conflict } : undefined);
        return !result.error;
      });
      return typeof navigator !== 'undefined' && navigator.locks
        ? await navigator.locks.request(`fii-sync-${user}`, run) : await run();
    } catch { return false; }
  })().finally(() => active.delete(user));
  active.set(user, task);
  return task;
}
