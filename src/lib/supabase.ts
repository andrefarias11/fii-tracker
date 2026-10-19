import { enqueueMutation, flushQueue } from './syncQueue';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Transaction, PortfolioGoals, FixedIncomeAsset } from '../types/portfolio';

interface DatabaseRow {
  split_adjustment?: Transaction['splitAdjustment'];
  id: string; ticker: string; type: Transaction['type']; date: string; shares: number; price: number; total: number; broker: string; notes?: string;
  monthly_target: number; milestone_equity_target: number; monthly_income_target: number; dividend: number;
  name: string; institution: string; invested_amount: number; current_balance: number; rate_type: FixedIncomeAsset['rateType']; rate_percent: number; is_exempt: boolean; maturity_date?: string; updated_at: string;
}
const STORAGE_KEY_SUPABASE_URL = 'fii_tracker_supabase_url_v1';
const STORAGE_KEY_SUPABASE_KEY = 'fii_tracker_supabase_key_v1';

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

const DEFAULT_SUPABASE_URL = '';
const DEFAULT_SUPABASE_KEY = '';

export function getSupabaseConfig(): { url: string; key: string } {
  // Prioridade 1: Armazenamento local customizado (se o usuário trocar na UI)
  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem(STORAGE_KEY_SUPABASE_URL);
    const localKey = localStorage.getItem(STORAGE_KEY_SUPABASE_KEY);
    if (localUrl && localKey) {
      return { url: localUrl.trim(), key: localKey.trim() };
    }
  }

  // Prioridade 2: Variáveis de ambiente (.env.local) ou fallback oficial do projeto
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

  return { url: envUrl.trim(), key: envKey.trim() };
}

export function saveSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_SUPABASE_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, key.trim());
    cachedClient = null; // Reset do cliente
  }
}

export function clearSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_SUPABASE_URL);
    localStorage.removeItem(STORAGE_KEY_SUPABASE_KEY);
    cachedClient = null;
  }
}

let cachedAnonClient: SupabaseClient | null = null;
let cachedAnonConfigKey = '';

export function getAnonClient(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;

  const currentKey = `${url}__${key}`;
  if (cachedAnonClient && cachedAnonConfigKey === currentKey) {
    return cachedAnonClient;
  }

  try {
    cachedAnonClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedAnonConfigKey = currentKey;
    return cachedAnonClient;
  } catch (err) {
    console.error('Falha ao inicializar cliente Supabase anônimo:', err);
    return null;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;

  const currentKey = `${url}__${key}`;
  if (cachedClient && cachedConfigKey === currentKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    cachedConfigKey = currentKey;
    return cachedClient;
  } catch (err) {
    console.error('Falha ao inicializar cliente Supabase:', err);
    return null;
  }
}

async function withDataFallback<T = unknown>(
  operation: (client: SupabaseClient) => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<{ data: T | null; error: { message: string } | null }> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: { message: 'Cliente indisponível' } };
  const { data } = await client.auth.getUser();
  if (!data.user) return { data: null, error: { message: 'Autenticação necessária' } };
  if (!await flushQueue(client, data.user.id)) return { data: null, error: { message: 'Alterações pendentes de sincronização' } };
  return operation(client);
}

async function queueWrite(table: string, userId: string, rows?: Record<string, unknown>[], deletedIds?: string[], conflict?: string): Promise<boolean> {
  enqueueMutation({ table, userId, rows, deletedIds, conflict });
  const client = getSupabaseClient();
  return client ? flushQueue(client, userId) : false;
}

async function readOwnedRows<T>(client: SupabaseClient, table: string, userId: string, columns = '*', sortColumn = 'id'): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const result = await client.from(table).select(columns).eq('user_id', userId).order(sortColumn).range(start, start + 999);
    if (result.error) return { data: null, error: result.error };
    const page = (result.data || []) as unknown as T[];
    rows.push(...page);
    if (page.length < 1000) return { data: rows, error: null };
  }
}

