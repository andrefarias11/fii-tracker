import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  Transaction,
  FixedIncomeAsset,
  QuoteData,
  BcbIndicators,
} from '../../../types/portfolio';
import {
  calculatePortfolioPositions,
  calculateUnifiedPortfolioSummary,
} from '../../../domain/portfolioEngine';
import { normalizeB3Ticker } from '../../../lib/b3Parser';
import { getSupabaseConfig } from '../../../lib/supabase';
import {
  verifyAdminToken,
  extractAdminTokenFromRequest,
} from '../../../lib/adminAuth';

export interface AdminAccountOverview {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt?: string;
  lastSignInAt?: string;
  bolsaEquity: number;
  bolsaInvested: number;
  bolsaProfitLoss: number;
  bolsaProfitLossPercent: number;
  fixedIncomeEquity: number;
  totalGlobalEquity: number;
  totalMonthlyDividends: number;
  positionsCount: number;
  fixedIncomeCount: number;
  transactionsCount: number;
  positions: {
    ticker: string;
    totalShares: number;
    currentPrice: number;
    currentTotal: number;
    totalMonthlyDividend: number;
    averagePrice: number;
    profitLoss: number;
    profitLossPercent: number;
  }[];
  fixedIncome: FixedIncomeAsset[];
}

export interface AdminDashboardData {
  accounts: AdminAccountOverview[];
  globalKpis: {
    totalCustodyEquity: number;
    totalBolsaEquity: number;
    totalFixedIncomeEquity: number;
    totalMonthlyDividends: number;
    totalActiveAccounts: number;
    totalTransactions: number;
  };
  updatedAt: string;
}

