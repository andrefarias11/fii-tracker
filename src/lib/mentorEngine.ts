import { EvaluatedFii, evaluateAllFiis } from './recommendationEngine';
import { FiiPosition, QuoteData } from '../types/portfolio';

export type MentorId = 'barsi' | 'buffett' | 'graham' | 'baroni';

export interface MentorPick {
  fii: EvaluatedFii;
  rank: number;
  mentorScore: number;
  headline: string; // Ex: "Usando a estratégia Luiz Barsi, investir em MXRF11 devido a:"
  reasons: string[]; // Pontos objetivos com dados ao vivo da B3
  keyMetricLabel: string;
  keyMetricValue: string;
  suggestedSharesForBudget: number;
  monthlyIncomeFromBudget: number;
}

export interface MentorAnalysis {
  id: MentorId;
  name: string;
  title: string;
  badge: string;
  quote: string;
  accentColor: 'emerald' | 'amber' | 'sky' | 'violet';
  philosophySummary: string;
  pillars: string[];
  portfolioDiagnosis?: string;
  topPicks: MentorPick[];
}

export interface MentorConsensusItem {
  fii: EvaluatedFii;
  mentors: { id: MentorId; name: string; badge: string }[];
  combinedReason: string;
}

const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function evaluateMentorsRecommendations(
  quotes: Record<string, QuoteData>,
  positions: FiiPosition[],
  monthlyBudget: number = 400
): {
  mentors: MentorAnalysis[];
  consensus: MentorConsensusItem[];
} {
  const allFiis = evaluateAllFiis(quotes, positions);
  const effectiveBudget = Math.max(100, monthlyBudget);

  // Cálculo de pesos atuais da carteira para o diagnóstico do Prof. Baroni
  const totalEquity = positions.reduce((acc, p) => acc + p.currentTotal, 0);
  const paperEquity = positions
    .filter((p) => p.segment.toLowerCase().includes('papel') || p.segment.toLowerCase().includes('fiagro'))
    .reduce((acc, p) => acc + p.currentTotal, 0);
  const brickEquity = positions
    .filter((p) => p.segment.toLowerCase().includes('tijolo') || p.segment.toLowerCase().includes('log') || p.segment.toLowerCase().includes('shop'))
    .reduce((acc, p) => acc + p.currentTotal, 0);

  const paperPercent = totalEquity > 0 ? Math.round((paperEquity / totalEquity) * 100) : 0;
  const brickPercent = totalEquity > 0 ? Math.round((brickEquity / totalEquity) * 100) : 0;

  // ============================================================================
  // 1. LUIZ BARSI FILHO — "O Rei dos Dividendos & Carteira Previdenciária"
  // Foco: Preço-Teto, Acúmulo de Grande Quantidade de Cotas (Base 10), Renda Mensal Forte e Perenidade
  // ============================================================================
  const barsiCandidates = [...allFiis]
    .map((fii) => {
      let score = 0;
      const belowCeiling = fii.currentPrice <= fii.ceilingPrice;
      const ceilingMarginPercent = Number(
        (((fii.ceilingPrice - fii.currentPrice) / fii.ceilingPrice) * 100).toFixed(1)
      );

      // 1. Regra de Ouro do Preço-Teto
      if (belowCeiling) score += 35 + Math.min(20, Math.max(0, ceilingMarginPercent * 2));
      else if (fii.currentPrice <= fii.barsiCeilingPrice) score += 20;
      else score -= 25;

      // 2. Foco em acumular MUITAS cotas (Base 10 acelera a Bola de Neve mensal)
      if (fii.base === 10) score += 22;

      // 3. Dividend Yield elevado e recorrente
      score += fii.monthlyYieldPercent * 18;

      // 4. Bônus se o usuário já possui na carteira e está próximo do Número Mágico
      const userPos = positions.find((p) => p.ticker === fii.ticker);
      if (userPos && userPos.totalShares < userPos.magicNumber) {
        score += 10;
      }

      const sharesForBudget = Math.max(1, Math.floor(effectiveBudget / fii.currentPrice));
      const incomeFromBudget = Number((sharesForBudget * fii.monthlyDividend).toFixed(2));

      const reasons: string[] = [
        `Cotado a ${formatBRL(fii.currentPrice)} na B3, respeitando o Preço-Teto de ${formatBRL(fii.ceilingPrice)} (${
          ceilingMarginPercent >= 0
            ? `${ceilingMarginPercent}% de folga abaixo do teto`
            : `dentro do teto previdenciário de ${formatBRL(fii.barsiCeilingPrice)}`
        }).`,
        `Entrega dividendo mensal de ${formatBRL(fii.monthlyDividend)}/cota (${fii.monthlyYieldPercent}% a.m. ou ${fii.annualYieldPercent}% a.a. isento de IR).`,
        fii.base === 10
          ? `Foco na Quantidade de Cotas: com ${formatBRL(effectiveBudget)} você acumula +${sharesForBudget} cotas de uma vez, gerando +${formatBRL(incomeFromBudget)}/mês vitalícios.`
          : `Ativo previdenciário de alta solidez (${fii.management}) que gera +${formatBRL(fii.monthlyDividend)} por cota todo mês.`,
      ];

      if (userPos) {
        const remainingMagic = Math.max(0, userPos.magicNumber - userPos.totalShares);
        if (remainingMagic > 0) {
          reasons.push(
            `Acelera sua Bola de Neve: você já tem ${userPos.totalShares} cotas e faltam ${remainingMagic} para a cota infinita (Número Mágico).`
          );
        }
      }

      return {
        fii,
        mentorScore: Math.round(score),
        headline: `Usando a estratégia Luiz Barsi, investir em ${fii.ticker} devido a:`,
        reasons,
        keyMetricLabel: 'Preço-Teto Barsi',
        keyMetricValue: formatBRL(fii.ceilingPrice),
        suggestedSharesForBudget: sharesForBudget,
        monthlyIncomeFromBudget: incomeFromBudget,
      };
    })
    .sort((a, b) => b.mentorScore - a.mentorScore)
    .slice(0, 3)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // ============================================================================
  // 2. WARREN BUFFETT — "Value Investing, Fosso Competitivo (Moat) & Ativos Reais"
  // Foco: Imóveis/Ativos dominantes (Tijolo Triple-A / Crédito High Grade), baixa vacância, gestão de elite a preço justo
  // ============================================================================
  const buffettCandidates = [...allFiis]
    .map((fii) => {
      let score = 0;
      const isTijoloPremium =
        fii.segment.includes('Logística') ||
        fii.segment.includes('Shopping') ||
        fii.segment.includes('Renda Urbana');
      const isHighGradePaper =
        fii.ticker === 'KNCR11' || fii.ticker === 'MXRF11' || fii.ticker === 'CPTS11';

      // 1. Fosso Competitivo (Moat): Ativos físicos insubstituíveis ou High Grade líder
      if (isTijoloPremium) score += 38;
      else if (isHighGradePaper) score += 22;

      // 2. Baixa vacância física (Contratos fortes e demanda resiliente)
      if (typeof fii.vacancyPhysical === 'number') {
        if (fii.vacancyPhysical === 0) score += 22;
        else if (fii.vacancyPhysical <= 5) score += 16;
        else score += 8;
      }

      // 3. Preço Justo / Margem de Segurança (P/VP <= 1.01)
      if (fii.pvp <= 0.96) score += 28;
      else if (fii.pvp <= 1.00) score += 20;
      else if (fii.pvp <= 1.03) score += 8;
      else score -= 20;

      const sharesForBudget = Math.max(1, Math.floor(effectiveBudget / fii.currentPrice));
      const incomeFromBudget = Number((sharesForBudget * fii.monthlyDividend).toFixed(2));

      const reasons: string[] = [
        `Fosso Competitivo (Moat): ${fii.diversification} sob gestão da ${fii.management}.`,
        fii.pvp <= 1
          ? `Excelente ativo negociado com desconto na B3: P/VP de ${fii.pvp} (${fii.discountPercent}% abaixo do valor patrimonial de ${formatBRL(fii.vp)}).`
          : `Negócio de altíssima qualidade cotado a preço justo na B3 (P/VP ${fii.pvp}, VP de ${formatBRL(fii.vp)}).`,
        typeof fii.vacancyPhysical === 'number'
          ? `Operação física resiliente com vacância de apenas ${fii.vacancyPhysical}% e fluxo de caixa previsível (${fii.annualYieldPercent}% a.a.).`
          : `${fii.thesis}`,
      ];

      return {
        fii,
        mentorScore: Math.round(score),
        headline: `Usando a estratégia Warren Buffett, investir em ${fii.ticker} devido a:`,
        reasons,
        keyMetricLabel: 'Fosso / P/VP',
        keyMetricValue: `P/VP ${fii.pvp}`,
        suggestedSharesForBudget: sharesForBudget,
        monthlyIncomeFromBudget: incomeFromBudget,
      };
    })
    .sort((a, b) => b.mentorScore - a.mentorScore)
    .slice(0, 3)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // ============================================================================
  // 3. BENJAMIN GRAHAM — "Margem de Segurança Estrita (Comprar R$ 1 por R$ 0,85)"
  // Foco: Maior desconto patrimonial (Menor P/VP da bolsa) combinado com pagamento regular de proventos
  // ============================================================================
  const grahamCandidates = [...allFiis]
    .map((fii) => {
      // Graham prioriza diretamente o maior desconto sobre o Valor Patrimonial (1 - P/VP)
      let score = fii.discountPercent * 6;
      if (fii.pvp < 0.95) score += 35;
      else if (fii.pvp <= 0.99) score += 20;
      else score -= 30;

      // Exige que o ativo também pague bons dividendos
      score += fii.monthlyYieldPercent * 12;

      const sharesForBudget = Math.max(1, Math.floor(effectiveBudget / fii.currentPrice));
      const incomeFromBudget = Number((sharesForBudget * fii.monthlyDividend).toFixed(2));
      const discountPerShare = Number(Math.max(0, fii.vp - fii.currentPrice).toFixed(2));

      const reasons: string[] = [
        `Margem de Segurança: cotado a ${formatBRL(fii.currentPrice)} para um Valor Patrimonial oficial de ${formatBRL(fii.vp)} (P/VP ${fii.pvp}).`,
        discountPerShare > 0
          ? `Você compra cada cota com ${fii.discountPercent}% de desconto (${formatBRL(discountPerShare)} "de graça" em patrimônio por cota comprada).`
          : `Proteção patrimonial com preço alinhado ao valor intrínseco dos ativos (${formatBRL(fii.vp)}).`,
        `Enquanto o mercado não corrige o preço para o VP, você recebe ${fii.monthlyYieldPercent}% a.m. (${fii.annualYieldPercent}% a.a.) em dividendos isentos.`,
      ];

      return {
        fii,
        mentorScore: Math.round(score),
        headline: `Usando a estratégia Benjamin Graham, investir em ${fii.ticker} devido a:`,
        reasons,
        keyMetricLabel: 'Margem de Desconto',
        keyMetricValue: fii.discountPercent > 0 ? `-${fii.discountPercent}% (P/VP ${fii.pvp})` : `P/VP ${fii.pvp}`,
        suggestedSharesForBudget: sharesForBudget,
        monthlyIncomeFromBudget: incomeFromBudget,
      };
    })
    .sort((a, b) => b.mentorScore - a.mentorScore)
    .slice(0, 3)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // ============================================================================
  // 4. PROF. MARCOS BARONI — "Equilíbrio Tijolo (60%) + Papel (40%) & Diversificação"
  // Foco: Diagnóstico real da carteira do usuário + P/VP contextualizado + Qualidade de Gestão
  // ============================================================================
  const needsMoreBrick = brickPercent < 55;
  const baroniDiagnosis =
    totalEquity > 0
      ? `Sua carteira hoje está com ${paperPercent}% em Papel/Fiagro e ${brickPercent}% em Tijolo. Pela diretriz clássica de equilíbrio (~60% Tijolo / 40% Papel), o foco agora é reforçar ${
          needsMoreBrick ? 'FIIs de Tijolo descontados' : 'FIIs de Papel High Grade descontados'
        } sem pulverizar.`
      : 'Para iniciar uma carteira previdenciária equilibrada em FIIs, combine 60% em Tijolo (proteção contra inflação) e 40% em Papel (renda mensal forte).';

  const baroniCandidates = [...allFiis]
    .map((fii) => {
      let score = fii.score;
      const isBrick =
        fii.segment.includes('Logística') ||
        fii.segment.includes('Shopping') ||
        fii.segment.includes('Renda Urbana');
      const isPaper = fii.segment.includes('Papel');

      if (needsMoreBrick && isBrick) score += 28;
      if (!needsMoreBrick && isPaper) score += 25;
      if (fii.rebalancesPortfolio) score += 15;
      if (fii.isBelowAveragePrice) score += 10;

      const sharesForBudget = Math.max(1, Math.floor(effectiveBudget / fii.currentPrice));
      const incomeFromBudget = Number((sharesForBudget * fii.monthlyDividend).toFixed(2));

      const reasons: string[] = [
        isBrick && needsMoreBrick
          ? `Corrige o peso da sua carteira: adiciona exposição em ${fii.segment} (hoje você tem ${brickPercent}% em Tijolo vs. meta ideal de ~60%).`
          : `Fortalece a geração de caixa da carteira no setor de ${fii.segment} com gestão ${fii.management}.`,
        `Relação Risco/Retorno atrativa na B3 hoje: P/VP de ${fii.pvp} com renda mensal de ${formatBRL(fii.monthlyDividend)}/cota (${fii.annualYieldPercent}% a.a.).`,
        fii.isBelowAveragePrice
          ? `Está abaixo do seu Preço Médio atual (${formatBRL(fii.userAveragePrice || 0)}), permitindo reduzir seu custo médio sem pulverizar a carteira.`
          : `Diversificação interna de qualidade: ${fii.diversification}.`,
      ];

      return {
        fii,
        mentorScore: Math.round(score),
        headline: `Usando a estratégia Prof. Baroni, investir em ${fii.ticker} devido a:`,
        reasons,
        keyMetricLabel: 'Papel na Carteira',
        keyMetricValue: isBrick ? 'Equilíbrio Tijolo' : 'Âncora de Renda',
        suggestedSharesForBudget: sharesForBudget,
        monthlyIncomeFromBudget: incomeFromBudget,
      };
    })
    .sort((a, b) => b.mentorScore - a.mentorScore)
    .slice(0, 3)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const mentors: MentorAnalysis[] = [
    {
      id: 'barsi',
      name: 'Luiz Barsi Filho',
      title: 'Rei dos Dividendos • Método Previdenciário',
      badge: 'Foco em Renda & Nº de Cotas',
      quote: '“Quem investe para viver de renda não olha cotação: foca em acumular a maior quantidade de cotas pagando abaixo do Preço-Teto.”',
      accentColor: 'emerald',
      philosophySummary:
        'Busca ativos perenes que paguem dividendos mensais fortes, comprando estritamente abaixo do Preço-Teto e priorizando FIIs onde seu aporte compra o maior número de cotas para girar a Bola de Neve.',
      pillars: [
        'Preço-Teto (Mín. 0,90% a.m.)',
        'Foco na Quantidade de Cotas',
        'Reinvestimento Total (Bola de Neve)',
      ],
      topPicks: barsiCandidates,
    },
    {
      id: 'buffett',
      name: 'Warren Buffett',
      title: 'Oráculo de Omaha • Value Investing & Moat',
      badge: 'Ativos Reais & Fosso Competitivo',
      quote: '“Preço é o que você paga, valor é o que você leva. Compre negócios maravilhosos com vantagens duradouras a um preço justo.”',
      accentColor: 'amber',
      philosophySummary:
        'Prioriza ativos reais tangíveis e dominantes (galpões logísticos Triple-A, shoppings líderes e contratos atípicos de longo prazo com grandes empresas) negociados abaixo ou no valor patrimonial.',
      pillars: [
        'Fosso Competitivo (Imóveis Premium)',
        'Inquilinos Gigantes & Baixa Vacância',
        'Margem de Segurança no Preço',
      ],
      topPicks: buffettCandidates,
    },
    {
      id: 'graham',
      name: 'Benjamin Graham',
      title: 'Pai do Value Investing • O Investidor Inteligente',
      badge: 'Desconto Patrimonial (P/VP)',
      quote: '“A Margem de Segurança é o segredo de um investimento sólido: compre R$ 1,00 de patrimônio real pagando R$ 0,85 ou R$ 0,90.”',
      accentColor: 'sky',
      philosophySummary:
        'Filtra de forma rigorosa os FIIs que estão sendo negociados na B3 com o maior desconto em relação ao Valor Patrimonial (menor P/VP), protegendo seu capital contra quedas.',
      pillars: [
        'Maior Desconto sobre o VP (P/VP < 1)',
        'Proteção contra Quedas',
        'Dividendos pagos com Desconto',
      ],
      topPicks: grahamCandidates,
    },
    {
      id: 'baroni',
      name: 'Prof. Marcos Baroni',
      title: 'Especialista em FIIs • Equilíbrio Setorial',
      badge: '60% Tijolo / 40% Papel',
      quote: '“Diversificar não é pulverizar: é construir uma carteira equilibrada entre Tijolo (proteção) e Papel (fluxo de caixa) conhecendo cada ativo.”',
      accentColor: 'violet',
      philosophySummary:
        'Analisa o peso atual da sua carteira e cruza com os múltiplos da B3 hoje para indicar os FIIs que melhor equilibram seu portfólio entre Tijolo e Papel.',
      pillars: [
        'Equilíbrio 60% Tijolo / 40% Papel',
        'Diversificação sem Pulverizar',
        'Gestão & P/VP Contextualizado',
      ],
      portfolioDiagnosis: baroniDiagnosis,
      topPicks: baroniCandidates,
    },
  ];

  // ============================================================================
  // 5. CONSENSO DOS MENTORES HOJE (FIIs recomendados por 2+ mentores simultaneamente)
  // ============================================================================
  const pickMap = new Map<
    string,
    {
      fii: EvaluatedFii;
      mentors: { id: MentorId; name: string; badge: string }[];
    }
  >();

  for (const mentor of mentors) {
    for (const pick of mentor.topPicks) {
      const existing = pickMap.get(pick.fii.ticker) || {
        fii: pick.fii,
        mentors: [],
      };
      existing.mentors.push({
        id: mentor.id,
        name: mentor.name,
        badge: mentor.badge,
      });
      pickMap.set(pick.fii.ticker, existing);
    }
  }

  const consensus: MentorConsensusItem[] = Array.from(pickMap.values())
    .filter((entry) => entry.mentors.length >= 2)
    .sort((a, b) => b.mentors.length - a.mentors.length || b.fii.score - a.fii.score)
    .map((entry) => ({
      fii: entry.fii,
      mentors: entry.mentors,
      combinedReason: `Aprovado simultaneamente por ${entry.mentors
        .map((m) => m.name)
        .join(' + ')} (Cotação B3: ${formatBRL(entry.fii.currentPrice)} • P/VP ${
        entry.fii.pvp
      } • Yield ${entry.fii.monthlyYieldPercent}% a.m.).`,
    }));

  return { mentors, consensus };
}