export async function fetchDeletedIds(userId: string, table: string): Promise<Set<string>> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Nuvem indisponível');
  const { data, error } = await readOwnedRows<{ row_id: string; table_name: string }>(client, 'portfolio_deletions', userId, 'row_id,table_name', 'row_id');
  if (error) throw error;
  return new Set((data || []).filter(row => row.table_name === table).map(row => unscopeIdFromUser(row.row_id, userId)));
}

export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await withDataFallback(async (client) => {
      const res = await client.from('portfolio_goals').select('id').limit(1);
      return { data: res.data, error: res.error };
    });
    return !error;
  } catch {
    return false;
  }
}

// ----------------- Helpers de Isolamento Multiusuário e Escopo de ID -----------------

export function resolveUserId(targetUserId?: string | null): string | null {
  if (targetUserId !== undefined) return targetUserId;
  if (typeof window !== 'undefined') {
    const activeId = localStorage.getItem('fii_tracker_active_account_id_v1');
    if (activeId) return activeId;
  }
  return null;
}

export function scopeIdWithUser(id: string, userId?: string | null): string {
  if (!userId) return id;
  const prefix = `${userId.slice(0, 8)}_`;
  if (id.startsWith(prefix)) return id;
  return `${prefix}${id}`;
}

export function unscopeIdFromUser(id: string, userId?: string | null): string {
  if (!userId) return id;
  const prefix = `${userId.slice(0, 8)}_`;
  if (id.startsWith(prefix)) return id.slice(prefix.length);
  return id;
}

// ----------------- Operações de Transações (Single & Batch SQL) -----------------

