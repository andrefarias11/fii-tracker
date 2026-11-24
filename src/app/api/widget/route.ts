import { calculateMonthDividends } from '../../../data/fiiDividendCalendar';
import { evaluateAllFiis } from '../../../lib/recommendationEngine';
import { createHash, randomBytes } from 'node:crypto';
import { protectedApi, serverDatabase, authenticateRequest, consumeRateLimit } from '../../../lib/serverSecurity';
import { Transaction, FixedIncomeAsset } from '../../../types/portfolio';
import { NextResponse } from 'next/server';
import { QuoteData, BcbIndicators } from '../../../types/portfolio';
import { calculatePortfolioPositions, calculateUnifiedPortfolioSummary } from '../../../domain/portfolioEngine';
import { unscopeIdFromUser } from '../../../lib/supabase';


export interface WidgetSummaryResponse {
  equity: number;
  invested: number;
  profit: number;
  profitPct: number;
  monthlyIncome: number;
  incomeGoal: number;
  incomeGoalPct: number;
  yocPct: number;
  positionsCount: number;
  nextEvent: string;
  topBargain: string;
  marketOpen: boolean;
  updatedAt: string;
}

interface ParsedHolding {
  ticker: string;
  shares: number;
  avgPrice: number;
}

function isB3MarketOpenNow(): boolean {
  try {
    const nowBr = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
    );
    const day = nowBr.getDay(); // 0 = Dom, 6 = Sáb
    const hour = nowBr.getHours();
    return day >= 1 && day <= 5 && hour >= 10 && hour < 18;
  } catch {
    return true;
  }
}

function getBrasiliaTimeHHMM(): string {
  try {
    return new Date().toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date().toISOString().slice(11, 16);
  }
}

