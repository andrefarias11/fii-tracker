import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabase';

export type Mutation = { id: string; enqueuedAt: number; userId: string; table: string; rows?: Record<string, unknown>[]; deletedIds?: string[]; conflict?: string };
const prefix = (user: string) => `fii_sync_item_v1_${user}_`;
export const SYNC_EVENT = 'fii-sync-status';
let sequence = 0;
export class CorruptSyncQueueError extends Error {
  constructor() {
    super('A fila local contém alterações ilegíveis. Baixe uma cópia antes de buscar ajuda; a sincronização foi pausada para proteger seus dados.');
    this.name = 'CorruptSyncQueueError';
  }
}

function isMutation(value: unknown, user: string, key: string): value is Mutation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<Mutation>;
  const hasRows = Array.isArray(item.rows) && item.rows.length > 0 && item.rows.every(row => row && typeof row === 'object' && !Array.isArray(row)
    && Object.keys(row).length > 0 && (row.user_id === undefined || row.user_id === user));
  const hasDeletes = Array.isArray(item.deletedIds) && item.deletedIds.length > 0 && item.deletedIds.every(id => typeof id === 'string' && id.length > 0);
  return typeof item.id === 'string' && item.id.length > 0 && key === prefix(user) + item.id
    && item.userId === user && typeof item.enqueuedAt === 'number' && Number.isFinite(item.enqueuedAt)
    && typeof item.table === 'string' && ['transactions', 'fixed_income_assets', 'portfolio_goals', 'custom_dividends'].includes(item.table)
    && hasRows !== hasDeletes && (item.conflict === undefined || typeof item.conflict === 'string');
}

export function readRawQueue(user: string): { key: string; raw: string | null }[] {
  if (typeof window === 'undefined') return [];
  const entries: { key: string; raw: string | null }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix(user))) entries.push({ key, raw: localStorage.getItem(key) });
  }
  return entries;
}

export function inspectQueue(user: string): { items: Mutation[]; corrupt: { key: string; raw: string | null }[] } {
  const items: Mutation[] = [];
  const corrupt: { key: string; raw: string | null }[] = [];
  for (const { key, raw } of readRawQueue(user)) {
    try {
      const parsed: unknown = JSON.parse(raw ?? '');
      if (isMutation(parsed, user, key)) items.push(parsed);
      else corrupt.push({ key, raw });
    } catch {
      corrupt.push({ key, raw });
    }
  }
  return { items: items.sort((a,b) => a.enqueuedAt - b.enqueuedAt || a.id.localeCompare(b.id)), corrupt };
}

export function readQueue(user: string): Mutation[] {
  const queue = inspectQueue(user);
  if (queue.corrupt.length) throw new CorruptSyncQueueError();
  return queue.items;
}
export function enqueueMutation(mutation: Omit<Mutation, 'id' | 'enqueuedAt'>) {
  const item = { ...mutation, id: crypto.randomUUID(), enqueuedAt: Date.now() * 1000 + sequence++ % 1000 };
  // Each mutation has its own key: another tab cannot overwrite the entire queue.
  localStorage.setItem(prefix(item.userId) + item.id, JSON.stringify(item));
  window.dispatchEvent(new Event(SYNC_EVENT));
}
export async function processQueue(user: string, send: (item: Mutation) => Promise<boolean>): Promise<boolean> {
  while (true) {
    const item = readQueue(user)[0];
    if (!item) return true;
    if (!await send(item)) return false;
    localStorage.removeItem(prefix(user) + item.id);
    window.dispatchEvent(new Event(SYNC_EVENT));
  }
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
