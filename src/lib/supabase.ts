import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Transaction, PortfolioGoals, FixedIncomeAsset } from '../types/portfolio';

const STORAGE_KEY_SUPABASE_URL = 'fii_tracker_supabase_url_v1';
const STORAGE_KEY_SUPABASE_KEY = 'fii_tracker_supabase_key_v1';

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

const DEFAULT_SUPABASE_URL = 'https://quvbxequiyjdymgnvnpm.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1dmJ4ZXF1aXlqZHltZ252bnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDYxOTksImV4cCI6MjEwNzEyMjE5OX0.P8ghV_HeWc6lRcy1EImeIKoh1sKQ0akIiRFOg19fPsk';

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

async function withDataFallback<T = any>(
  operation: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  const authClient = getSupabaseClient();
  const anonClient = getAnonClient();

  if (!authClient && !anonClient) {
    return { data: null, error: new Error('Cliente Supabase indisponível') };
  }

  if (authClient) {
    try {
      const res = await operation(authClient);
      if (!res.error) return res;

      const errMsg = (res.error?.message || '').toLowerCase();
      const errCode = String(res.error?.code || '');
      // Se der restrição de RLS com token de usuário autenticado, faz fallback transparente com anonClient
      if (
        anonClient &&
        (errCode === '42501' ||
          errMsg.includes('security') ||
          errMsg.includes('permission') ||
          errMsg.includes('denied'))
      ) {
        console.warn('Fallback para cliente Supabase anônimo após restrição de RLS...');
        return await operation(anonClient);
      }
      return res;
    } catch {
      if (anonClient) return await operation(anonClient);
    }
  }

  return await operation(anonClient!);
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

function getLocalSavedAccounts(): { id: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('fii_tracker_saved_accounts_v1');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function resolveUserId(targetUserId?: string | null): string | null {
  if (targetUserId !== undefined) return targetUserId;
  if (typeof window !== 'undefined') {
    const activeId = localStorage.getItem('fii_tracker_active_account_id_v1');
    if (activeId) return activeId;
    const accounts = getLocalSavedAccounts();
    if (accounts[0]?.id) return accounts[0].id;
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

let hasMigratedOrphans = false;

async function migrateOrphanRowsToPrimaryIfNeeded(userId: string): Promise<void> {
  if (!userId || hasMigratedOrphans) return;
  if (typeof window === 'undefined') return;

  try {
    const saved = getLocalSavedAccounts();
    // A migração de dados órfãos só pode acontecer para a PRIMEIRA conta logada no aparelho
    const isPrimaryAccount = saved.length > 0 && saved[0]?.id === userId;
    if (!isPrimaryAccount) {
      hasMigratedOrphans = true;
      return;
    }

    await withDataFallback(async (client) => {
      // Verifica se já existem registros no banco com user_id preenchido
      const { count: nonOrphanCount, error: countErr } = await client
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .not('user_id', 'is', null);

      if (countErr || (nonOrphanCount && nonOrphanCount > 0)) {
        hasMigratedOrphans = true;
        return { data: null, error: null };
      }

      // Verifica se existem registros órfãos (user_id IS NULL)
      const { count: orphanCount } = await client
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .is('user_id', null);

      if (orphanCount && orphanCount > 0) {
        console.log(`[Supabase] Vinculando ${orphanCount} transações órfãs exclusivamente à conta principal (${userId})...`);
        await client.from('transactions').update({ user_id: userId }).is('user_id', null);
        await client.from('fixed_income_assets').update({ user_id: userId }).is('user_id', null);
        await client.from('custom_dividends').update({ user_id: userId }).is('user_id', null);
        await client.from('portfolio_goals').update({ 
          id: `goals_${userId.slice(0, 8)}`,
          user_id: userId 
        }).is('user_id', null);
      }

      hasMigratedOrphans = true;
      return { data: null, error: null };
    });
  } catch (err) {
    console.warn('[Supabase] Erro ao verificar migração de órfãos:', err);
    hasMigratedOrphans = true;
  }
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
  };
}

export async function fetchRemoteTransactions(targetUserId?: string | null): Promise<Transaction[] | null> {
  const userId = resolveUserId(targetUserId);
  if (!userId) {
    // Usuário não autenticado / guest não lê dados da nuvem
    return [];
  }

  await migrateOrphanRowsToPrimaryIfNeeded(userId);

  try {
    const { data, error } = await withDataFallback<any[]>(async (client) => {
      const res = await client
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      return { data: res.data, error: res.error };
    });

    if (error) {
      console.error('Erro ao buscar transações no Supabase:', error);
      return null;
    }
    if (!data) return [];

    return data.map((item: any) => {
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

    const { error } = await withDataFallback(async (client) => {
      const res = await client.from('transactions').upsert(rows);
      return { data: res.data, error: res.error };
    });
    if (error) {
      console.error('Erro no batch upsert de transações no Supabase:', error);
      return false;
    }
    return true;
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
    const { error } = await withDataFallback(async (client) => {
      const res = await client
        .from('transactions')
        .delete()
        .in('id', candidateIds)
        .eq('user_id', userId);
      return { data: res.data, error: res.error };
    });
    if (error) {
      console.error('Erro no batch delete de transações no Supabase:', error);
      return false;
    }
    return true;
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

  await migrateOrphanRowsToPrimaryIfNeeded(userId);

  try {
    const { data, error } = await withDataFallback<any>(async (client) => {
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
    const { error } = await withDataFallback(async (client) => {
      const res = await client.from('portfolio_goals').upsert({
        id: `goals_${userId.slice(0, 8)}`,
        user_id: userId,
        monthly_target: goals.monthlyTarget,
        milestone_equity_target: goals.milestoneEquityTarget,
        monthly_income_target: goals.monthlyIncomeTarget,
        updated_at: new Date().toISOString(),
      });
      return { data: res.data, error: res.error };
    });
    return !error;
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
    const { data, error } = await withDataFallback<any[]>(async (client) => {
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
    const { error } = await withDataFallback(async (client) => {
      const res = await client.from('custom_dividends').upsert({
        ticker: ticker.toUpperCase(),
        dividend,
        user_id: userId,
        updated_at: new Date().toISOString(),
      });
      return { data: res.data, error: res.error };
    });
    return !error;
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

  await migrateOrphanRowsToPrimaryIfNeeded(userId);

  try {
    const { data, error } = await withDataFallback<any[]>(async (client) => {
      const res = await client
        .from('fixed_income_assets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return { data: res.data, error: res.error };
    });

    if (error || !data) return [];

    return data.map((row: any) => ({
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
    const { error } = await withDataFallback(async (client) => {
      const res = await client.from('fixed_income_assets').upsert({
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
        updated_at: asset.updatedAt,
      });
      return { data: res.data, error: res.error };
    });
    return !error;
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
    const { error } = await withDataFallback(async (client) => {
      const res = await client
        .from('fixed_income_assets')
        .delete()
        .in('id', candidateIds)
        .eq('user_id', userId);
      return { data: res.data, error: res.error };
    });
    return !error;
  } catch {
    return false;
  }
}

