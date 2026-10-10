import { FII_FUNDAMENTALS } from '../data/fiiFundamentals';
import { findFiiInfo } from '../data/fiiDatabase';
import { QuoteData, FiiPosition } from '../types/portfolio';

export type RecommendationStrategy = 'balanced' | 'snowball';

export interface EvaluatedFii {
  ticker: string;
  name: string;
  segment: string;
  base: 10 | 100;
  vp: number;
  currentPrice: number;
  pvp: number;
  discountPercent: number; // Positivo = Desconto, Negativo = Ágio
  monthlyDividend: number;
  monthlyYieldPercent: number;
  annualYieldPercent: number;
  ceilingPrice: number; // Preço teto para 0.90% a.m.
  status: 'OPPORTUNITY' | 'FAIR' | 'EXPENSIVE';
  score: number; // 0 a 100
  rationale: string;
  management: string;
  diversification: string;
  userAveragePrice?: number;
  isBelowAveragePrice?: boolean;
  rebalancesPortfolio?: boolean;
  announcementDay: number;
  daysUntilExDate: number;
}

export interface RecommendedBasketItem {
  ticker: string;
  name: string;
  shares: number;
  currentPrice: number;
  totalCost: number;
  estimatedMonthlyIncome: number;
  segment: string;
  base: 10 | 100;
  reason: string;
}

export interface DayRecommendation {
  remainingBudget: number;
  totalSuggestedCost: number;
  unallocatedCash: number;
  projectedMonthlyIncomeGain: number;
  items: RecommendedBasketItem[];
  strategyExplanation: string;
}

function getMacroCategory(segment: string): string {
  const s = segment.toLowerCase();
  if (s.includes('papel')) return 'Papel';
  if (s.includes('logística') || s.includes('logistica')) return 'Logística';
  if (s.includes('shopping')) return 'Shopping';
  if (s.includes('renda urbana') || s.includes('lajes')) return 'Tijolo';
  if (s.includes('fiagro')) return 'Fiagro';
  if (s.includes('fof')) return 'FOF';
  return 'Outros';
}

export function evaluateAllFiis(
  quotes: Record<string, QuoteData>,
  positions: FiiPosition[] = []
): EvaluatedFii[] {
  const totalEquity = positions.reduce((acc, p) => acc + p.currentTotal, 0);
  const categoryWeights: Record<string, number> = {};

  if (totalEquity > 0) {
    for (const pos of positions) {
      const cat = getMacroCategory(pos.segment);
      categoryWeights[cat] = (categoryWeights[cat] || 0) + pos.currentTotal / totalEquity;
    }
  }

  const now = new Date();
  const todayDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return FII_FUNDAMENTALS.map((fii) => {
    const quote = quotes[fii.ticker];
    const catalogInfo = findFiiInfo(fii.ticker);
    const announcementDay = catalogInfo.announcementDay ?? 30;
    const effectiveExDay = Math.min(announcementDay, daysInMonth);
    const daysUntilExDate =
      effectiveExDay >= todayDay
        ? effectiveExDay - todayDay
        : daysInMonth - todayDay + announcementDay;

    const currentPrice =
      quote?.price && quote.price > 0 ? quote.price : fii.base === 10 ? 9.5 : 100.0;
    const pvp = Number((currentPrice / fii.vp).toFixed(2));
    const discountPercent = Number(((1 - pvp) * 100).toFixed(1));

    const monthlyDividend =
      quote?.lastDividend && quote.lastDividend > 0
        ? Number(quote.lastDividend.toFixed(3))
        : fii.typicalMonthlyDividend;

    const monthlyYieldPercent = Number(((monthlyDividend / currentPrice) * 100).toFixed(2));
    const annualYieldPercent = Number((monthlyYieldPercent * 12).toFixed(2));
    const ceilingPrice = Number((monthlyDividend / 0.009).toFixed(2));

    const userPos = positions.find((p) => p.ticker === fii.ticker);
    const userAveragePrice = userPos?.averagePrice;
    const isBelowAveragePrice = Boolean(userPos && currentPrice < userPos.averagePrice);

    const cat = getMacroCategory(fii.segment);
    const currentCatWeight = categoryWeights[cat] || 0;
    const rebalancesPortfolio = totalEquity > 0 && currentCatWeight < 0.2;

    let status: 'OPPORTUNITY' | 'FAIR' | 'EXPENSIVE' = 'FAIR';
    let score = 50;
    let rationale = '';

    // Avaliação do P/VP
    if (pvp <= 0.99) {
      status = 'OPPORTUNITY';
      score += 32;
      rationale = `Negociando com ${discountPercent}% de desconto sobre o VP (P/VP ${pvp}) e entregando ${monthlyYieldPercent}% a.m. (${annualYieldPercent}% a.a.).`;
    } else if (pvp <= 1.02) {
      status = 'FAIR';
      score += 15;
      rationale = `Cotado em linha com seu valor justo (P/VP ${pvp}), oferecendo renda passiva consistente de ${monthlyYieldPercent}% a.m.`;
    } else {
      status = 'EXPENSIVE';
      score -= 20;
      rationale = `Negociando com ${Math.abs(discountPercent)}% de ágio acima do patrimônio (P/VP ${pvp}).`;
    }

    if (monthlyYieldPercent >= 0.85) {
      score += 12;
    }

    if (rebalancesPortfolio && status !== 'EXPENSIVE') {
      score += 10;
    }

    if (isBelowAveragePrice && status !== 'EXPENSIVE') {
      score += 6;
    }

    if (daysUntilExDate <= 5 && status !== 'EXPENSIVE') {
      score += 5;
    }

    return {
      ticker: fii.ticker,
      name: fii.name,
      segment: fii.segment,
      base: fii.base,
      vp: fii.vp,
      currentPrice,
      pvp,
      discountPercent,
      monthlyDividend,
      monthlyYieldPercent,
      annualYieldPercent,
      ceilingPrice,
      status,
      score: Math.max(0, Math.min(100, score)),
      rationale,
      management: fii.management,
      diversification: fii.diversification,
      userAveragePrice,
      isBelowAveragePrice,
      rebalancesPortfolio,
      announcementDay,
      daysUntilExDate,
    };
  }).sort((a, b) => b.score - a.score);
}

