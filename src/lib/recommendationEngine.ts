import { FII_FUNDAMENTALS } from '../data/fiiFundamentals';
import { findFiiInfo } from '../data/fiiDatabase';
import { QuoteData, FiiPosition } from '../types/portfolio';

export type RecommendationStrategy = 'balanced' | 'snowball';
export type QualityTier = 'HIGH_GRADE' | 'MODERADO' | 'ALERTA_RISCO';

export interface EvaluatedFii {
  ticker: string;
  name: string;
  assetClass: 'FII' | 'ACAO';
  segment: string;
  base: 10 | 100;
  vp: number;
  currentPrice: number;
  pvp: number;
  discountPercent: number; // Positivo = Desconto, Negativo = Ágio
  monthlyDividend: number;
  rawLiveDividend?: number; // Dividendo bruto caso tenha sido normalizado pelo filtro anti-não-recorrente
  isYieldNormalized: boolean; // True se o dividendo ao vivo foi travado contra pico não-recorrente
  isDistressedWarning: boolean; // True se P/VP < 0.80 ou vacância > 12% (alerta Value Trap)
  qualityTier: QualityTier; // Classificação institucional Anti-Cilada
  qualityStars: number; // 1 a 5 estrelas de solidez
  qualityBadgeLabel: string;
  qualityWarnings: string[];
  monthlyYieldPercent: number;
  annualYieldPercent: number;
  ceilingPrice: number; // Preço teto (0.90% a.m. para FIIs ou 6% a.a. Barsi para Ações)
  barsiCeilingPrice: number; // Preço teto método Barsi
  status: 'OPPORTUNITY' | 'FAIR' | 'EXPENSIVE';
  score: number; // 0 a 100
  rationale: string;
  management: string;
  diversification: string;
  thesis: string;
  vacancyPhysical?: number;
  dividendSource?: 'B3_OFICIAL' | 'MERCADO' | 'HISTORICO';
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
  qualityBadgeLabel: string;
  reason: string;
}

export interface DayRecommendation {
  remainingBudget: number;
  totalSuggestedCost: number;
  unallocatedCash: number;
  caixinhaSuggestion?: string;
  projectedMonthlyIncomeGain: number;
  items: RecommendedBasketItem[];
  strategyExplanation: string;
}

function getMacroCategory(segment: string): string {
  const s = segment.toLowerCase();
  if (s.includes('ações') || s.includes('acoes')) return 'Ações';
  if (s.includes('papel')) return 'Papel';
  if (s.includes('logística') || s.includes('logistica')) return 'Logística';
  if (s.includes('shopping')) return 'Shopping';
  if (s.includes('renda urbana') || s.includes('lajes')) return 'Tijolo';
  if (s.includes('fiagro')) return 'Fiagro';
  if (s.includes('fof')) return 'FOF';
  return 'Outros';
}

