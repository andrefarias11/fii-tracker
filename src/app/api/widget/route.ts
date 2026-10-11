import { NextResponse } from 'next/server';
import { findFiiInfo, FII_DATABASE } from '../../../data/fiiDatabase';
import { QuoteData } from '../../../types/portfolio';

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

function parsePortfolioParam(param: string | null): ParsedHolding[] {
  if (!param || !param.trim()) {
    return [
      { ticker: 'MXRF11', shares: 11, avgPrice: 9.42 },
      { ticker: 'VGIR11', shares: 10, avgPrice: 9.6 },
    ];
  }

  const holdings: ParsedHolding[] = [];
  const entries = param.split(',');
  for (const entry of entries) {
    const [rawTicker, rawShares, rawAvg] = entry.split(':');
    const ticker = (rawTicker || '').trim().toUpperCase();
    const shares = parseFloat(rawShares || '0');
    const avgPrice = parseFloat(rawAvg || '0');
    if (ticker && shares > 0) {
      holdings.push({
        ticker,
        shares,
        avgPrice: avgPrice > 0 ? avgPrice : findFiiInfo(ticker).vp,
      });
    }
  }

  return holdings;
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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const holdings = parsePortfolioParam(searchParams.get('p'));
  const incomeGoal = Math.max(1, parseFloat(searchParams.get('goal') || '10'));

  const radarTickers = ['MXRF11', 'VGIR11', 'CPTS11', 'KISU11', 'GALG11', 'XPML11', 'BTLG11', 'KNCR11'];
  const allTickers = Array.from(
    new Set([...holdings.map((h) => h.ticker), ...radarTickers])
  );

  let quotesMap: Record<string, QuoteData> = {};
  try {
    const quoteRes = await fetch(
      `${origin}/api/quote?tickers=${encodeURIComponent(allTickers.join(','))}`,
      { next: { revalidate: 300 } }
    );
    if (quoteRes.ok) {
      const data = await quoteRes.json();
      quotesMap = data.quotes || {};
    }
  } catch {
    // Fallback silencioso para catálogo caso offline
  }

  let equity = 0;
  let invested = 0;
  let monthlyIncome = 0;
  let nextEvent = 'Aguardando próximos anúncios B3';
  let bestDaysUntil = 999;

  const now = new Date();
  const todayDay = now.getDate();

  for (const h of holdings) {
    const info = findFiiInfo(h.ticker);
    const live = quotesMap[h.ticker];
    const currentPrice = live?.price || h.avgPrice || info.vp;
    const divPerShare =
      live?.lastDividend && live.lastDividend > 0
        ? live.lastDividend
        : info.estimatedMonthlyDividend;

    const posInvested = h.shares * h.avgPrice;
    const posEquity = h.shares * currentPrice;
    const posDiv = h.shares * divPerShare;

    invested += posInvested;
    equity += posEquity;
    monthlyIncome += posDiv;

    const payDay = live?.dividendPaymentDay || info.paymentDay || 15;
    const distance = payDay >= todayDay ? payDay - todayDay : 30 - todayDay + payDay;

    if (distance < bestDaysUntil) {
      bestDaysUntil = distance;
      const payLabel = live?.dividendPaymentDate
        ? live.dividendPaymentDate.slice(0, 5)
        : `dia ${payDay}`;
      const confirmedBadge = live?.isCurrentMonthAnnounced ? '✓' : 'est.';
      nextEvent = `${h.ticker}: R$ ${posDiv.toFixed(2).replace('.', ',')} (${payLabel} ${confirmedBadge})`;
    }
  }

  // Encontrar a melhor oportunidade/barganha na B3 hoje para exibir no Widget
  let topBargain = 'Mercado estável no momento';
  let bestBargainScore = -999;

  for (const cat of FII_DATABASE) {
    const q = quotesMap[cat.ticker];
    const price = q?.price || cat.vp;
    const vp = q?.vp || cat.vp;
    const div = q?.lastDividend && q.lastDividend > 0 ? q.lastDividend : cat.estimatedMonthlyDividend;
    const pvp = vp > 0 ? price / vp : 1;
    const dy = price > 0 ? (div / price) * 100 : 0;

    if (pvp <= 0.99 && dy >= 0.8) {
      const score = (1 - pvp) * 100 + dy * 12;
      if (score > bestBargainScore) {
        bestBargainScore = score;
        topBargain = `${cat.ticker} R$ ${price.toFixed(2).replace('.', ',')} (P/VP ${pvp.toFixed(2).replace('.', ',')} • DY ${dy.toFixed(2).replace('.', ',')}%)`;
      }
    }
  }

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
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

