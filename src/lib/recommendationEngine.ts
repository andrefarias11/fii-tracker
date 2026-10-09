import { FiiFundamentalData, FII_FUNDAMENTALS } from '../data/fiiFundamentals';
import { QuoteData } from '../types/portfolio';

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
  status: 'OPPORTUNITY' | 'FAIR' | 'EXPENSIVE';
  score: number; // 0 a 100
  rationale: string;
  management: string;
  diversification: string;
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

export function evaluateAllFiis(quotes: Record<string, QuoteData>): EvaluatedFii[] {
  return FII_FUNDAMENTALS.map((fii) => {
    const quote = quotes[fii.ticker];
    // Se tiver cotação ao vivo, usa. Se não tiver, usa valor próximo ao VP ou base
    const currentPrice = quote?.price && quote.price > 0 ? quote.price : (fii.base === 10 ? 9.50 : 100.00);
    const pvp = Number((currentPrice / fii.vp).toFixed(2));
    const discountPercent = Number(((1 - pvp) * 100).toFixed(1));
    const monthlyYieldPercent = Number(((fii.typicalMonthlyDividend / currentPrice) * 100).toFixed(2));
    const annualYieldPercent = Number((monthlyYieldPercent * 12).toFixed(2));

    let status: 'OPPORTUNITY' | 'FAIR' | 'EXPENSIVE' = 'FAIR';
    let score = 50;
    let rationale = '';

    // Avaliação do P/VP
    if (pvp <= 0.99) {
      status = 'OPPORTUNITY';
      score += 35; // Forte bônus de desconto
      rationale = `🟢 OPORTUNIDADE DE COMPRA: O ${fii.ticker} está negociando com ${discountPercent}% de desconto em relação ao patrimônio real (P/VP ${pvp}). Com rendimento mensal de ${monthlyYieldPercent}% a.m. (${annualYieldPercent}% a.a.), comprar agora permite lucrar tanto com a renda passiva quanto com a valorização futura da cota.`;
    } else if (pvp <= 1.02) {
      status = 'FAIR';
      score += 15;
      rationale = `🟡 PREÇO JUSTO: O ${fii.ticker} está cotado a R$ ${currentPrice.toFixed(2)}, em linha com seu valor contábil (P/VP ${pvp}). É um ativo seguro para manter constância nos aportes (${monthlyYieldPercent}% a.m.), sem pagar sobrepreço.`;
    } else {
      status = 'EXPENSIVE';
      score -= 20;
      rationale = `🔴 ÁGIO ELEVADO: O ${fii.ticker} subiu recentemente e está sendo negociado com ${Math.abs(discountPercent)}% de ágio (P/VP ${pvp}). Evite comprar agora para não pagar mais caro do que o patrimônio vale.`;
    }

    // Bônus de yield consistente
    if (monthlyYieldPercent >= 0.85) {
      score += 15;
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
      monthlyDividend: fii.typicalMonthlyDividend,
      monthlyYieldPercent,
      annualYieldPercent,
      status,
      score: Math.max(0, Math.min(100, score)),
      rationale,
      management: fii.management,
      diversification: fii.diversification
    };
  }).sort((a, b) => b.score - a.score);
}

// Gerar recomendação personalizada para o valor restante do mês (ex: R$ 150 restantes dos R$ 200)
export function generateDailyRecommendation(
  remainingBudget: number,
  evaluatedFiis: EvaluatedFii[]
): DayRecommendation {
  const budget = Math.max(0, Number(remainingBudget.toFixed(2)));

  // Se o usuário já bateu a meta ou tem menos de R$ 10 restantes
  if (budget < 10) {
    return {
      remainingBudget: budget,
      totalSuggestedCost: 0,
      unallocatedCash: budget,
      projectedMonthlyIncomeGain: 0,
      items: [],
      strategyExplanation: '🎉 Parabéns! Você já bateu sua meta de aportes deste mês! Quando o próximo mês iniciar, o radar calculará uma nova cesta de compras para seus novos R$ 200.'
    };
  }

  // Filtrar os melhores fundos disponíveis, priorizando Base 10 para fracionar os R$ 150 com precisão
  const eligibleFiis = evaluatedFiis
    .filter((f) => f.status === 'OPPORTUNITY' || f.status === 'FAIR')
    .sort((a, b) => {
      // Priorizar Base 10 se o orçamento for menor que R$ 120
      if (budget < 120 && a.base !== b.base) {
        return a.base - b.base;
      }
      return b.score - a.score;
    });

  // Selecionar até 2 ou 3 fundos de segmentos diferentes para diversificar os R$ 150
  const chosenFiis: EvaluatedFii[] = [];
  const segmentsPicked = new Set<string>();

  for (const f of eligibleFiis) {
    if (!segmentsPicked.has(f.segment) && f.currentPrice <= budget) {
      chosenFiis.push(f);
      segmentsPicked.add(f.segment);
      if (chosenFiis.length >= 2) break;
    }
  }

  // Se não achou 2 de segmentos diferentes, pega os 2 melhores por score
  if (chosenFiis.length === 0 && eligibleFiis.length > 0) {
    chosenFiis.push(eligibleFiis[0]);
  }

  const items: RecommendedBasketItem[] = [];
  let currentTotalCost = 0;
  let totalIncome = 0;

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
        reason: `${f.discountPercent > 0 ? `Desconto de ${f.discountPercent}%` : 'Preço justo'} com yield de ${f.monthlyYieldPercent}% a.m.`
      });
      currentTotalCost += cost;
      totalIncome += income;
    }
  } else if (chosenFiis.length >= 2) {
    // Dividir meio a meio o saldo restante entre os 2 fundos
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
        reason: `${f1.discountPercent > 0 ? `Com ${f1.discountPercent}% de desconto` : 'Preço justo'} no setor de ${f1.segment}.`
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
        reason: `Diversificação em ${f2.segment} gerando +${f2.monthlyYieldPercent}% ao mês.`
      });
      currentTotalCost += cost2;
      totalIncome += income2;
    }
  }

  const unallocatedCash = Number((budget - currentTotalCost).toFixed(2));

  const explanation = items.length > 0
    ? `Com os R$ ${budget.toFixed(2)} restantes para completar sua meta deste mês, dividimos o valor entre ${items.length} fundos complementares com desconto na B3. Essa compra adicionará cerca de +R$ ${totalIncome.toFixed(2)} por mês na sua conta da XP para sempre!`
    : 'Nenhuma oportunidade compatível com o saldo restante hoje.';

  return {
    remainingBudget: budget,
    totalSuggestedCost: Number(currentTotalCost.toFixed(2)),
    unallocatedCash,
    projectedMonthlyIncomeGain: Number(totalIncome.toFixed(2)),
    items,
    strategyExplanation: explanation
  };
}