const TIER_1_MANAGERS = [
  'kinea',
  'pátria',
  'patria',
  'cshg',
  'btg pactual',
  'xp asset',
  'vinci',
  'alianza',
  'bresco',
  'itaú',
  'itau',
  'banco do brasil',
  'taesa',
  'engie',
  'sabesp',
  'porto seguro',
  'bb seguridade',
  'vale',
  'petrobras',
  'weg',
];

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

  const now =
    typeof window !== 'undefined' ? new Date() : new Date('2026-10-12T12:00:00Z');
  const todayDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return FII_FUNDAMENTALS.map((fii) => {
    const assetClass = fii.assetClass || 'FII';
    const isStock = assetClass === 'ACAO';
    const quote = quotes[fii.ticker];
    const catalogInfo = findFiiInfo(fii.ticker);
    const announcementDay = catalogInfo.announcementDay ?? 30;
    const effectiveExDay = Math.min(announcementDay, daysInMonth);
    const daysUntilExDate =
      effectiveExDay >= todayDay
        ? effectiveExDay - todayDay
        : daysInMonth - todayDay + announcementDay;

    const currentPrice =
      quote?.price && quote.price > 0
        ? quote.price
        : isStock
        ? fii.vp
        : fii.base === 10
        ? 9.5
        : 100.0;
    const pvp =
      quote?.pvp && quote.pvp > 0
        ? Number(quote.pvp.toFixed(2))
        : Number((currentPrice / fii.vp).toFixed(2));
    const vp =
      quote?.pvp && quote.pvp > 0
        ? Number((currentPrice / quote.pvp).toFixed(2))
        : fii.vp;
    const discountPercent = Number(((1 - pvp) * 100).toFixed(1));

    // =========================================================================
    // BLINDAGEM 1: TETO DE YIELD ANÔMALO (Normalização de Não-Recorrentes)
    // Impede que lucro extraordinário de venda de imóvel infle o Preço-Teto
    // =========================================================================
    const rawLiveDividend =
      quote?.lastDividend && quote.lastDividend > 0
        ? Number(quote.lastDividend.toFixed(3))
        : undefined;

    const maxSustainableDividend = Number((fii.typicalMonthlyDividend * 1.3).toFixed(3));
    let isYieldNormalized = false;
    let monthlyDividend = rawLiveDividend ?? fii.typicalMonthlyDividend;

    if (rawLiveDividend && rawLiveDividend > maxSustainableDividend) {
      isYieldNormalized = true;
      monthlyDividend = fii.typicalMonthlyDividend;
    }

    const monthlyYieldPercent = Number(((monthlyDividend / currentPrice) * 100).toFixed(2));
    const annualYieldPercent = Number((monthlyYieldPercent * 12).toFixed(2));

    // Para Ações: Preço-Teto de Barsi (mín. 6% a.a.). Para FIIs: 0.90% a.m. (10.8% a.a.)
    const ceilingPrice = isStock
      ? Number(((monthlyDividend * 12) / 0.06).toFixed(2))
      : Number((monthlyDividend / 0.009).toFixed(2));
    const barsiCeilingPrice = isStock
      ? Number(((monthlyDividend * 12) / 0.06).toFixed(2))
      : Number((monthlyDividend / 0.008).toFixed(2));

    // =========================================================================
    // BLINDAGEM 2: FILTRO ANTI-VALUE TRAP (Desconto Suspeito / Vacância Alta)
    // FII com P/VP < 0.80 ou vacância física > 12% sinaliza estresse de crédito/imóvel
    // =========================================================================
    const qualityWarnings: string[] = [];
    if (isYieldNormalized && rawLiveDividend) {
      qualityWarnings.push(
        `Provento ao vivo (R$ ${rawLiveDividend.toFixed(2)}) acima da média recorrente: Preço-Teto travado na base recorrente (R$ ${fii.typicalMonthlyDividend.toFixed(2)}) contra efeito não-recorrente.`
      );
    }

    const hasHighVacancy =
      !isStock && fii.vacancyPhysical !== undefined && fii.vacancyPhysical > 12;
    const hasDistressedPvp = !isStock && pvp < 0.8;
    const isDistressedWarning = hasHighVacancy || hasDistressedPvp;

    if (hasDistressedPvp) {
      qualityWarnings.push(
        `Desconto atípico (P/VP ${pvp}): deságio superior a 20% do VP exige cautela redobrada com risco de crédito ou reavaliação patrimonial.`
      );
    }
    if (hasHighVacancy) {
      qualityWarnings.push(
        `Vacância física elevada (${fii.vacancyPhysical}%): acima do limite institucional de 12%.`
      );
    }

    // =========================================================================
    // BLINDAGEM 3: SCORE DE SOLIDEZ INSTITUCIONAL (Quality Gate 1 a 5 Estrelas)
    // Avalia gestora Tier-1, pulverização de ativos/CRIs, vacância e High Grade
    // =========================================================================
    const mgmtLower = fii.management.toLowerCase();
    const thesisLower = `${fii.thesis} ${fii.diversification}`.toLowerCase();
    const isTier1Manager = TIER_1_MANAGERS.some((m) => mgmtLower.includes(m));
    const isHighGradeThesis =
      thesisLower.includes('high grade') ||
      thesisLower.includes('líder') ||
      thesisLower.includes('maior') ||
      thesisLower.includes('atípico') ||
      thesisLower.includes('padrão ouro');
    const isLowVacancy =
      isStock || fii.vacancyPhysical === undefined || fii.vacancyPhysical <= 4.5;

    let qualityStars = 4;
    let qualityTier: QualityTier = 'MODERADO';
    let qualityBadgeLabel = 'Qualidade Sólida';

    if (isDistressedWarning) {
      qualityStars = 2;
      qualityTier = 'ALERTA_RISCO';
      qualityBadgeLabel = 'Alerta Value Trap';
    } else if (isTier1Manager && (isHighGradeThesis || isLowVacancy)) {
      qualityStars = 5;
      qualityTier = 'HIGH_GRADE';
      qualityBadgeLabel = 'High Grade 5★';
    } else if (isTier1Manager || isLowVacancy) {
      qualityStars = 4;
      qualityTier = 'MODERADO';
      qualityBadgeLabel = 'Moderado 4★';
    }

    const userPos = positions.find((p) => p.ticker === fii.ticker);
    const userAveragePrice = userPos?.averagePrice;
    const isBelowAveragePrice = Boolean(userPos && currentPrice < userPos.averagePrice);

    const cat = getMacroCategory(fii.segment);
    const currentCatWeight = categoryWeights[cat] || 0;
    const rebalancesPortfolio = totalEquity > 0 && currentCatWeight < 0.2;

    let status: 'OPPORTUNITY' | 'FAIR' | 'EXPENSIVE' = 'FAIR';
    let score = 50;
    let rationale = '';

    if (isStock) {
      // Avaliação específica para Ações de Dividendos (Preço-Teto Barsi 6% a.a. + P/VP)
      const belowBarsiCeiling = currentPrice <= ceilingPrice;
      if (pvp <= 1.0 && belowBarsiCeiling) {
        status = 'OPPORTUNITY';
        score += 36;
        rationale = `Ação descontada abaixo do VPA (P/VP ${pvp}) e abaixo do Preço-Teto de Barsi (R$ ${ceilingPrice.toFixed(2)}), entregando ${annualYieldPercent}% a.a. de dividendos.`;
      } else if (belowBarsiCeiling) {
        status = 'OPPORTUNITY';
        score += 28;
        rationale = `Negociando abaixo do Preço-Teto de Barsi (R$ ${ceilingPrice.toFixed(2)}) com Dividend Yield de ${annualYieldPercent}% a.a. (média eq. ${monthlyYieldPercent}% a.m.).`;
      } else if (annualYieldPercent >= 5.0 || pvp <= 1.15) {
        status = 'FAIR';
        score += 12;
        rationale = `Empresa perene com retorno em dividendos de ${annualYieldPercent}% a.a. e P/VP ${pvp}.`;
      } else {
        status = 'EXPENSIVE';
        score -= 18;
        rationale = `Cotação acima do Preço-Teto previdenciário de 6% a.a. (Teto R$ ${ceilingPrice.toFixed(2)}).`;
      }
    } else {
      // Avaliação de FIIs com Blindagem Anti-Value Trap
      if (isDistressedWarning) {
        status = 'FAIR';
        score -= 28;
        rationale = `Atenção Institucional: apesar do P/VP ${pvp}, o ativo acionou trava de cautela (${qualityWarnings[0]}).`;
      } else if (pvp >= 0.82 && pvp <= 0.99) {
        status = 'OPPORTUNITY';
        score += 32;
        rationale = `Negociando com ${discountPercent}% de desconto saudável sobre o VP (P/VP ${pvp}) e entregando ${monthlyYieldPercent}% a.m. recorrentes (${annualYieldPercent}% a.a.).`;
      } else if (pvp <= 1.02) {
        status = 'FAIR';
        score += 15;
        rationale = `Cotado em linha com seu valor justo (P/VP ${pvp}), oferecendo renda passiva consistente de ${monthlyYieldPercent}% a.m.`;
      } else {
        status = 'EXPENSIVE';
        score -= 20;
        rationale = `Negociando com ${Math.abs(discountPercent)}% de ágio acima do patrimônio (P/VP ${pvp}).`;
      }
    }

    // Bônus de Solidez Institucional High Grade
    if (qualityTier === 'HIGH_GRADE') {
      score += 10;
    }

    if ((isStock && annualYieldPercent >= 7.5) || (!isStock && monthlyYieldPercent >= 0.85)) {
      score += 10;
    }

    if (rebalancesPortfolio && status !== 'EXPENSIVE' && !isDistressedWarning) {
      score += 10;
    }

    if (isBelowAveragePrice && status !== 'EXPENSIVE' && !isDistressedWarning) {
      score += 6;
    }

    if (daysUntilExDate <= 5 && status !== 'EXPENSIVE' && !isDistressedWarning) {
      score += 5;
    }

    return {
      ticker: fii.ticker,
      name: fii.name,
      assetClass,
      segment: fii.segment,
      base: fii.base,
      vp,
      currentPrice,
      pvp,
      discountPercent,
      monthlyDividend,
      rawLiveDividend,
      isYieldNormalized,
      isDistressedWarning,
      qualityTier,
      qualityStars,
      qualityBadgeLabel,
      qualityWarnings,
      monthlyYieldPercent,
      annualYieldPercent,
      ceilingPrice,
      barsiCeilingPrice,
      status,
      score: Math.max(0, Math.min(100, score)),
      rationale,
      management: fii.management,
      diversification: fii.diversification,
      thesis: fii.thesis,
      vacancyPhysical: fii.vacancyPhysical,
      dividendSource: quote?.dividendSource,
      userAveragePrice,
      isBelowAveragePrice,
      rebalancesPortfolio,
      announcementDay,
      daysUntilExDate,
    };
  }).sort((a, b) => b.score - a.score);
}

