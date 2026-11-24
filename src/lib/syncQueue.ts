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

export function extractPendingEntityIds(user: string | null | undefined): {
  transactionIds: Set<string>;
  fixedIncomeIds: Set<string>;
} {
  const transactionIds = new Set<string>();
  const fixedIncomeIds = new Set<string>();
  if (!user || typeof window === 'undefined') {
    return { transactionIds, fixedIncomeIds };
  }

  const userScopePrefix = `${user.slice(0, 8)}_`;
  const stripScope = (id: string) =>
    id.startsWith(userScopePrefix) ? id.slice(userScopePrefix.length) : id;

  const { items } = inspectQueue(user);
  for (const item of items) {
    const targetSet =
      item.table === 'transactions'
        ? transactionIds
        : item.table === 'fixed_income_assets'
        ? fixedIncomeIds
        : null;
    if (!targetSet) continue;

    if (Array.isArray(item.rows)) {
      for (const row of item.rows) {
        if (typeof row.id === 'string' && row.id.length > 0) {
          targetSet.add(stripScope(row.id));
        }
      }
    }
    if (Array.isArray(item.deletedIds)) {
      for (const delId of item.deletedIds) {
        if (typeof delId === 'string' && delId.length > 0) {
          targetSet.add(stripScope(delId));
        }
      }
    }
  }

  return { transactionIds, fixedIncomeIds };
}

export function restoreExportedSyncQueue(
  user: string,
  jsonStr: string
): { restoredCount: number; clearedCorruptCount: number } {
  if (typeof window === 'undefined' || !user) {
    throw new Error('Faça login na conta correspondente antes de restaurar a fila local.');
  }
  if (jsonStr.length > 5_000_000) {
    throw new Error('Arquivo de fila local excede 5 MB.');
  }

  let parsedDoc: unknown;
  try {
    parsedDoc = JSON.parse(jsonStr);
  } catch {
    throw new Error('JSON inválido no arquivo da fila local.');
  }

  if (
    !parsedDoc ||
    typeof parsedDoc !== 'object' ||
    Array.isArray(parsedDoc) ||
    !Array.isArray((parsedDoc as { entries?: unknown }).entries)
  ) {
    throw new Error('Formato de arquivo de fila local não reconhecido.');
  }

  const rawEntries = (parsedDoc as { entries: unknown[] }).entries;
  if (rawEntries.length === 0 || rawEntries.length > 10_000) {
    throw new Error('Quantidade de itens inválida no arquivo da fila local.');
  }

  const currentQueue = inspectQueue(user);
  const existingIds = new Set(currentQueue.items.map((m) => m.id));
  const newestExistingTimestampByEntity = new Map<string, number>();

  const recordEntityTimestamps = (m: Mutation, map: Map<string, number>) => {
    const ids: string[] = [];
    if (Array.isArray(m.rows)) {
      for (const r of m.rows) {
        if (typeof r.id === 'string') ids.push(r.id);
      }
    }
    if (Array.isArray(m.deletedIds)) {
      ids.push(...m.deletedIds);
    }
    for (const id of ids) {
      const entityKey = `${m.table}:${id}`;
      const prev = map.get(entityKey) ?? -Infinity;
      if (m.enqueuedAt > prev) map.set(entityKey, m.enqueuedAt);
    }
  };

  for (const existing of currentQueue.items) {
    recordEntityTimestamps(existing, newestExistingTimestampByEntity);
  }

  const validatedToWrite: { key: string; serialized: string }[] = [];

  for (const entry of rawEntries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Item inválido encontrado no arquivo da fila local.');
    }
    const { key, raw } = entry as { key?: unknown; raw?: unknown };
    if (typeof key !== 'string' || !key.startsWith(prefix(user))) {
      throw new Error('O arquivo pertence a outra conta ou possui chave inválida.');
    }
    const candidateObj: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!isMutation(candidateObj, user, key)) {
      throw new Error(`Operação inválida ou ainda corrompida na chave ${key}.`);
    }

    if (existingIds.has(candidateObj.id)) continue;

    // Nunca sobrescreve entidades que já receberam mutação mais recente na fila ativa
    const candidateIds: string[] = [];
    if (Array.isArray(candidateObj.rows)) {
      for (const r of candidateObj.rows) {
        if (typeof r.id === 'string') candidateIds.push(r.id);
      }
    }
    if (Array.isArray(candidateObj.deletedIds)) {
      candidateIds.push(...candidateObj.deletedIds);
    }

    const supersededByNewer = candidateIds.some((id) => {
      const newerTs = newestExistingTimestampByEntity.get(`${candidateObj.table}:${id}`);
      return newerTs !== undefined && newerTs > candidateObj.enqueuedAt;
    });
    if (supersededByNewer) continue;

    validatedToWrite.push({ key, serialized: JSON.stringify(candidateObj) });
    existingIds.add(candidateObj.id);
  }

  for (const item of validatedToWrite) {
    localStorage.setItem(item.key, item.serialized);
  }

  let clearedCorruptCount = 0;
  const refreshed = inspectQueue(user);
  for (const bad of refreshed.corrupt) {
    localStorage.removeItem(bad.key);
    clearedCorruptCount++;
  }

  window.dispatchEvent(new Event(SYNC_EVENT));
  return { restoredCount: validatedToWrite.length, clearedCorruptCount };
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
