import {
  Transaction,
  FiiPosition,
  PortfolioGoals,
  QuoteData,
} from '../types/portfolio';
import { findFiiInfo } from '../data/fiiDatabase';
import { normalizeB3Ticker } from '../lib/b3Parser';

export interface PortfolioSummaryData {
  totalInvested: number;
  currentEquity: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  totalMonthlyDividends: number;
  averageYieldOnCostPercent: number;
  currentMonthInvested: number;
  monthlyGoalProgressPercent: number;
  equityGoalProgressPercent: number;
  incomeGoalProgressPercent: number;
}

// Fatores de desdobramento conhecidos na B3 (ex: 1:10 ou 1:8) para normalizar compras antigas pré-split
const HISTORICAL_SPLIT_FACTORS: Record<string, number> = {
  BCFF11: 8,
  CPTS11: 10,
  GALG11: 10,
  HGBS11: 10,
  ALZR11: 10,
  GGRC11: 10,
  KNSC11: 10,
  VIUR11: 10,
  VINO11: 5,
  RBVA11: 10,
  BTCI11: 10,
};

/**
 * Normaliza uma transação caso ela tenha sido registrada na B3 antes de um desdobramento (Split Base 100 -> Base 10)
 */
export function normalizeTransactionForSplit(tx: Transaction): {
  shares: number;
  price: number;
  total: number;
} {
  const cleanTicker = normalizeB3Ticker(tx.ticker);
  const info = findFiiInfo(cleanTicker);
  const absShares = Math.abs(Number(tx.shares));
  const absPrice = Math.abs(Number(tx.price));
  const absTotal = Math.abs(Number(tx.total)) || Number((absShares * absPrice).toFixed(2));

  // Se o fundo hoje é Base 10 (VP <= 25) mas a compra na planilha da B3 foi feita no preço antigo pré-split (ex: R$ 95,00)
  if (info.base === 10 && info.vp <= 25 && absPrice >= info.vp * 4.5) {
    const factor = HISTORICAL_SPLIT_FACTORS[cleanTicker] || 10;
    const adjustedShares = Math.round(absShares * factor);
    const adjustedPrice = Number((absPrice / factor).toFixed(2));
    return {
      shares: adjustedShares,
      price: adjustedPrice,
      total: Number(absTotal.toFixed(2)),
    };
  }

  return {
    shares: absShares,
    price: absPrice,
    total: Number(absTotal.toFixed(2)),
  };
}

/**
 * Motor Contábil Puro: Agrupa posições por FII respeitando a ordem cronológica (regra fiscal B3/IRPF)
 * Pode ser executado tanto no cliente (React) quanto no servidor (/api/widget)
 */
