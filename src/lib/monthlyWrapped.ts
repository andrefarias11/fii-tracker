import { FiiPosition, Transaction } from '../types/portfolio';
import {
  calculateDividendStaircase,
  normalizeTransactionForSplit,
} from '../domain/portfolioEngine';
import { normalizeB3Ticker } from './ticker';
import { findFiiInfo } from '../data/fiiDatabase';

export interface MonthlyWrappedData {
  monthKey: string; // YYYY-MM
  monthName: string; // "Outubro"
  year: number; // 2026
  fullLabel: string; // "Outubro de 2026"
  isCurrentMonth: boolean;
  hasActivity: boolean; // Se teve aporte ou dividendo

  // 1. Proventos
  totalDividends: number;
  previousMonthDividends: number;
  dividendGrowthPercent: number; // Crescimento % vs mês anterior
  topDividendAsset: {
    ticker: string;
    amount: number;
    shares: number;
    isOfficialB3: boolean;
  } | null;
  allDividendsBreakdown: Array<{
    ticker: string;
    amount: number;
    shares: number;
  }>;

  // 2. Aportes & Cotas
  totalInvested: number;
  totalSharesBought: number;
  distinctAssetsBoughtCount: number;
  topBoughtAsset: {
    ticker: string;
    shares: number;
    totalInvested: number;
  } | null;
  boughtAssetsList: string[];

  // 3. Efeito Bola de Neve
  snowballGrowthPercent: number; // Avanço da bola de neve no mês
  monthlyGoalCoveragePercent: number; // Quanto o dividendo pagou da meta mensal (ex: R$ 200)
  magicNumberLeader: {
    ticker: string;
    currentShares: number;
    magicNumber: number;
    progressPercent: number;
  } | null;

  // 4. Equivalências da Vida Real (Metáforas que tocam o investidor)
  coffeeCupsPaid: number; // Cafés de R$ 7,50
  energyBillPaidPercent: number; // % de conta básica de R$ 100

  // 5. Frase do Mês
  quote: {
    text: string;
    author: string;
  };
}

