import { FiiPosition, Transaction } from '../types/portfolio';
import { normalizeB3Ticker } from './b3Parser';

export type AchievementTier = 'BRONZE' | 'PRATA' | 'OURO' | 'PLATINA';
export type AchievementCategory =
  | 'PATRIMONIO'
  | 'RENDA_PASSIVA'
  | 'COTAS'
  | 'BOLA_DE_NEVE'
  | 'DIVERSIFICACAO';

export interface AchievementItem {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  tier: AchievementTier;
  category: AchievementCategory;
  xp: number;
  iconName: string;
  unlocked: boolean;
  unlockedAt?: string; // YYYY-MM-DD se calculado pelo histórico da B3
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  formattedCurrent: string;
  formattedTarget: string;
}

export interface AchievementsOverview {
  achievements: AchievementItem[];
  unlockedCount: number;
  totalCount: number;
  platinumProgressPercent: number;
  isPlatinumUnlocked: boolean;
  totalXp: number;
  maxXp: number;
  currentLevelTitle: string;
  nextAchievement: AchievementItem | null;
}

const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

/**
 * Calcula a data exata em que determinada meta acumulativa foi atingida nas transações da B3
 */
function findHistoricalUnlockDate(
  chronologicalRealTxs: Transaction[],
  predicate: (state: {
    totalShares: number;
    totalInvested: number;
    uniqueTickers: Set<string>;
    uniqueMonths: Set<string>;
    txCount: number;
  }) => boolean
): string | undefined {
  const sharesMap = new Map<string, { shares: number; avgPrice: number; invested: number }>();
  const uniqueMonths = new Set<string>();
  let txCount = 0;

  for (const tx of chronologicalRealTxs) {
    const ticker = normalizeB3Ticker(tx.ticker);
    if (!ticker) continue;

    txCount += 1;
    if (tx.type !== 'SELL' && tx.date.length >= 7) {
      uniqueMonths.add(tx.date.slice(0, 7));
    }

    const curr = sharesMap.get(ticker) || { shares: 0, avgPrice: 0, invested: 0 };
    if (tx.type === 'SELL') {
      const sold = Math.min(curr.shares, Math.abs(tx.shares));
      curr.shares = Math.max(0, curr.shares - sold);
      curr.invested = curr.shares * curr.avgPrice;
    } else {
      curr.shares += Math.abs(tx.shares);
      curr.invested += Math.abs(tx.total);
      curr.avgPrice = curr.shares > 0 ? curr.invested / curr.shares : 0;
    }
    sharesMap.set(ticker, curr);

    let totalShares = 0;
    let totalInvested = 0;
    const activeTickers = new Set<string>();

    for (const [tk, data] of sharesMap.entries()) {
      if (data.shares > 0) {
        totalShares += data.shares;
        totalInvested += data.invested;
        activeTickers.add(tk);
      }
    }

    if (
      predicate({
        totalShares,
        totalInvested,
        uniqueTickers: activeTickers,
        uniqueMonths,
        txCount,
      })
    ) {
      return tx.date;
    }
  }

  return undefined;
}