export function calculatePortfolioPositions(
  transactions: Transaction[],
  quotes: Record<string, QuoteData> = {},
  customDividends: Record<string, number> = {}
): FiiPosition[] {
  const map = new Map<string, { totalShares: number; totalInvested: number; avgPrice: number }>();

  const chronologicalTxs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of chronologicalTxs) {
    const cleanTicker = normalizeB3Ticker(tx.ticker);
    if (!cleanTicker) continue;

    const normalized = normalizeTransactionForSplit(tx);
    const current = map.get(cleanTicker) || { totalShares: 0, totalInvested: 0, avgPrice: 0 };
    const isSell = tx.type === 'SELL';

    if (isSell) {
      const soldShares = Math.min(current.totalShares, normalized.shares);
      current.totalShares = Math.max(0, current.totalShares - soldShares);
      // Na venda, o Preço Médio fiscal não se altera; reduz-se o custo proporcionalmente
      current.totalInvested = Number((current.totalShares * current.avgPrice).toFixed(2));
    } else {
      current.totalShares += normalized.shares;
      current.totalInvested += normalized.total;
      current.avgPrice =
        current.totalShares > 0 ? current.totalInvested / current.totalShares : 0;
    }

    map.set(cleanTicker, current);
  }

  const result: FiiPosition[] = [];

  for (const [ticker, data] of map.entries()) {
    if (data.totalShares <= 0) continue;

    const info = findFiiInfo(ticker);
    const averagePrice = Number(data.avgPrice.toFixed(2));
    const liveQuote = quotes[ticker];
    const currentPrice = liveQuote?.price ? liveQuote.price : averagePrice;
    const currentTotal = Number((data.totalShares * currentPrice).toFixed(2));
    const profitLoss = Number((currentTotal - data.totalInvested).toFixed(2));
    const profitLossPercent =
      data.totalInvested > 0
        ? Number(((profitLoss / data.totalInvested) * 100).toFixed(2))
        : 0;

    // Prioridade: 1) Dividendo customizado, 2) Último dividendo oficial B3 via API, 3) Catálogo
    const hasCustomDiv = customDividends[ticker] !== undefined;
    const hasLiveDiv = Boolean(liveQuote?.lastDividend && liveQuote.lastDividend > 0);

    const monthlyDividendPerShare = hasCustomDiv
      ? customDividends[ticker]
      : hasLiveDiv
      ? Number((liveQuote!.lastDividend || 0).toFixed(3))
      : info.estimatedMonthlyDividend;

    const dividendSource: FiiPosition['dividendSource'] = hasCustomDiv
      ? 'MANUAL'
      : hasLiveDiv
      ? liveQuote?.dividendSource || 'MERCADO'
      : 'CATALOGO';

    const totalMonthlyDividend = Number((data.totalShares * monthlyDividendPerShare).toFixed(2));

    const vp = liveQuote?.vp || info.vp || currentPrice;
    const pvp = vp > 0 ? Number((currentPrice / vp).toFixed(2)) : 1.0;

    const currentYieldPercent =
      currentPrice > 0 ? Number(((monthlyDividendPerShare / currentPrice) * 100).toFixed(2)) : 0;
    const yieldOnCostPercent =
      averagePrice > 0 ? Number(((monthlyDividendPerShare / averagePrice) * 100).toFixed(2)) : 0;
    const ceilingPrice = Number((monthlyDividendPerShare / 0.009).toFixed(2));

    const magicNumber =
      monthlyDividendPerShare > 0 ? Math.ceil(currentPrice / monthlyDividendPerShare) : 100;
    const magicProgressPercent = Math.min(
      100,
      Math.round((data.totalShares / magicNumber) * 100)
    );

    result.push({
      ticker,
      name: info.name,
      segment: info.segment,
      base: info.base,
      vp,
      pvp,
      totalShares: data.totalShares,
      averagePrice,
      totalInvested: Number(data.totalInvested.toFixed(2)),
      currentPrice,
      currentTotal,
      profitLoss,
      profitLossPercent,
      monthlyDividendPerShare,
      totalMonthlyDividend,
      currentYieldPercent,
      yieldOnCostPercent,
      ceilingPrice,
      magicNumber,
      magicProgressPercent,
      dailyChangePercent: liveQuote?.changePercent,
      lastUpdated: liveQuote?.updatedAt,
      dividendExDate: liveQuote?.dividendExDate,
      dividendPaymentDate: liveQuote?.dividendPaymentDate,
      dividendPaymentDay: liveQuote?.dividendPaymentDay,
      isCurrentMonthAnnounced: liveQuote?.isCurrentMonthAnnounced,
      dividendSource,
    });
  }

  return result.sort((a, b) => b.currentTotal - a.currentTotal);
}

/**
 * Calcula os indicadores gerais da carteira a partir das posições e metas
 */
export function calculatePortfolioSummary(
  positions: FiiPosition[],
  transactions: Transaction[],
  goals: PortfolioGoals,
  currentYearMonth: string
): PortfolioSummaryData {
  const totalInvested = positions.reduce((acc, p) => acc + p.totalInvested, 0);
  const currentEquity = positions.reduce((acc, p) => acc + p.currentTotal, 0);
  const totalProfitLoss = Number((currentEquity - totalInvested).toFixed(2));
  const totalProfitLossPercent =
    totalInvested > 0 ? Number(((totalProfitLoss / totalInvested) * 100).toFixed(2)) : 0;
  const totalMonthlyDividends = Number(
    positions.reduce((acc, p) => acc + p.totalMonthlyDividend, 0).toFixed(2)
  );
  const averageYieldOnCostPercent =
    totalInvested > 0 ? Number(((totalMonthlyDividends / totalInvested) * 100).toFixed(2)) : 0;

  const currentMonthInvested = currentYearMonth
    ? transactions
        .filter((t) => t.date.startsWith(currentYearMonth) && t.type !== 'SELL')
        .reduce((acc, t) => acc + t.total, 0)
    : 0;

  const monthlyGoalProgressPercent = Math.min(
    100,
    Math.round((currentMonthInvested / (goals.monthlyTarget || 200)) * 100)
  );

  const equityGoalProgressPercent = Math.min(
    100,
    Math.round((currentEquity / (goals.milestoneEquityTarget || 1000)) * 100)
  );

  const incomeGoalProgressPercent = Math.min(
    100,
    Math.round((totalMonthlyDividends / (goals.monthlyIncomeTarget || 10)) * 100)
  );

  return {
    totalInvested: Number(totalInvested.toFixed(2)),
    currentEquity: Number(currentEquity.toFixed(2)),
    totalProfitLoss,
    totalProfitLossPercent,
    totalMonthlyDividends,
    averageYieldOnCostPercent,
    currentMonthInvested: Number(currentMonthInvested.toFixed(2)),
    monthlyGoalProgressPercent,
    equityGoalProgressPercent,
    incomeGoalProgressPercent,
  };
}