// Gerar recomendação personalizada para o valor disponível (excluindo ativos em alerta de risco)
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

  // MODO 1: TURBO BOLA DE NEVE (Foco em bater o Número Mágico mais próximo em ativos saudáveis)
  if (strategyMode === 'snowball' && positions.length > 0) {
    const candidates = positions
      .filter((p) => {
        const evalItem = evaluatedFiis.find((e) => e.ticker === p.ticker);
        const isSafe = !evalItem || !evalItem.isDistressedWarning;
        return isSafe && p.totalShares < p.magicNumber && p.currentPrice <= budget;
      })
      .sort((a, b) => b.magicProgressPercent - a.magicProgressPercent);

    const targetPos = candidates[0] || positions.find((p) => p.currentPrice <= budget);

    if (targetPos) {
      const evalInfo = evaluatedFiis.find((e) => e.ticker === targetPos.ticker);
      const shares = Math.floor(budget / targetPos.currentPrice);
      if (shares > 0) {
        const cost = Number((shares * targetPos.currentPrice).toFixed(2));
        const income = Number((shares * targetPos.monthlyDividendPerShare).toFixed(2));
        const newTotalShares = targetPos.totalShares + shares;
        const remainingToMagic = Math.max(0, targetPos.magicNumber - newTotalShares);

        const unallocatedCash = Number((budget - cost).toFixed(2));
        const caixinhaSuggestion =
          unallocatedCash > 0
            ? `Sobrou R$ ${unallocatedCash.toFixed(2).replace('.', ',')}? Guarde na Caixinha Nubank (100% CDI) rendendo juros diários até juntar com o aporte do próximo mês!`
            : undefined;

        return {
          remainingBudget: budget,
          totalSuggestedCost: cost,
          unallocatedCash,
          caixinhaSuggestion,
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
              qualityBadgeLabel: evalInfo?.qualityBadgeLabel || 'High Grade 5★',
              reason:
                remainingToMagic === 0
                  ? '❄️ Atinge o Número Mágico com esta compra!'
                  : `❄️ Reduz para apenas ${remainingToMagic} cotas até o Número Mágico`,
            },
          ],
          strategyExplanation: `Focando 100% do saldo em ${targetPos.ticker} (auditado pelo Quality Gate) para acelerar sua Bola de Neve: você passará de ${targetPos.totalShares} para ${newTotalShares} cotas (meta: ${targetPos.magicNumber}).`,
        };
      }
    }
  }

  // MODO 2: EQUILÍBRIO DE CARTEIRA + QUALITY GATE ANTI-CILADA
  // Filtra estritamente ativos sem alerta de Value Trap e prioriza High Grade
  const eligibleFiis = evaluatedFiis
    .filter(
      (f) =>
        !f.isDistressedWarning &&
        f.qualityTier !== 'ALERTA_RISCO' &&
        (f.status === 'OPPORTUNITY' || f.status === 'FAIR')
    )
    .sort((a, b) => {
      if (budget < 120 && a.base !== b.base) {
        return a.base - b.base;
      }
      // Priorizar setores que equilibram a carteira do usuário
      if (a.rebalancesPortfolio !== b.rebalancesPortfolio) {
        return a.rebalancesPortfolio ? -1 : 1;
      }
      // Desempate por Quality Tier (High Grade primeiro) e Score
      if (a.qualityStars !== b.qualityStars) {
        return b.qualityStars - a.qualityStars;
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
      return `📉 Abaixo do seu PM (R$ ${f.userAveragePrice?.toFixed(2)}) • ${f.qualityBadgeLabel}`;
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
        qualityBadgeLabel: f.qualityBadgeLabel,
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
        qualityBadgeLabel: f1.qualityBadgeLabel,
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
        qualityBadgeLabel: f2.qualityBadgeLabel,
        reason: formatReason(f2),
      });
      currentTotalCost += cost2;
      totalIncome += income2;
    }
  }

  const unallocatedCash = Number((budget - currentTotalCost).toFixed(2));
  const caixinhaSuggestion =
    unallocatedCash > 0
      ? `Sobrou R$ ${unallocatedCash.toFixed(2).replace('.', ',')}? Guarde na Caixinha Nubank (100% CDI) rendendo juros diários até juntar com o aporte do próximo mês!`
      : undefined;

  const explanation =
    items.length > 0
      ? `Cesta auditada pelo Quality Gate (filtro anti-Value Trap e dividendos recorrentes): combina segurança High Grade e desconto patrimonial, gerando +R$ ${totalIncome.toFixed(2)}/mês.`
      : 'Nenhuma oportunidade compatível com o saldo disponível hoje.';

  return {
    remainingBudget: budget,
    totalSuggestedCost: Number(currentTotalCost.toFixed(2)),
    unallocatedCash,
    caixinhaSuggestion,
    projectedMonthlyIncomeGain: Number(totalIncome.toFixed(2)),
    items,
    strategyExplanation: explanation,
  };
}