const PT_MONTHS = [
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

const INSPIRATIONAL_QUOTES = [
  {
    text: 'O dividendo é a única certeza matemática no mercado. O patrimônio oscila, a renda pinga todo mês.',
    author: 'Luiz Barsi Filho',
  },
  {
    text: 'Não compre fundos pensando no valor da cota de amanhã. Compre pensando nas cotas que seus dividendos comprarão daqui a 5 anos.',
    author: 'Princípio da Bola de Neve',
  },
  {
    text: 'A riqueza não é construída com um grande acerto esporádico, mas com aportes regulares e paciência inabalável.',
    author: 'Warren Buffett',
  },
  {
    text: 'Cada cota de FII no seu extrato é um pedaço de um imóvel alugado trabalhando para você 24 horas por dia.',
    author: 'Prof. Baroni',
  },
];

/**
 * Calcula a retrospectiva completa estilo "Spotify Wrapped / Nubank" de um mês específico
 */
export function calculateMonthlyWrapped(
  positions: FiiPosition[],
  transactions: Transaction[],
  monthlyTarget: number = 200,
  targetMonthKey?: string
): MonthlyWrappedData | null {
  const staircase = calculateDividendStaircase(positions, transactions);
  const now = typeof window !== 'undefined' ? new Date() : null;
  const currentYm = now
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    : '2026-10';
  const currentDay = now ? now.getDate() : 1;

  // Se nenhum mês for passado, escolhe:
  // Se estamos nos primeiros 10 dias do mês e existe mês anterior com dados, foca no mês anterior (fechado)
  // Caso contrário, usa o mês atual ou o último mês com movimentação
  let chosenYm = targetMonthKey;
  if (!chosenYm) {
    if (staircase.months.length > 0) {
      if (currentDay <= 10 && staircase.months.length >= 2) {
        // Mês anterior fechado
        chosenYm = staircase.months[staircase.months.length - 2].yearMonth;
      } else {
        chosenYm = staircase.months[staircase.months.length - 1].yearMonth;
      }
    } else {
      chosenYm = currentYm;
    }
  }

  const [yStr, mStr] = chosenYm.split('-');
  const year = parseInt(yStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const monthName = PT_MONTHS[Math.max(0, Math.min(11, monthIdx))] || 'Mês';
  const fullLabel = `${monthName} de ${year}`;
  const isCurrentMonth = chosenYm === currentYm;

  // 1. Proventos do mês
  const currentMonthStaircase = staircase.months.find((m) => m.yearMonth === chosenYm);
  const currentIdx = staircase.months.findIndex((m) => m.yearMonth === chosenYm);
  const previousMonthStaircase = currentIdx > 0 ? staircase.months[currentIdx - 1] : null;

  const totalDividends = currentMonthStaircase?.totalDividends ?? 0;
  const previousMonthDividends = previousMonthStaircase?.totalDividends ?? 0;

  let dividendGrowthPercent = 0;
  if (previousMonthDividends > 0) {
    dividendGrowthPercent = Number(
      (((totalDividends - previousMonthDividends) / previousMonthDividends) * 100).toFixed(1)
    );
  } else if (totalDividends > 0) {
    dividendGrowthPercent = 100;
  }

  const breakdown = currentMonthStaircase?.breakdown ?? [];
  const topDividendAsset =
    breakdown.length > 0
      ? {
          ticker: breakdown[0].ticker,
          amount: breakdown[0].amount,
          shares: breakdown[0].shares,
          isOfficialB3: breakdown[0].isRealB3,
        }
      : null;

  // 2. Aportes no mês
  const monthBuyTxs = transactions.filter((t) => {
    if (t.type !== 'BUY') return false;
    const ym = t.date ? t.date.slice(0, 7) : '';
    return ym === chosenYm;
  });

  let totalInvested = 0;
  let totalSharesBought = 0;
  const tickerBuyMap = new Map<string, { shares: number; total: number }>();

  for (const tx of monthBuyTxs) {
    const clean = normalizeB3Ticker(tx.ticker);
    const norm = normalizeTransactionForSplit(tx);
    totalInvested += norm.total;
    totalSharesBought += norm.shares;

    const prev = tickerBuyMap.get(clean) || { shares: 0, total: 0 };
    tickerBuyMap.set(clean, {
      shares: prev.shares + norm.shares,
      total: prev.total + norm.total,
    });
  }

  totalInvested = Number(totalInvested.toFixed(2));

  let topBoughtAsset: MonthlyWrappedData['topBoughtAsset'] = null;
  let maxBoughtTotal = 0;
  const boughtAssetsList: string[] = [];

  for (const [ticker, data] of tickerBuyMap.entries()) {
    boughtAssetsList.push(ticker);
    if (data.total > maxBoughtTotal) {
      maxBoughtTotal = data.total;
      topBoughtAsset = {
        ticker,
        shares: data.shares,
        totalInvested: Number(data.total.toFixed(2)),
      };
    }
  }

  // 3. Efeito Bola de Neve & Número Mágico
  const effectiveMonthlyTarget = Math.max(50, monthlyTarget);
  const monthlyGoalCoveragePercent = Number(
    Math.min(100, (totalDividends / effectiveMonthlyTarget) * 100).toFixed(1)
  );

  // Procura o ativo líder no Número Mágico
  let magicNumberLeader: MonthlyWrappedData['magicNumberLeader'] = null;
  let bestMagicProgress = 0;

  for (const pos of positions) {
    const info = findFiiInfo(pos.ticker);
    const divPerShare = pos.monthlyDividendPerShare || info.estimatedMonthlyDividend || 0.1;
    const price = pos.currentPrice || info.vp || 10;
    const magic = Math.ceil(price / (divPerShare || 0.1));
    const progress = Math.min(100, Number(((pos.totalShares / magic) * 100).toFixed(1)));

    if (progress > bestMagicProgress) {
      bestMagicProgress = progress;
      magicNumberLeader = {
        ticker: pos.ticker,
        currentShares: pos.totalShares,
        magicNumber: magic,
        progressPercent: progress,
      };
    }
  }

  // Avanço da Bola de Neve no mês:
  // Calcula o avanço real de novas cotas adicionadas ou crescimento de proventos (sempre limitado a 100% para evitar distorções)
  const totalPortfolioShares = positions.reduce((acc, p) => acc + p.totalShares, 0);
  let calculatedGrowth = 0;
  if (totalPortfolioShares > 0 && totalSharesBought > 0) {
    calculatedGrowth = Math.min(100, Number(((totalSharesBought / totalPortfolioShares) * 100).toFixed(1)));
  } else if (dividendGrowthPercent > 0) {
    calculatedGrowth = Math.min(100, Number(dividendGrowthPercent.toFixed(1)));
  } else {
    calculatedGrowth = 0;
  }
  const snowballGrowthPercent = Math.max(0, calculatedGrowth);

  // 4. Metáforas da Vida Real
  const coffeeCupsPaid = Math.floor(totalDividends / 7.5);
  const energyBillPaidPercent = Math.min(100, Math.round((totalDividends / 120) * 100));

  const quote = INSPIRATIONAL_QUOTES[Math.abs(monthIdx) % INSPIRATIONAL_QUOTES.length];
  const hasActivity = totalDividends > 0 || totalInvested > 0;

  return {
    monthKey: chosenYm,
    monthName,
    year,
    fullLabel,
    isCurrentMonth,
    hasActivity,
    totalDividends,
    previousMonthDividends,
    dividendGrowthPercent,
    topDividendAsset,
    allDividendsBreakdown: breakdown.map((b) => ({
      ticker: b.ticker,
      amount: b.amount,
      shares: b.shares,
    })),
    totalInvested,
    totalSharesBought,
    distinctAssetsBoughtCount: boughtAssetsList.length,
    topBoughtAsset,
    boughtAssetsList,
    snowballGrowthPercent,
    monthlyGoalCoveragePercent,
    magicNumberLeader,
    coffeeCupsPaid,
    energyBillPaidPercent,
    quote,
  };
}

/**
 * Retorna lista de todos os meses disponíveis para navegação na Retrospectiva
 */
export function getAvailableWrappedMonths(
  positions: FiiPosition[],
  transactions: Transaction[]
): Array<{ key: string; label: string }> {
  const staircase = calculateDividendStaircase(positions, transactions);
  if (staircase.months.length === 0) {
    const now = typeof window !== 'undefined' ? new Date() : null;
    const currentYm = now
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      : '2026-10';
    const mIdx = now ? now.getMonth() : 9;
    const y = now ? now.getFullYear() : 2026;
    return [{ key: currentYm, label: `${PT_MONTHS[mIdx]} / ${y}` }];
  }

  return staircase.months
    .map((m) => {
      const [y, mm] = m.yearMonth.split('-');
      const idx = parseInt(mm, 10) - 1;
      return {
        key: m.yearMonth,
        label: `${PT_MONTHS[idx]} / ${y}`,
      };
    })
    .reverse(); // Mais recente primeiro
}