function mapTransactionToDbRow(tx: Transaction) {
  const isSell = tx.type === 'SELL';
  const isDividend = tx.type === 'DIVIDEND';
  const signedShares = isSell ? -Math.abs(tx.shares) : Math.abs(tx.shares);
  const signedTotal = isSell ? -Math.abs(tx.total) : Math.abs(tx.total);

  let notesValue = tx.notes || null;
  if (isDividend && (!notesValue || !notesValue.startsWith('[PROVENTO B3]'))) {
    notesValue = `[PROVENTO B3] ${notesValue || 'Rendimento Oficial B3'}`;
  }

  const transactionType = tx.type || (isDividend ? 'DIVIDEND' : isSell ? 'SELL' : 'BUY');

  return {
    id: tx.id,
    ticker: tx.ticker.toUpperCase().trim(),
    type: transactionType,
    date: tx.date,
    shares: signedShares,
    price: Math.abs(tx.price),
    total: signedTotal,
    broker: tx.broker,
    notes: notesValue,
    split_adjustment: tx.splitAdjustment || null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchRemoteTransactions(targetUserId?: string | null): Promise<Transaction[] | null> {
  const userId = resolveUserId(targetUserId);
  if (!userId) {
    // Usuário não autenticado / guest não lê dados da nuvem
    return [];
  }


  try {
    const { data, error } = await withDataFallback<DatabaseRow[]>(async (client) => {
      return readOwnedRows<DatabaseRow>(client, 'transactions', userId);
    });

    if (error) {
      console.error('Erro ao buscar transações no Supabase:', error);
      return null;
    }
    if (!data) return [];

    return data.map((item: DatabaseRow) => {
      const rawShares = Number(item.shares);
      const notesStr = String(item.notes || '');
      const idStr = String(item.id || '');
      const dbType = item.type as 'BUY' | 'SELL' | 'DIVIDEND' | undefined;
      const isDividend =
        dbType === 'DIVIDEND' || idStr.includes('b3-div-') || notesStr.startsWith('[PROVENTO B3]');
      const isSell = dbType === 'SELL' || (!isDividend && rawShares < 0);
      const absShares = Math.abs(rawShares);
      const absPrice = Math.abs(Number(item.price));
      const absTotal = Math.abs(Number(item.total));

      return {
        id: unscopeIdFromUser(item.id, userId),
        ticker: String(item.ticker || '').toUpperCase().trim(),
        type: (dbType === 'BUY' || dbType === 'SELL' || dbType === 'DIVIDEND')
          ? dbType
          : isDividend
          ? 'DIVIDEND'
          : isSell
          ? 'SELL'
          : 'BUY',
        date: item.date,
        splitAdjustment: item.split_adjustment,
        shares: absShares,
        price: absPrice,
        total: absTotal,
        broker: item.broker || 'XP Investimentos',
        notes: item.notes || undefined,
      };
    });
  } catch (err) {
    console.error('Erro ao buscar transações no Supabase:', err);
    return null;
  }
}

export async function syncTransactionsBatchToCloud(
  txs: Transaction[],
  targetUserId?: string | null
): Promise<boolean> {
  if (txs.length === 0) return true;
  const userId = resolveUserId(targetUserId);
  if (!userId) return true;

  try {
    const rows = txs.map((tx) => ({
      ...mapTransactionToDbRow(tx),
      id: scopeIdWithUser(tx.id, userId),
      user_id: userId,
    }));

    return await queueWrite('transactions', userId, rows);
  } catch (err) {
    console.error('Erro no batch upsert de transações no Supabase:', err);
    return false;
  }
}

export async function syncTransactionToCloud(
  tx: Transaction,
  targetUserId?: string | null
): Promise<boolean> {
  return syncTransactionsBatchToCloud([tx], targetUserId);
}

export const upsertRemoteTransaction = syncTransactionToCloud;
export const upsertRemoteTransactionsBatch = syncTransactionsBatchToCloud;

export async function deleteRemoteTransactionsBatch(
  ids: string[],
  targetUserId?: string | null
): Promise<boolean> {
  if (ids.length === 0) return true;
  const userId = resolveUserId(targetUserId);
  if (!userId) return true;

  try {
    const candidateIds = Array.from(new Set([...ids, ...ids.map((id) => scopeIdWithUser(id, userId))]));
    return await queueWrite('transactions', userId, undefined, candidateIds);
  } catch (err) {
    console.error('Erro no batch delete de transações no Supabase:', err);
    return false;
  }
}

export async function deleteRemoteTransaction(
  id: string,
  targetUserId?: string | null
): Promise<boolean> {
  return deleteRemoteTransactionsBatch([id], targetUserId);
}

// ----------------- Operações de Metas -----------------

export async function fetchRemoteGoals(targetUserId?: string | null): Promise<PortfolioGoals | null> {
  const userId = resolveUserId(targetUserId);
  if (!userId) return null;


  try {
    const { data, error } = await withDataFallback<DatabaseRow>(async (client) => {
      const res = await client
        .from('portfolio_goals')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      return { data: res.data, error: res.error };
    });

    if (error || !data) return null;

    return {
      monthlyTarget: Number(data.monthly_target),
      milestoneEquityTarget: Number(data.milestone_equity_target),
      monthlyIncomeTarget: Number(data.monthly_income_target),
    };
  } catch {
    return null;
  }
}

export async function syncGoalsToCloud(
  goals: PortfolioGoals,
  targetUserId?: string | null
): Promise<boolean> {
  const userId = resolveUserId(targetUserId);
  if (!userId) return true;

  try {
    return await queueWrite('portfolio_goals', userId, [{
        id: `goals_${userId.slice(0, 8)}`,
        user_id: userId,
        monthly_target: goals.monthlyTarget,
        milestone_equity_target: goals.milestoneEquityTarget,
        monthly_income_target: goals.monthlyIncomeTarget,
        updated_at: new Date().toISOString(),
      }], undefined, undefined);
  } catch {
    return false;
  }
}

export const upsertRemoteGoals = syncGoalsToCloud;

// ----------------- Operações de Dividendos -----------------

export async function fetchRemoteDividends(
  targetUserId?: string | null
): Promise<Record<string, number> | null> {
  const userId = resolveUserId(targetUserId);
  if (!userId) return null;

  try {
    const { data, error } = await withDataFallback<Pick<DatabaseRow, 'ticker' | 'dividend'>[]>(async (client) => {
      const res = await client
        .from('custom_dividends')
        .select('ticker, dividend')
        .eq('user_id', userId);
      return { data: res.data, error: res.error };
    });
    if (error || !data) return null;

    const map: Record<string, number> = {};
    for (const item of data) {
      map[item.ticker] = Number(item.dividend);
    }
    return map;
  } catch {
    return null;
  }
}

export async function syncDividendToCloud(
  ticker: string,
  dividend: number,
  targetUserId?: string | null
): Promise<boolean> {
  const userId = resolveUserId(targetUserId);
  if (!userId) return true;

  try {
    return await queueWrite('custom_dividends', userId, [{
        ticker: ticker.toUpperCase(),
        dividend,
        user_id: userId,
        updated_at: new Date().toISOString(),
      }], undefined, 'user_id,ticker');
  } catch {
    return false;
  }
}

export const upsertRemoteDividend = syncDividendToCloud;

// ----------------- Operações de Renda Fixa & Caixinhas -----------------

export async function fetchRemoteFixedIncome(
  targetUserId?: string | null
): Promise<FixedIncomeAsset[] | null> {
  const userId = resolveUserId(targetUserId);
  if (!userId) return [];


  try {
    const { data, error } = await withDataFallback<(Omit<DatabaseRow, 'type'> & { type: FixedIncomeAsset['type'] })[]>(async (client) => {
      return readOwnedRows<Omit<DatabaseRow, 'type'> & { type: FixedIncomeAsset['type'] }>(client, 'fixed_income_assets', userId);
    });

    if (error) return null;
    if (!data) return [];

    return data.map((row) => ({
      id: unscopeIdFromUser(row.id, userId),
      name: row.name,
      type: row.type,
      institution: row.institution,
      investedAmount: Number(row.invested_amount || 0),
      currentBalance: Number(row.current_balance || 0),
      rateType: row.rate_type || 'CDI',
      ratePercent: Number(row.rate_percent || 100),
      isExempt: Boolean(row.is_exempt),
      maturityDate: row.maturity_date || undefined,
      notes: row.notes || undefined,
      updatedAt: row.updated_at || new Date().toISOString().slice(0, 10),
    }));
  } catch {
    return null;
  }
}

export async function syncFixedIncomeToCloud(
  asset: FixedIncomeAsset,
  targetUserId?: string | null
): Promise<boolean> {
  const userId = resolveUserId(targetUserId);
  if (!userId) return true;

  try {
    return await queueWrite('fixed_income_assets', userId, [{
        id: scopeIdWithUser(asset.id, userId),
        user_id: userId,
        name: asset.name,
        type: asset.type,
        institution: asset.institution,
        invested_amount: asset.investedAmount,
        current_balance: asset.currentBalance,
        rate_type: asset.rateType,
        rate_percent: asset.ratePercent,
        is_exempt: asset.isExempt,
        maturity_date: asset.maturityDate || null,
        notes: asset.notes || null,
        updated_at: new Date().toISOString(),
      }], undefined, undefined);
  } catch {
    return false;
  }
}

export const upsertRemoteFixedIncome = syncFixedIncomeToCloud;

export async function deleteRemoteFixedIncome(
  id: string,
  targetUserId?: string | null
): Promise<boolean> {
  const userId = resolveUserId(targetUserId);
  if (!userId) return true;

  try {
    const candidateIds = Array.from(new Set([id, scopeIdWithUser(id, userId)]));
    return await queueWrite('fixed_income_assets', userId, undefined, candidateIds);
  } catch {
    return false;
  }
}


export async function deleteRemoteCustomDividends(tickers: string[], userId: string | null): Promise<boolean> {
  return !userId || !tickers.length ? true : queueWrite('custom_dividends', userId, undefined, tickers);
}