// One read-only credential per account. Issuing a new token revokes the previous one.
export async function POST(request: Request) {
  const access = await protectedApi(request, 'widget-token', 10);
  if (access.response) return access.response;
  const token = randomBytes(32).toString('hex');
  const { error } = await serverDatabase().from('widget_tokens').upsert({
    user_id: access.user.id, token_hash: createHash('sha256').update(token).digest('hex'), created_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: 'Não foi possível criar o widget.' }, { status: 503 });
  return NextResponse.json({ token }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function DELETE(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  const { error } = await serverDatabase().from('widget_tokens').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 });
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: 'Widget não autorizado.' }, { status: 401 });
  const transactions: Transaction[] = [];
  const fixedIncomeAssets: FixedIncomeAsset[] = [];
  let remoteDivs: Record<string, number> = {};
  let incomeGoal = 10;
  try {
    const db = serverDatabase();
    const { data: credential, error } = await db.from('widget_tokens').select('user_id').eq('token_hash', createHash('sha256').update(token).digest('hex')).maybeSingle();
    if (error || !credential) return NextResponse.json({ error: 'Token expirado ou revogado.' }, { status: 401 });
    if (!await consumeRateLimit(`widget:${credential.user_id}`, 120, 3600)) return NextResponse.json({ error: 'Aguarde.' }, { status: 429 });
    for (let offset = 0; ; offset += 1000) {
      const page = await db.from('transactions').select('*').eq('user_id', credential.user_id).order('id').range(offset, offset + 999);
      if (page.error) throw new Error('Consulta indisponível');
      for (const row of page.data || []) {
        const rawShares = Number(row.shares || 0);
        const notesStr = String(row.notes || '');
        const idStr = String(row.id || '');
        const dbType = row.type as 'BUY' | 'SELL' | 'DIVIDEND' | undefined;
        const isDiv = dbType === 'DIVIDEND' || idStr.includes('b3-div-') || notesStr.startsWith('[PROVENTO B3]');
        const isSell = dbType === 'SELL' || (!isDiv && rawShares < 0);
        transactions.push({
          id: unscopeIdFromUser(idStr, credential.user_id),
          ticker: String(row.ticker || '').toUpperCase().trim(),
          type: dbType === 'BUY' || dbType === 'SELL' || dbType === 'DIVIDEND' ? dbType : isDiv ? 'DIVIDEND' : isSell ? 'SELL' : 'BUY',
          date: String(row.date || ''),
          shares: Math.abs(rawShares),
          price: Math.abs(Number(row.price || 0)),
          total: Math.abs(Number(row.total || 0)),
          broker: String(row.broker || 'XP Investimentos'),
          notes: row.notes || undefined,
          splitAdjustment: row.split_adjustment || undefined,
        });
      }
      if ((page.data?.length || 0) < 1000) break;
    }
    const [goals, divs, fiRes] = await Promise.all([
      db.from('portfolio_goals').select('monthly_income_target').eq('user_id', credential.user_id).maybeSingle(),
      db.from('custom_dividends').select('ticker,dividend').eq('user_id', credential.user_id),
      db.from('fixed_income_assets').select('*').eq('user_id', credential.user_id),
    ]);
    if (goals.error || divs.error) throw new Error('Consulta indisponível');
    remoteDivs = Object.fromEntries((divs.data || []).map(d => [d.ticker, Number(d.dividend)]));
    for (const f of fiRes.data || []) {
      fixedIncomeAssets.push({
        id: unscopeIdFromUser(String(f.id || ''), credential.user_id),
        name: String(f.name || 'Renda Fixa'),
        type: f.type || 'CAIXINHA',
        institution: String(f.institution || 'Banco'),
        investedAmount: Number(f.invested_amount || 0),
        currentBalance: Number(f.current_balance || 0),
        rateType: f.rate_type || 'CDI',
        ratePercent: Number(f.rate_percent ?? 100),
        isExempt: Boolean(f.is_exempt),
        maturityDate: f.maturity_date || undefined,
        notes: f.notes || undefined,
        updatedAt: String(f.updated_at || ''),
      });
    }
    incomeGoal = Number(goals.data?.monthly_income_target) || 10;
  } catch {
    return NextResponse.json({ error: 'Widget indisponível. Verifique a configuração segura.' }, { status: 503 });
  }

  const basePositions = calculatePortfolioPositions(transactions, {}, remoteDivs);
  const holdings: ParsedHolding[] = basePositions.map(p => ({ ticker: p.ticker, shares: p.totalShares, avgPrice: p.averagePrice }));

  const radarTickers = [
    'MXRF11',
    'VGIR11',
    'CPTS11',
    'KISU11',
    'GALG11',
    'XPML11',
    'BTLG11',
    'KNCR11',
  ];
  const allTickers = Array.from(
    new Set([...holdings.map((h) => h.ticker), ...radarTickers])
  );

  const quotesMap: Record<string, QuoteData> = {};
  let bcbIndicators: BcbIndicators | null = null;
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < allTickers.length; i += 25) {
      chunks.push(allTickers.slice(i, i + 25));
    }
    const [quoteResults, bcbRes] = await Promise.all([
      Promise.allSettled(
        chunks.map((chunk) =>
          fetch(`${origin}/api/quote?tickers=${encodeURIComponent(chunk.join(','))}`, { cache: 'no-store' })
        )
      ),
      fixedIncomeAssets.length > 0 ? fetch(`${origin}/api/bcb`, { cache: 'no-store' }).catch(() => null) : Promise.resolve(null),
    ]);
    for (const res of quoteResults) {
      if (res.status === 'fulfilled' && res.value.ok) {
        const data = await res.value.json();
        if (data.quotes) Object.assign(quotesMap, data.quotes);
      }
    }
    if (bcbRes && bcbRes.ok) {
      bcbIndicators = await bcbRes.json();
    }
  } catch {
    // Fallback silencioso para catálogo caso offline
  }

  const positions = calculatePortfolioPositions(transactions, quotesMap, remoteDivs);
  const unified = calculateUnifiedPortfolioSummary(positions, fixedIncomeAssets, bcbIndicators);
  const equity = unified.totalGlobalEquity;
  const invested = unified.totalGlobalInvested;
  const monthlyIncome = unified.totalGlobalMonthlyIncome;

  const calendar = calculateMonthDividends(positions, new Date(), {}, transactions);
  const event = calendar.events.find(item => item.status !== 'PAID');
  const nextEvent = event
    ? `${event.ticker}: R$ ${event.totalValue.toFixed(2).replace('.', ',')} (${event.paymentDateFormatted} ${event.status === 'CONFIRMED' ? 'anunciado' : 'estimativa'})`
    : 'Sem pagamento pendente neste mês';

  // Encontrar a melhor oportunidade/barganha na B3 hoje para exibir no Widget
  const candidate = evaluateAllFiis(quotesMap).find(f => !f.isDistressedWarning && f.qualityTier !== 'ALERTA_RISCO' && Boolean(quotesMap[f.ticker]?.price) && f.status === 'OPPORTUNITY');
  const topBargain = candidate ? `${candidate.ticker} • P/VP ${candidate.pvp}` : 'Sem oportunidade elegível';

  const profit = Number((equity - invested).toFixed(2));
  const profitPct = invested > 0 ? Number(((profit / invested) * 100).toFixed(2)) : 0;
  const yocPct = invested > 0 ? Number(((monthlyIncome / invested) * 100).toFixed(2)) : 0;
  const incomeGoalPct = Math.min(100, Math.round((monthlyIncome / incomeGoal) * 100));

  const payload: WidgetSummaryResponse = {
    equity: Number(equity.toFixed(2)),
    invested: Number(invested.toFixed(2)),
    profit,
    profitPct,
    monthlyIncome: Number(monthlyIncome.toFixed(2)),
    incomeGoal: Number(incomeGoal.toFixed(2)),
    incomeGoalPct,
    yocPct,
    positionsCount: holdings.length,
    nextEvent,
    topBargain,
    marketOpen: isB3MarketOpenNow(),
    updatedAt: getBrasiliaTimeHHMM(),
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
