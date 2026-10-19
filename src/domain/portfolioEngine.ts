import {
  Transaction,
  FiiPosition,
  PortfolioGoals,
  QuoteData,
  FixedIncomeAsset,
  UnifiedPortfolioSummary,
  BcbIndicators,
} from '../types/portfolio';
import { findFiiInfo } from '../data/fiiDatabase';
import { normalizeB3Ticker } from '../lib/ticker';

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

/** Explicit, auditable corporate action. Never infer a split from price or current NAV. */
export function normalizeTransactionForSplit(tx: Transaction, asOf = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })): { shares: number; price: number; total: number } {
  const shares = Math.abs(Number(tx.shares));
  const price = Math.abs(Number(tx.price));
  const total = Math.abs(Number(tx.total));
  const action = tx.splitAdjustment;
  const factor = action && action.source.trim() && action.effectiveDate > tx.date && action.effectiveDate <= asOf &&
    Number.isFinite(action.factor) && action.factor > 0 ? action.factor : 1;
  return { shares: shares * factor, price: price / factor, total: Number(total.toFixed(2)) };
}

const PT_SHORT_MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const PT_FULL_MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export interface DividendStaircaseMonth {
  yearMonth: string; // Ex: "2026-10"
  shortLabel: string; // Ex: "Out/26"
  fullLabel: string; // Ex: "Outubro de 2026"
  totalDividends: number;
  realB3Dividends: number;
  estimatedDividends: number;
  isOfficialB3: boolean;
  activeAssetsCount: number;
  totalSharesHeld: number;
  breakdown: {
    ticker: string;
    shares: number;
    amount: number;
    isRealB3: boolean;
  }[];
}

export interface DividendStaircaseSummary {
  months: DividendStaircaseMonth[];
  totalLifetimeDividends: number;
  totalRealB3Dividends: number;
  totalInvestedCapital: number;
  portfolioPaybackPercent: number;
  firstMonthDividends: number;
  latestMonthDividends: number;
  growthPercent: number;
}

/**
 * Gera a sequência de meses YYYY-MM entre startYm e endYm (inclusive)
 */
function buildMonthSequence(startYm: string, endYm: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(startYm) || !/^\d{4}-\d{2}$/.test(endYm)) {
    return [endYm];
  }
  const [startY, startM] = startYm.split('-').map(Number);
  const [endY, endM] = endYm.split('-').map(Number);

  const months: string[] = [];
  let y = startY;
  let m = startM;

  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (months.length > 1200) break; // Limite de segurança de 100 anos
  }

  return months.length > 0 ? months : [endYm];
}

/**
 * Motor Contábil Puro: Agrupa posições por FII e Ação respeitando a ordem cronológica (regra fiscal B3/IRPF)
 * Pode ser executado tanto no cliente (React) quanto no servidor (/api/widget)
 */