export function evaluateAchievements(
  positions: FiiPosition[],
  transactions: Transaction[],
  summary: {
    totalInvested: number;
    currentEquity: number;
    totalMonthlyDividends: number;
  }
): AchievementsOverview {
  // Filtra apenas transações reais (ignora demo-* para garantir integridade do modo B3-Only)
  const realTxs = transactions.filter((t) => !t.id.startsWith('demo-'));
  const chronologicalTxs = [...realTxs].sort((a, b) => a.date.localeCompare(b.date));

  const hasOnlyDemo = transactions.length > 0 && realTxs.length === 0;
  const effectivePositions = hasOnlyDemo ? [] : positions;
  const effectiveEquity = hasOnlyDemo ? 0 : Math.max(summary.currentEquity, summary.totalInvested);
  const effectiveMonthlyDividends = hasOnlyDemo ? 0 : summary.totalMonthlyDividends;

  const totalShares = effectivePositions.reduce((acc, p) => acc + p.totalShares, 0);
  const uniqueFiisCount = effectivePositions.length;

  const uniqueBuyMonths = new Set(
    chronologicalTxs.filter((t) => t.type !== 'SELL' && t.date.length >= 7).map((t) => t.date.slice(0, 7))
  ).size;

  // Verifica se possui Papel + Tijolo/Híbrido
  const hasPaper = effectivePositions.some((p) => p.segment.toLowerCase().includes('papel'));
  const hasBrickOrHybrid = effectivePositions.some(
    (p) => !p.segment.toLowerCase().includes('papel')
  );
  const segmentClassesCount = (hasPaper ? 1 : 0) + (hasBrickOrHybrid ? 1 : 0);

  // Melhor progresso rumo ao Número Mágico
  const bestMagicProgress =
    effectivePositions.length > 0
      ? Math.max(...effectivePositions.map((p) => p.magicProgressPercent))
      : 0;
  const magicReachedCount = effectivePositions.filter((p) => p.magicProgressPercent >= 100).length;

  const latestTxDate =
    chronologicalTxs.length > 0 ? chronologicalTxs[chronologicalTxs.length - 1].date : undefined;

  const rawList: Omit<AchievementItem, 'progressPercent' | 'unlocked'>[] = [
    {
      id: 'first_b3_import',
      order: 1,
      title: 'Batismo na B3',
      subtitle: '1º Aporte Oficial Importado',
      description: 'Importar sua primeira planilha oficial da B3 com pelo menos 1 compra real de FII.',
      tier: 'BRONZE',
      category: 'PATRIMONIO',
      xp: 50,
      iconName: 'FileSpreadsheet',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.txCount >= 1),
      currentValue: realTxs.length > 0 ? 1 : 0,
      targetValue: 1,
      formattedCurrent: `${realTxs.length > 0 ? 1 : 0}`,
      formattedTarget: '1 planilha',
    },
    {
      id: 'shares_10',
      order: 2,
      title: 'Dezena de Tijolos',
      subtitle: 'Acumular 10 cotas na carteira',
      description: 'Alcançar suas primeiras 10 cotas somadas de Fundos Imobiliários.',
      tier: 'BRONZE',
      category: 'COTAS',
      xp: 50,
      iconName: 'Layers',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.totalShares >= 10),
      currentValue: totalShares,
      targetValue: 10,
      formattedCurrent: `${totalShares} cotas`,
      formattedTarget: '10 cotas',
    },
    {
      id: 'income_5',
      order: 3,
      title: 'Café Pago pelos FIIs',
      subtitle: 'R$ 5,00/mês em dividendos',
      description: 'Gerar R$ 5,00 por mês de renda passiva isenta de Imposto de Renda.',
      tier: 'BRONZE',
      category: 'RENDA_PASSIVA',
      xp: 75,
      iconName: 'Coffee',
      unlockedAt: effectiveMonthlyDividends >= 5 ? latestTxDate : undefined,
      currentValue: effectiveMonthlyDividends,
      targetValue: 5,
      formattedCurrent: formatBRL(effectiveMonthlyDividends),
      formattedTarget: formatBRL(5),
    },
    {
      id: 'diversify_3_fiis',
      order: 4,
      title: 'Trindade Imobiliária',
      subtitle: '3 FIIs diferentes na carteira',
      description: 'Construir uma carteira com pelo menos 3 Fundos Imobiliários distintos.',
      tier: 'BRONZE',
      category: 'DIVERSIFICACAO',
      xp: 75,
      iconName: 'PieChart',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.uniqueTickers.size >= 3),
      currentValue: uniqueFiisCount,
      targetValue: 3,
      formattedCurrent: `${uniqueFiisCount} FIIs`,
      formattedTarget: '3 FIIs',
    },
    {
      id: 'equity_500',
      order: 5,
      title: 'Primeiros R$ 500',
      subtitle: 'R$ 500,00 de patrimônio',
      description: 'Acumular R$ 500,00 de patrimônio consolidado em Fundos Imobiliários.',
      tier: 'BRONZE',
      category: 'PATRIMONIO',
      xp: 100,
      iconName: 'Wallet',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.totalInvested >= 500),
      currentValue: effectiveEquity,
      targetValue: 500,
      formattedCurrent: formatBRL(effectiveEquity),
      formattedTarget: formatBRL(500),
    },
    {
      id: 'shares_50',
      order: 6,
      title: 'Meio Centenário',
      subtitle: 'Acumular 50 cotas na carteira',
      description: 'Chegar à marca de 50 cotas gerando dividendos todos os meses.',
      tier: 'PRATA',
      category: 'COTAS',
      xp: 120,
      iconName: 'Building2',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.totalShares >= 50),
      currentValue: totalShares,
      targetValue: 50,
      formattedCurrent: `${totalShares} cotas`,
      formattedTarget: '50 cotas',
    },
    {
      id: 'income_10',
      order: 7,
      title: 'Fábrica de Moedas',
      subtitle: 'R$ 10,00/mês em dividendos',
      description: 'Atingir dois dígitos (R$ 10,00/mês) em proventos mensais recorrentes.',
      tier: 'PRATA',
      category: 'RENDA_PASSIVA',
      xp: 150,
      iconName: 'Coins',
      unlockedAt: effectiveMonthlyDividends >= 10 ? latestTxDate : undefined,
      currentValue: effectiveMonthlyDividends,
      targetValue: 10,
      formattedCurrent: formatBRL(effectiveMonthlyDividends),
      formattedTarget: formatBRL(10),
    },
    {
      id: 'equity_1000',
      order: 8,
      title: 'Clube dos 4 Dígitos',
      subtitle: 'R$ 1.000,00 de patrimônio',
      description: 'Romper a barreira psicológica dos primeiros R$ 1.000,00 investidos na B3.',
      tier: 'PRATA',
      category: 'PATRIMONIO',
      xp: 200,
      iconName: 'Landmark',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.totalInvested >= 1000),
      currentValue: effectiveEquity,
      targetValue: 1000,
      formattedCurrent: formatBRL(effectiveEquity),
      formattedTarget: formatBRL(1000),
    },
    {
      id: 'hybrid_shield',
      order: 9,
      title: 'Escudo Híbrido',
      subtitle: 'Papel (CRI) + Tijolo/Agro',
      description: 'Equilibrar a carteira combinando FIIs de Papel com FIIs de Tijolo, Fiagro ou FoF.',
      tier: 'PRATA',
      category: 'DIVERSIFICACAO',
      xp: 150,
      iconName: 'ShieldCheck',
      unlockedAt: segmentClassesCount >= 2 ? latestTxDate : undefined,
      currentValue: segmentClassesCount,
      targetValue: 2,
      formattedCurrent: `${segmentClassesCount}/2 classes`,
      formattedTarget: '2 classes',
    },
    {
      id: 'consistent_3_months',
      order: 10,
      title: 'Hábito Inabalável',
      subtitle: 'Aportar em 3 meses diferentes',
      description: 'Comprovar constância no longo prazo realizando compras na B3 em 3 meses distintos.',
      tier: 'PRATA',
      category: 'DIVERSIFICACAO',
      xp: 180,
      iconName: 'CalendarCheck',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.uniqueMonths.size >= 3),
      currentValue: uniqueBuyMonths,
      targetValue: 3,
      formattedCurrent: `${uniqueBuyMonths} meses`,
      formattedTarget: '3 meses',
    },
    {
      id: 'shares_100',
      order: 11,
      title: 'Centurião das Cotas',
      subtitle: 'Acumular 100 cotas na B3',
      description: 'Alcançar 100 cotas somadas trabalhando para você 24 horas por dia.',
      tier: 'PRATA',
      category: 'COTAS',
      xp: 200,
      iconName: 'Award',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.totalShares >= 100),
      currentValue: totalShares,
      targetValue: 100,
      formattedCurrent: `${totalShares} cotas`,
      formattedTarget: '100 cotas',
    },
    {
      id: 'income_25',
      order: 12,
      title: 'Streaming Pago',
      subtitle: 'R$ 25,00/mês em dividendos',
      description: 'Receber R$ 25,00/mês em dividendos — suficiente para pagar um streaming todo mês.',
      tier: 'OURO',
      category: 'RENDA_PASSIVA',
      xp: 250,
      iconName: 'Sparkles',
      unlockedAt: effectiveMonthlyDividends >= 25 ? latestTxDate : undefined,
      currentValue: effectiveMonthlyDividends,
      targetValue: 25,
      formattedCurrent: formatBRL(effectiveMonthlyDividends),
      formattedTarget: formatBRL(25),
    },
    {
      id: 'diversify_5_fiis',
      order: 13,
      title: 'Carteira Blindada',
      subtitle: '5 FIIs diferentes na carteira',
      description: 'Ter 5 ou mais Fundos Imobiliários diferentes protegendo seu patrimônio.',
      tier: 'OURO',
      category: 'DIVERSIFICACAO',
      xp: 250,
      iconName: 'Compass',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.uniqueTickers.size >= 5),
      currentValue: uniqueFiisCount,
      targetValue: 5,
      formattedCurrent: `${uniqueFiisCount} FIIs`,
      formattedTarget: '5 FIIs',
    },
    {
      id: 'equity_2500',
      order: 14,
      title: 'Reserva de Valor',
      subtitle: 'R$ 2.500,00 de patrimônio',
      description: 'Alcançar R$ 2.500,00 de patrimônio acumulado em FIIs na B3.',
      tier: 'OURO',
      category: 'PATRIMONIO',
      xp: 300,
      iconName: 'Gem',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.totalInvested >= 2500),
      currentValue: effectiveEquity,
      targetValue: 2500,
      formattedCurrent: formatBRL(effectiveEquity),
      formattedTarget: formatBRL(2500),
    },
    {
      id: 'magic_halfway',
      order: 15,
      title: 'Engrenagem Girando',
      subtitle: '50% do Número Mágico em 1 FII',
      description: 'Chegar na metade do caminho para que os dividendos de 1 FII comprem uma nova cota sozinhos.',
      tier: 'OURO',
      category: 'BOLA_DE_NEVE',
      xp: 300,
      iconName: 'Zap',
      unlockedAt: bestMagicProgress >= 50 ? latestTxDate : undefined,
      currentValue: bestMagicProgress,
      targetValue: 50,
      formattedCurrent: `${bestMagicProgress}%`,
      formattedTarget: '50%',
    },
    {
      id: 'income_50',
      order: 16,
      title: 'Conta de Luz/Internet',
      subtitle: 'R$ 50,00/mês em dividendos',
      description: 'Receber R$ 50,00 mensais isentos de IR — seus FIIs já pagam um boleto da casa!',
      tier: 'OURO',
      category: 'RENDA_PASSIVA',
      xp: 350,
      iconName: 'Flame',
      unlockedAt: effectiveMonthlyDividends >= 50 ? latestTxDate : undefined,
      currentValue: effectiveMonthlyDividends,
      targetValue: 50,
      formattedCurrent: formatBRL(effectiveMonthlyDividends),
      formattedTarget: formatBRL(50),
    },
    {
      id: 'equity_5000',
      order: 17,
      title: 'Patrimônio de R$ 5.000',
      subtitle: 'R$ 5.000,00 em FIIs na B3',
      description: 'Acumular R$ 5.000,00 em ativos reais geradores de renda.',
      tier: 'OURO',
      category: 'PATRIMONIO',
      xp: 400,
      iconName: 'TrendingUp',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.totalInvested >= 5000),
      currentValue: effectiveEquity,
      targetValue: 5000,
      formattedCurrent: formatBRL(effectiveEquity),
      formattedTarget: formatBRL(5000),
    },
    {
      id: 'first_magic_number',
      order: 18,
      title: 'Bola de Neve Ativada',
      subtitle: '100% do Número Mágico em 1 FII',
      description: 'Atingir o Número Mágico em 1 FII: o dividendo mensal dele já compra 1 nova cota sozinho!',
      tier: 'PLATINA',
      category: 'BOLA_DE_NEVE',
      xp: 500,
      iconName: 'Snowflake',
      unlockedAt: magicReachedCount >= 1 ? latestTxDate : undefined,
      currentValue: bestMagicProgress,
      targetValue: 100,
      formattedCurrent: `${bestMagicProgress}%`,
      formattedTarget: '100%',
    },
    {
      id: 'shares_500',
      order: 19,
      title: 'Barão das Cotas',
      subtitle: 'Acumular 500 cotas na B3',
      description: 'Possuir meio milhar (500 cotas) de Fundos Imobiliários custodiados na B3.',
      tier: 'PLATINA',
      category: 'COTAS',
      xp: 500,
      iconName: 'Crown',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.totalShares >= 500),
      currentValue: totalShares,
      targetValue: 500,
      formattedCurrent: `${totalShares} cotas`,
      formattedTarget: '500 cotas',
    },
    {
      id: 'equity_10000',
      order: 20,
      title: 'Clube dos 5 Dígitos',
      subtitle: 'R$ 10.000,00 de patrimônio',
      description: 'Alcançar o marco épico de R$ 10.000,00 de patrimônio em FIIs com renda mensal na casa de R$ 100.',
      tier: 'PLATINA',
      category: 'PATRIMONIO',
      xp: 600,
      iconName: 'Trophy',
      unlockedAt: findHistoricalUnlockDate(chronologicalTxs, (s) => s.totalInvested >= 10000),
      currentValue: effectiveEquity,
      targetValue: 10000,
      formattedCurrent: formatBRL(effectiveEquity),
      formattedTarget: formatBRL(10000),
    },
  ];

  const achievements: AchievementItem[] = rawList.map((item) => {
    const progressPercent = Math.min(
      100,
      Math.max(0, Math.round((item.currentValue / item.targetValue) * 100))
    );
    const unlocked = item.currentValue >= item.targetValue;
    return {
      ...item,
      progressPercent,
      unlocked,
    };
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const platinumProgressPercent = Math.round((unlockedCount / totalCount) * 100);
  const isPlatinumUnlocked = unlockedCount === totalCount;

  const totalXp = achievements.filter((a) => a.unlocked).reduce((acc, a) => acc + a.xp, 0);
  const maxXp = achievements.reduce((acc, a) => acc + a.xp, 0);

  let currentLevelTitle = 'Iniciante na B3';
  if (unlockedCount === 20) currentLevelTitle = 'Lenda Platina dos FIIs 🏆';
  else if (unlockedCount >= 15) currentLevelTitle = 'Viver de Renda (Ouro)';
  else if (unlockedCount >= 10) currentLevelTitle = 'Construtor de Bola de Neve';
  else if (unlockedCount >= 5) currentLevelTitle = 'Investidor Consistente';
  else if (unlockedCount >= 1) currentLevelTitle = 'Cotista Oficial B3';

  // Próxima conquista mais próxima de desbloquear
  const lockedSorted = achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.progressPercent - a.progressPercent || a.order - b.order);

  return {
    achievements,
    unlockedCount,
    totalCount,
    platinumProgressPercent,
    isPlatinumUnlocked,
    totalXp,
    maxXp,
    currentLevelTitle,
    nextAchievement: lockedSorted[0] || null,
  };
}