// Gerar recomendação personalizada para o valor disponível
export function generateDailyRecommendation(
  remainingBudget: number,
  evaluatedFiis: EvaluatedFii[],
  positions: FiiPosition[] = [],
  strategyMode: RecommendationStrategy = 'balanced'
): DayRecommendation {
  const budget = Math.max(0, Number(remainingBudget.toFixed(2)));

  if (budget < 10) {
    return {
      remainingBudget: budget,
      totalSuggestedCost: 0,
      unallocatedCash: budget,
      projectedMonthlyIncomeGain: 0,
      items: [],
      strategyExplanation:
        '🎉 Meta do mês concluída! Ative a opção "Somar proventos" acima caso queira simular o reinvestimento dos seus dividendos.',
    };
  }

  // MODO 1: TURBO BOLA DE NEVE (Foco em bater o Número Mágico mais próximo)
  if (strategyMode === 'snowball' && positions.length > 0) {
    const candidates = positions
      .filter((p) => p.totalShares < p.magicNumber && p.currentPrice <= budget)
      .sort((a, b) => b.magicProgressPercent - a.magicProgressPercent);

    const targetPos = candidates[0] || positions.find((p) => p.currentPrice <= budget);

    if (targetPos) {
      const shares = Math.floor(budget / targetPos.currentPrice);
      if (shares > 0) {
        const cost = Number((shares * targetPos.currentPrice).toFixed(2));
        const income = Number((shares * targetPos.monthlyDividendPerShare).toFixed(2));
        const newTotalShares = targetPos.totalShares + shares;
        const remainingToMagic = Math.max(0, targetPos.magicNumber - newTotalShares);

        return {
          remainingBudget: budget,
          totalSuggestedCost: cost,
          unallocatedCash: Number((budget - cost).toFixed(2)),
          projectedMonthlyIncomeGain: income,
          items: [
            {
              ticker: targetPos.ticker,
              name: targetPos.name,
              shares,
              currentPrice: targetPos.currentPrice,
              totalCost: cost,
              estimatedMonthlyIncome: income,
              segment: targetPos.segment,
              base: targetPos.base,
              reason:
                remainingToMagic === 0
                  ? '❄️ Atinge o Número Mágico com esta compra!'
                  : `❄️ Reduz para apenas ${remainingToMagic} cotas até o Número Mágico`,
            },
          ],
          strategyExplanation: `Focando 100% do saldo em ${targetPos.ticker} para acelerar sua Bola de Neve: você passará de ${targetPos.totalShares} para ${newTotalShares} cotas (meta: ${targetPos.magicNumber}).`,
        };
      }
    }
  }

  // MODO 2: EQUILÍBRIO DE CARTEIRA + DESCONTOS P/VP
  const eligibleFiis = evaluatedFiis
    .filter((f) => f.status === 'OPPORTUNITY' || f.status === 'FAIR')
    .sort((a, b) => {
      if (budget < 120 && a.base !== b.base) {
        return a.base - b.base;
      }
      // Priorizar setores que equilibram a carteira do usuário
      if (a.rebalancesPortfolio !== b.rebalancesPortfolio) {
        return a.rebalancesPortfolio ? -1 : 1;
      }
      return b.score - a.score;
    });

  const chosenFiis: EvaluatedFii[] = [];
  const categoriesPicked = new Set<string>();

  for (const f of eligibleFiis) {
    const cat = getMacroCategory(f.segment);
    if (!categoriesPicked.has(cat) && f.currentPrice <= budget) {
      chosenFiis.push(f);
      categoriesPicked.add(cat);
      if (chosenFiis.length >= 2) break;
    }
  }

  if (chosenFiis.length === 0 && eligibleFiis.length > 0) {
    chosenFiis.push(eligibleFiis[0]);
  }

  const items: RecommendedBasketItem[] = [];
  let currentTotalCost = 0;
  let totalIncome = 0;

  const formatReason = (f: EvaluatedFii) => {
    if (f.isBelowAveragePrice) {
      return `📉 Abaixo do seu PM (R$ ${f.userAveragePrice?.toFixed(2)}) • Yield ${f.monthlyYieldPercent}% a.m.`;
    }
    if (f.rebalancesPortfolio) {
      return `⚖️ Diversifica em ${getMacroCategory(f.segment)} • P/VP ${f.pvp}`;
    }
    return `${f.discountPercent > 0 ? `Desconto de ${f.discountPercent}%` : 'Preço justo'} • Yield ${f.monthlyYieldPercent}% a.m.`;
  };

  if (chosenFiis.length === 1) {
    const f = chosenFiis[0];
    const shares = Math.floor(budget / f.currentPrice);
    if (shares > 0) {
      const cost = Number((shares * f.currentPrice).toFixed(2));
      const income = Number((shares * f.monthlyDividend).toFixed(2));
      items.push({
        ticker: f.ticker,
        name: f.name,
        shares,
        currentPrice: f.currentPrice,
        totalCost: cost,
        estimatedMonthlyIncome: income,
        segment: f.segment,
        base: f.base,
        reason: formatReason(f),
      });
      currentTotalCost += cost;
      totalIncome += income;
    }
  } else if (chosenFiis.length >= 2) {
    const halfBudget = budget / 2;

    const f1 = chosenFiis[0];
    const shares1 = Math.floor(halfBudget / f1.currentPrice);
    const cost1 = Number((shares1 * f1.currentPrice).toFixed(2));
    const income1 = Number((shares1 * f1.monthlyDividend).toFixed(2));

    const f2 = chosenFiis[1];
    const remainingForF2 = budget - cost1;
    const shares2 = Math.floor(remainingForF2 / f2.currentPrice);
    const cost2 = Number((shares2 * f2.currentPrice).toFixed(2));
    const income2 = Number((shares2 * f2.monthlyDividend).toFixed(2));

    if (shares1 > 0) {
      items.push({
        ticker: f1.ticker,
        name: f1.name,
        shares: shares1,
        currentPrice: f1.currentPrice,
        totalCost: cost1,
        estimatedMonthlyIncome: income1,
        segment: f1.segment,
        base: f1.base,
        reason: formatReason(f1),
      });
      currentTotalCost += cost1;
      totalIncome += income1;
    }

    if (shares2 > 0) {
      items.push({
        ticker: f2.ticker,
        name: f2.name,
        shares: shares2,
        currentPrice: f2.currentPrice,
        totalCost: cost2,
        estimatedMonthlyIncome: income2,
        segment: f2.segment,
        base: f2.base,
        reason: formatReason(f2),
      });
      currentTotalCost += cost2;
      totalIncome += income2;
    }
  }

  const unallocatedCash = Number((budget - currentTotalCost).toFixed(2));

  const explanation =
    items.length > 0
      ? `Sugestão equilibrada para sua carteira atual: combina desconto patrimonial e diversificação setorial, gerando +R$ ${totalIncome.toFixed(2)}/mês de renda isenta.`
      : 'Nenhuma oportunidade compatível com o saldo disponível hoje.';

  return {
    remainingBudget: budget,
    totalSuggestedCost: Number(currentTotalCost.toFixed(2)),
    unallocatedCash,
    projectedMonthlyIncomeGain: Number(totalIncome.toFixed(2)),
    items,
    strategyExplanation: explanation,
  };
}


