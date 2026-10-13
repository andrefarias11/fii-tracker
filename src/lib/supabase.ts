import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Transaction, PortfolioGoals, FixedIncomeAsset } from '../types/portfolio';

const STORAGE_KEY_SUPABASE_URL = 'fii_tracker_supabase_url_v1';
const STORAGE_KEY_SUPABASE_KEY = 'fii_tracker_supabase_key_v1';

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

const DEFAULT_SUPABASE_URL = 'https://quvbxequiyjdymgnvnpm.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1dmJ4ZXF1aXlqZHltZ252bnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDYxOTksImV4cCI6MjEwNzEyMjE5OX0.P8ghV_HeWc6lRcy1EImeIKoh1sKQ0akIiRFOg19fPsk';

export function getSupabaseConfig(): { url: string; key: string } {
  // Prioridade 1: Variáveis de ambiente (.env.local) ou fallback direto do projeto
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  // Prioridade 2: Armazenamento local customizado (se o usuário trocar na UI)
  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
    const localKey = localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || DEFAULT_SUPABASE_KEY;
    if (localUrl && localKey) {
      return { url: localUrl, key: localKey };
    }
  }

  return { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY };
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

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;

  const currentKey = `${url}__${key}`;
  if (cachedClient && cachedConfigKey === currentKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    cachedConfigKey = currentKey;
    return cachedClient;
  } catch (err) {
    console.error('Falha ao inicializar cliente Supabase:', err);
    return null;
  }
}

export async function checkSupabaseConnection(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('portfolio_goals').select('id').limit(1);
    return !error;
  } catch {
    return false;
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

  return {
    id: tx.id,
    ticker: tx.ticker.toUpperCase().trim(),
    date: tx.date,
    shares: signedShares,
    price: Math.abs(tx.price),
    total: signedTotal,
    broker: tx.broker,
    notes: notesValue,
  };
}

export async function fetchRemoteTransactions(): Promise<Transaction[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map((item) => {
      const rawShares = Number(item.shares);
      const notesStr = String(item.notes || '');
      const idStr = String(item.id || '');
      const isDividend =
        idStr.startsWith('b3-div-') || notesStr.startsWith('[PROVENTO B3]');
      const isSell = !isDividend && rawShares < 0;
      const absShares = Math.abs(rawShares);
      const absPrice = Math.abs(Number(item.price));
      const absTotal = Math.abs(Number(item.total));

      return {
        id: item.id,
        ticker: String(item.ticker || '').toUpperCase().trim(),
        type: isDividend ? 'DIVIDEND' : isSell ? 'SELL' : 'BUY',
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

export async function upsertRemoteTransaction(tx: Transaction): Promise<boolean> {
  return upsertRemoteTransactionsBatch([tx]);
}

export async function upsertRemoteTransactionsBatch(txs: Transaction[]): Promise<boolean> {
  if (txs.length === 0) return true;
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const rows = txs.map(mapTransactionToDbRow);
    const { error } = await client.from('transactions').upsert(rows);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro no batch upsert de transações no Supabase:', err);
    return false;
  }
}

export async function deleteRemoteTransaction(id: string): Promise<boolean> {
  return deleteRemoteTransactionsBatch([id]);
}

export async function deleteRemoteTransactionsBatch(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('transactions').delete().in('id', ids);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro no batch delete de transações no Supabase:', err);
    return false;
  }
}

// ----------------- Operações de Metas -----------------

export async function fetchRemoteGoals(): Promise<PortfolioGoals | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('portfolio_goals')
      .select('*')
      .eq('id', 'default_goals')
      .single();

    if (error) return null;
    if (!data) return null;

    return {
      monthlyTarget: Number(data.monthly_target),
      milestoneEquityTarget: Number(data.milestone_equity_target),
      monthlyIncomeTarget: Number(data.monthly_income_target),
    };
  } catch {
    return null;
  }
}

export async function upsertRemoteGoals(goals: PortfolioGoals): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('portfolio_goals').upsert({
      id: 'default_goals',
      monthly_target: goals.monthlyTarget,
      milestone_equity_target: goals.milestoneEquityTarget,
      monthly_income_target: goals.monthlyIncomeTarget,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

// ----------------- Operações de Dividendos -----------------

export async function fetchRemoteDividends(): Promise<Record<string, number> | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from('custom_dividends').select('ticker, dividend');
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

export async function upsertRemoteDividend(ticker: string, dividend: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('custom_dividends').upsert({
      ticker: ticker.toUpperCase(),
      dividend,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}
// ----------------- Operações de Renda Fixa & Caixinhas -----------------

export async function fetchRemoteFixedIncome(): Promise<FixedIncomeAsset[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('fixed_income_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      institution: row.institution,
      investedAmount: Number(row.invested_amount || 0),
      currentBalance: Number(row.current_balance || 0),
      rateType: row.rate_type || 'CDI',
      ratePercent: Number(row.rate_percent || 100),
      isExempt: Boolean(row.is_exempt),
      notes: row.notes || undefined,
      updatedAt: row.updated_at || new Date().toISOString().slice(0, 10),
    }));
  } catch {
    return null;
  }
}

export async function upsertRemoteFixedIncome(asset: FixedIncomeAsset): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('fixed_income_assets').upsert({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      institution: asset.institution,
      invested_amount: asset.investedAmount,
      current_balance: asset.currentBalance,
      rate_type: asset.rateType,
      rate_percent: asset.ratePercent,
      is_exempt: asset.isExempt,
      notes: asset.notes || null,
      updated_at: asset.updatedAt,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteRemoteFixedIncome(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('fixed_income_assets').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
