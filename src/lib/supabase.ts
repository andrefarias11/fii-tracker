import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Transaction, PortfolioGoals } from '../types/portfolio';

const STORAGE_KEY_SUPABASE_URL = 'fii_tracker_supabase_url_v1';
const STORAGE_KEY_SUPABASE_KEY = 'fii_tracker_supabase_key_v1';

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseConfig(): { url: string; key: string } {
  // Prioridade: Variáveis de ambiente (.env.local) ou localStorage
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || '';
    const localKey = localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || '';
    return { url: localUrl, key: localKey };
  }

  return { url: '', key: '' };
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

// ----------------- Operações de Transações -----------------

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

    return data.map((item) => ({
      id: item.id,
      ticker: item.ticker,
      date: item.date,
      shares: Number(item.shares),
      price: Number(item.price),
      total: Number(item.total),
      broker: item.broker || 'XP Investimentos',
      notes: item.notes || undefined,
    }));
  } catch (err) {
    console.error('Erro ao buscar transações no Supabase:', err);
    return null;
  }
}

export async function upsertRemoteTransaction(tx: Transaction): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('transactions').upsert({
      id: tx.id,
      ticker: tx.ticker,
      date: tx.date,
      shares: tx.shares,
      price: tx.price,
      total: tx.total,
      broker: tx.broker,
      notes: tx.notes || null,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao salvar transação no Supabase:', err);
    return false;
  }
}

export async function deleteRemoteTransaction(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao deletar transação no Supabase:', err);
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