export function calculatePortfolioPositions(
  transactions: Transaction[],
  quotes: Record<string, QuoteData> = {},
  customDividends: Record<string, number> = {},
  currentYearMonth: string = ''
): FiiPosition[] {
  if (transactions.length === 0) {
    return [];
  }

  const map = new Map<string, { totalShares: number; totalInvested: number; avgPrice: number }>();

  const chronologicalTxs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const nowYm = currentYearMonth || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

  for (const tx of chronologicalTxs) {
    const cleanTicker = normalizeB3Ticker(tx.ticker);
    if (!cleanTicker) continue;

    if (tx.type === 'DIVIDEND') continue;

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
    const assetClass = info.assetClass || 'FII';
    const isStock = assetClass === 'ACAO';
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

    // Preço-Teto: 6% a.a. (0,50% a.m.) para Ações (Regra Barsi) ou 10,8% a.a. (0,90% a.m.) para FIIs
    const ceilingPrice = isStock
      ? Number(((monthlyDividendPerShare * 12) / 0.06).toFixed(2))
      : Number((monthlyDividendPerShare / 0.009).toFixed(2));

    const magicNumber =
      monthlyDividendPerShare > 0 ? Math.ceil(currentPrice / monthlyDividendPerShare) : 100;
    const magicProgressPercent = Math.min(
      100,
      Math.round((data.totalShares / magicNumber) * 100)
    );

    // Only ledger receipts, never extrapolated dividends.
    const paybackReceived = Number(chronologicalTxs
      .filter(tx => tx.type === 'DIVIDEND' && normalizeB3Ticker(tx.ticker) === ticker && tx.date.slice(0, 7) <= nowYm)
      .reduce((sum, tx) => sum + Math.abs(tx.total), 0).toFixed(2));
    const paybackPercent =
      data.totalInvested > 0
        ? Number(Math.min(100, (paybackReceived / data.totalInvested) * 100).toFixed(1))
        : 0;

    result.push({
      ticker,
      name: info.name,
      assetClass,
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
      paybackReceived,
      paybackPercent,
      dailyChangePercent: liveQuote?.changePercent,
      lastUpdated: liveQuote?.updatedAt,
      announcedDividendPerShare: liveQuote?.announcedDividendPerShare,
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
 * Calcula a "Escadinha de Dividendos" mês a mês desde o 1º aporte do usuário até o mês atual,
 * unindo proventos reais importados da aba Movimentação da B3 com a reconstrução histórica de cotas.
 */
export function calculateDividendStaircase(
  positions: FiiPosition[],
  transactions: Transaction[],
  currentYearMonth: string = ''
): DividendStaircaseSummary {
  const chronologicalTxs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const nowYm = currentYearMonth || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

  const validYms = chronologicalTxs
    .map((t) => (t.date && t.date.length >= 7 ? t.date.slice(0, 7) : ''))
    .filter((ym) => /^\d{4}-\d{2}$/.test(ym) && ym <= nowYm);

  const firstYm = validYms.length > 0 ? validYms[0] : nowYm;
  const monthSeq = buildMonthSequence(firstYm, nowYm);

  const positionDivMap = new Map<string, number>();
  for (const pos of positions) {
    positionDivMap.set(pos.ticker, pos.monthlyDividendPerShare);
  }

  const allTickers = Array.from(
    new Set([
      ...positions.map((p) => p.ticker),
      ...chronologicalTxs.map((t) => normalizeB3Ticker(t.ticker)).filter(Boolean),
    ])
  );

  const months: DividendStaircaseMonth[] = monthSeq.map((ym) => {
    const [yStr, mStr] = ym.split('-');
    const mIdx = Math.max(0, Math.min(11, parseInt(mStr, 10) - 1));
    const shortLabel = `${PT_SHORT_MONTHS[mIdx]}/${yStr.slice(2)}`;
    const fullLabel = `${PT_FULL_MONTHS[mIdx]} de ${yStr}`;

    let totalDividends = 0;
    let realB3Dividends = 0;
    const estimatedDividends = 0;
    let totalSharesHeld = 0;
    const breakdown: DividendStaircaseMonth['breakdown'] = [];

    for (const ticker of allTickers) {
      // 1. Verifica quantas cotas o usuário detinha até o fim deste mês (YYYY-MM)
      let sharesAtMonthEnd = 0;
      let realDivInMonth = 0;

      for (const tx of chronologicalTxs) {
        if (normalizeB3Ticker(tx.ticker) !== ticker) continue;
        const txYm = tx.date ? tx.date.slice(0, 7) : '';

        if (tx.type === 'DIVIDEND') {
          if (txYm === ym) {
            realDivInMonth += Math.abs(Number(tx.total));
          }
        } else if (txYm <= ym) {
          const norm = normalizeTransactionForSplit(tx);
          if (tx.type === 'SELL') {
            sharesAtMonthEnd = Math.max(0, sharesAtMonthEnd - norm.shares);
          } else {
            sharesAtMonthEnd += norm.shares;
          }
        }
      }

      totalSharesHeld += sharesAtMonthEnd;

      if (realDivInMonth > 0) {
        const amt = Number(realDivInMonth.toFixed(2));
        totalDividends += amt;
        realB3Dividends += amt;
        breakdown.push({
          ticker,
          shares: sharesAtMonthEnd,
          amount: amt,
          isRealB3: true,
        });
      }
    }

    breakdown.sort((a, b) => b.amount - a.amount);

    return {
      yearMonth: ym,
      shortLabel,
      fullLabel,
      totalDividends: Number(totalDividends.toFixed(2)),
      realB3Dividends: Number(realB3Dividends.toFixed(2)),
      estimatedDividends: Number(estimatedDividends.toFixed(2)),
      isOfficialB3: realB3Dividends > 0 && estimatedDividends === 0,
      activeAssetsCount: breakdown.length,
      totalSharesHeld,
      breakdown,
    };
  });

  const totalLifetimeDividends = Number(
    months.reduce((acc, m) => acc + m.totalDividends, 0).toFixed(2)
  );
  const totalRealB3Dividends = Number(
    months.reduce((acc, m) => acc + m.realB3Dividends, 0).toFixed(2)
  );
  const totalInvestedCapital = Number(
    positions.reduce((acc, p) => acc + p.totalInvested, 0).toFixed(2)
  );
  const portfolioPaybackPercent =
    totalInvestedCapital > 0
      ? Number(Math.min(100, (totalLifetimeDividends / totalInvestedCapital) * 100).toFixed(1))
      : 0;

  const nonZeroMonths = months.filter((m) => m.totalDividends > 0);
  const firstMonthDividends = nonZeroMonths.length > 0 ? nonZeroMonths[0].totalDividends : 0;
  const latestMonthDividends =
    months.length > 0 ? months[months.length - 1].totalDividends : 0;
  const growthPercent =
    firstMonthDividends > 0 && nonZeroMonths.length > 1
      ? Number((((latestMonthDividends - firstMonthDividends) / firstMonthDividends) * 100).toFixed(1))
      : 0;

  return {
    months,
    totalLifetimeDividends,
    totalRealB3Dividends,
    totalInvestedCapital,
    portfolioPaybackPercent,
    firstMonthDividends,
    latestMonthDividends,
    growthPercent,
  };
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
        .filter(
          (t) =>
            t.date.startsWith(currentYearMonth) &&
            (t.type === 'BUY' || !t.type)
        )
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

/**
 * Calcula o rendimento mensal líquido estimado (R$) de uma Caixinha / Título de Renda Fixa
 * usando os indicadores ao vivo do Banco Central (CDI, Selic e IPCA)
 */
export function calculateFixedIncomeMonthlyYield(
  asset: FixedIncomeAsset,
  bcbIndicators: BcbIndicators | null
): number {
  if (asset.currentBalance <= 0) return 0;

  let monthlyRatePercent = 0;

  if (asset.rateType === 'CDI') {
    // CDI Líquido padrão do Banco Central (com IR médio de 17.5%): ~0.71% a.m.
    const cdiNetMonthly = bcbIndicators?.cdiNetMonthly ?? 0.71;
    // Se isento de IR (LCI / LCA): usa CDI bruto mensal (~0.85% a.m.)
    const cdiGrossMonthly = bcbIndicators
      ? Number(((Math.pow(1 + bcbIndicators.cdiAnnual / 100, 1 / 12) - 1) * 100).toFixed(4))
      : 0.85;

    const baseRate = asset.isExempt ? cdiGrossMonthly : cdiNetMonthly;
    monthlyRatePercent = (asset.ratePercent / 100) * baseRate;
  } else if (asset.rateType === 'IPCA') {
    // IPCA médio mensal do BCB (~0.35% a.m.) + spread contratado
    const ipcaMonthly = bcbIndicators?.ipcaMonthly ?? 0.35;
    const spreadGrossAnnual = asset.ratePercent; // Ex: 6.0 (% a.a.)
    const spreadGrossMonthly = (Math.pow(1 + spreadGrossAnnual / 100, 1 / 12) - 1) * 100;
    const spreadNetMonthly = asset.isExempt ? spreadGrossMonthly : spreadGrossMonthly * 0.825;
    monthlyRatePercent = ipcaMonthly + spreadNetMonthly;
  } else if (asset.rateType === 'PREFIXADO') {
    // Taxa bruta anual convertida em mensal líquida
    const grossMonthly = (Math.pow(1 + asset.ratePercent / 100, 1 / 12) - 1) * 100;
    monthlyRatePercent = asset.isExempt ? grossMonthly : grossMonthly * 0.825;
  }

  const yieldAmount = asset.currentBalance * (monthlyRatePercent / 100);
  return Number(Math.max(0, yieldAmount).toFixed(2));
}

/**
 * Consolida o Patrimônio Unificado Global: FIIs + Ações + Renda Fixa / Caixinhas
 */
export function calculateUnifiedPortfolioSummary(
  positions: FiiPosition[],
  fixedIncomeAssets: FixedIncomeAsset[],
  bcbIndicators: BcbIndicators | null
): UnifiedPortfolioSummary {
  // 1. Bolsa (FIIs + Ações)
  const bolsaEquity = Number(
    positions.reduce((acc, p) => acc + p.currentTotal, 0).toFixed(2)
  );
  const bolsaInvested = Number(
    positions.reduce((acc, p) => acc + p.totalInvested, 0).toFixed(2)
  );
  const bolsaProfitLoss = Number((bolsaEquity - bolsaInvested).toFixed(2));
  const bolsaProfitLossPercent =
    bolsaInvested > 0 ? Number(((bolsaProfitLoss / bolsaInvested) * 100).toFixed(2)) : 0;
  const bolsaMonthlyDividends = Number(
    positions.reduce((acc, p) => acc + p.totalMonthlyDividend, 0).toFixed(2)
  );

  // 2. Renda Fixa & Caixinhas
  const fixedIncomeEquity = Number(
    fixedIncomeAssets.reduce((acc, a) => acc + a.currentBalance, 0).toFixed(2)
  );
  const fixedIncomeInvested = Number(
    fixedIncomeAssets.reduce((acc, a) => acc + a.investedAmount, 0).toFixed(2)
  );
  const fixedIncomeProfitLoss = Number(
    (fixedIncomeEquity - fixedIncomeInvested).toFixed(2)
  );
  const fixedIncomeMonthlyYield = Number(
    fixedIncomeAssets
      .reduce((acc, a) => acc + calculateFixedIncomeMonthlyYield(a, bcbIndicators), 0)
      .toFixed(2)
  );

  // 3. Consolidado Global
  const totalGlobalEquity = Number((bolsaEquity + fixedIncomeEquity).toFixed(2));
  const totalGlobalInvested = Number((bolsaInvested + fixedIncomeInvested).toFixed(2));
  const totalGlobalProfitLoss = Number((totalGlobalEquity - totalGlobalInvested).toFixed(2));
  const totalGlobalProfitLossPercent =
    totalGlobalInvested > 0
      ? Number(((totalGlobalProfitLoss / totalGlobalInvested) * 100).toFixed(2))
      : 0;
  const totalGlobalMonthlyIncome = Number(
    (bolsaMonthlyDividends + fixedIncomeMonthlyYield).toFixed(2)
  );

  // 4. Macro Classes
  const fiiPositions = positions.filter((p) => p.assetClass !== 'ACAO');
  const fiiEquity = Number(
    fiiPositions.reduce((acc, p) => acc + p.currentTotal, 0).toFixed(2)
  );
  const acaoPositions = positions.filter((p) => p.assetClass === 'ACAO');
  const acaoEquity = Number(
    acaoPositions.reduce((acc, p) => acc + p.currentTotal, 0).toFixed(2)
  );

  const fiiPercent =
    totalGlobalEquity > 0 ? Math.round((fiiEquity / totalGlobalEquity) * 100) : 0;
  const acaoPercent =
    totalGlobalEquity > 0 ? Math.round((acaoEquity / totalGlobalEquity) * 100) : 0;
  const fixedIncomePercent =
    totalGlobalEquity > 0 ? Math.max(0, 100 - fiiPercent - acaoPercent) : 0;

  return {
    bolsaEquity,
    bolsaInvested,
    bolsaProfitLoss,
    bolsaProfitLossPercent,
    bolsaMonthlyDividends,
    fixedIncomeEquity,
    fixedIncomeInvested,
    fixedIncomeProfitLoss,
    fixedIncomeMonthlyYield,
    totalGlobalEquity,
    totalGlobalInvested,
    totalGlobalProfitLoss,
    totalGlobalProfitLossPercent,
    totalGlobalMonthlyIncome,
    fiiEquity,
    fiiPercent,
    acaoEquity,
    acaoPercent,
    fixedIncomePercent,
  };
}