export async function GET(request: Request) {
  try {
    // 0. Proteção Estrita: Verifica autenticação administrativa
    const token = extractAdminTokenFromRequest(request);
    if (!verifyAdminToken(token)) {
      return NextResponse.json(
        { error: 'Acesso não autorizado. Faça login com usuário e senha de administrador.' },
        { status: 401 }
      );
    }

    const { origin } = new URL(request.url);
    const { url, key } = getSupabaseConfig();

    if (!url || !key) {
      return NextResponse.json(
        { error: 'Credenciais do Supabase não configuradas' },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let rawAccounts: any[] = [];
    let usedRpc = false;

    // 1. Tenta chamar a RPC get_admin_accounts_overview
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_admin_accounts_overview'
      );
      if (!rpcError && Array.isArray(rpcData)) {
        rawAccounts = rpcData;
        usedRpc = true;
      }
    } catch {
      usedRpc = false;
    }

    // 2. Fallback seguro caso a RPC falhe ou não exista
    if (!usedRpc || rawAccounts.length === 0) {
      const [txsRes, fiRes, goalsRes, divsRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('fixed_income_assets').select('*'),
        supabase.from('portfolio_goals').select('*'),
        supabase.from('custom_dividends').select('*'),
      ]);

      const txs = txsRes.data || [];
      const fi = fiRes.data || [];
      const goals = goalsRes.data || [];

      // Agrupa registros por user_id
      const userMap = new Map<string, any>();

      // Adiciona contas encontradas em transações
      for (const t of txs) {
        const uid = t.user_id || 'legacy_primary';
        if (!userMap.has(uid)) {
          userMap.set(uid, {
            user_id: uid,
            email: uid === 'legacy_primary' ? 'Conta Principal (Legada)' : `${uid.slice(0, 8)}@fii-tracker.local`,
            display_name: uid === 'legacy_primary' ? 'Conta Principal' : `Investidor (${uid.slice(0, 8)})`,
            transactions: [],
            fixed_income: [],
            goals: null,
          });
        }
        userMap.get(uid).transactions.push(t);
      }

      // Adiciona caixinhas
      for (const f of fi) {
        const uid = f.user_id || 'legacy_primary';
        if (!userMap.has(uid)) {
          userMap.set(uid, {
            user_id: uid,
            email: uid === 'legacy_primary' ? 'Conta Principal (Legada)' : `${uid.slice(0, 8)}@fii-tracker.local`,
            display_name: uid === 'legacy_primary' ? 'Conta Principal' : `Investidor (${uid.slice(0, 8)})`,
            transactions: [],
            fixed_income: [],
            goals: null,
          });
        }
        userMap.get(uid).fixed_income.push(f);
      }

      rawAccounts = Array.from(userMap.values());
    }

    // 3. Coleta todos os tickers presentes nas carteiras para cotações ao vivo
    const allTickersSet = new Set<string>();
    for (const acc of rawAccounts) {
      const txList = Array.isArray(acc.transactions) ? acc.transactions : [];
      for (const tx of txList) {
        const clean = normalizeB3Ticker(tx.ticker);
        if (clean) allTickersSet.add(clean);
      }
    }

    const uniqueTickers = Array.from(allTickersSet);

    // 4. Busca cotações e indicadores do BCB em tempo real
    let quotesMap: Record<string, QuoteData> = {};
    let bcbIndicators: BcbIndicators | null = null;

    try {
      const [quoteRes, bcbRes] = await Promise.all([
        uniqueTickers.length > 0
          ? fetch(`${origin}/api/quote?tickers=${encodeURIComponent(uniqueTickers.join(','))}`, {
              cache: 'no-store',
            }).catch(() => null)
          : null,
        fetch(`${origin}/api/bcb`, { cache: 'no-store' }).catch(() => null),
      ]);

      if (quoteRes && quoteRes.ok) {
        const qData = await quoteRes.json();
        quotesMap = qData.quotes || {};
      }
      if (bcbRes && bcbRes.ok) {
        bcbIndicators = await bcbRes.json();
      }
    } catch {
      // Continua com cotações padrão
    }

    const currentYearMonth = new Date().toISOString().slice(0, 7);

    // 5. Calcula métricas contábeis para cada conta
    const accountsOverview: AdminAccountOverview[] = rawAccounts.map((acc: any) => {
      const rawTxs = Array.isArray(acc.transactions) ? acc.transactions : [];
      const rawFi = Array.isArray(acc.fixed_income) ? acc.fixed_income : [];

      const normalizedTxs: Transaction[] = rawTxs.map((t: any) => ({
        id: t.id,
        ticker: String(t.ticker || '').toUpperCase().trim(),
        type: t.type === 'SELL' ? 'SELL' : t.type === 'DIVIDEND' ? 'DIVIDEND' : 'BUY',
        date: t.date || new Date().toISOString().slice(0, 10),
        shares: Math.abs(Number(t.shares || 0)),
        price: Math.abs(Number(t.price || 0)),
        total: Math.abs(Number(t.total || 0)),
        broker: t.broker || 'XP Investimentos',
        notes: t.notes || undefined,
      }));

      const normalizedFi: FixedIncomeAsset[] = rawFi.map((f: any) => ({
        id: f.id,
        name: f.name || 'Aplicação Renda Fixa',
        type: f.type || 'CAIXINHA',
        institution: f.institution || 'Banco',
        investedAmount: Number(f.invested_amount || 0),
        currentBalance: Number(f.current_balance || 0),
        rateType: f.rate_type || 'CDI',
        ratePercent: Number(f.rate_percent || 100),
        isExempt: Boolean(f.is_exempt),
        maturityDate: f.maturity_date || undefined,
        notes: f.notes || undefined,
        updatedAt: f.updated_at || new Date().toISOString().slice(0, 10),
      }));

      const positions = calculatePortfolioPositions(
        normalizedTxs,
        quotesMap,
        {},
        currentYearMonth
      );

      const unified = calculateUnifiedPortfolioSummary(
        positions,
        normalizedFi,
        bcbIndicators
      );

      return {
        userId: acc.user_id,
        email: acc.email || `${acc.user_id.slice(0, 8)}@fii-tracker.com`,
        displayName: acc.display_name || acc.email?.split('@')[0] || 'Investidor',
        avatarUrl: acc.avatar_url || undefined,
        createdAt: acc.created_at || undefined,
        lastSignInAt: acc.last_sign_in_at || undefined,
        bolsaEquity: unified.bolsaEquity,
        bolsaInvested: unified.bolsaInvested,
        bolsaProfitLoss: unified.bolsaProfitLoss,
        bolsaProfitLossPercent: unified.bolsaProfitLossPercent,
        fixedIncomeEquity: unified.fixedIncomeEquity,
        totalGlobalEquity: unified.totalGlobalEquity,
        totalMonthlyDividends: unified.totalGlobalMonthlyIncome,
        positionsCount: positions.length,
        fixedIncomeCount: normalizedFi.length,
        transactionsCount: normalizedTxs.length,
        positions: positions.map((p) => ({
          ticker: p.ticker,
          totalShares: p.totalShares,
          currentPrice: p.currentPrice,
          currentTotal: p.currentTotal,
          totalMonthlyDividend: p.totalMonthlyDividend,
          averagePrice: p.averagePrice,
          profitLoss: p.profitLoss,
          profitLossPercent: p.profitLossPercent,
        })),
        fixedIncome: normalizedFi,
      };
    });

    // 6. Calcula KPIs Globais da Plataforma
    const globalKpis = {
      totalCustodyEquity: Number(
        accountsOverview.reduce((acc, a) => acc + a.totalGlobalEquity, 0).toFixed(2)
      ),
      totalBolsaEquity: Number(
        accountsOverview.reduce((acc, a) => acc + a.bolsaEquity, 0).toFixed(2)
      ),
      totalFixedIncomeEquity: Number(
        accountsOverview.reduce((acc, a) => acc + a.fixedIncomeEquity, 0).toFixed(2)
      ),
      totalMonthlyDividends: Number(
        accountsOverview.reduce((acc, a) => acc + a.totalMonthlyDividends, 0).toFixed(2)
      ),
      totalActiveAccounts: accountsOverview.length,
      totalTransactions: accountsOverview.reduce((acc, a) => acc + a.transactionsCount, 0),
    };

    const responseData: AdminDashboardData = {
      accounts: accountsOverview,
      globalKpis,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_') || err?.message?.includes('bail out of prerendering')) {
      throw err;
    }
    console.error('Erro no endpoint /api/admin:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno no servidor administrativo' },
      { status: 500 }
    );
  }
}
