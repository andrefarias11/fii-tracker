import type { Transaction, FixedIncomeAsset, PortfolioGoals } from '../types/portfolio';
export const BASE_KEY_TRANSACTIONS = 'fii_tracker_transactions_v1';
export const BASE_KEY_GOALS = 'fii_tracker_goals_v1';
export const BASE_KEY_DIVIDENDS = 'fii_tracker_dividends_v1';
export const BASE_KEY_FIXED_INCOME = 'fii_tracker_fixed_income_v1';

export function getScopedStorageKey(baseKey: string, userId: string | null): string {
  const scope = userId ? userId : 'guest';
  return `${baseKey}_${scope}`;
}

export const DEFAULT_GOALS: PortfolioGoals = {
  monthlyTarget: 200,
  milestoneEquityTarget: 1000,
  monthlyIncomeTarget: 10,
};

export const DEMO_FIXED_INCOME: FixedIncomeAsset[] = [
  {
    id: 'demo-fi-1',
    name: 'Caixinha Reserva Nubank',
    type: 'CAIXINHA',
    institution: 'Nubank',
    investedAmount: 500,
    currentBalance: 518.4,
    rateType: 'CDI',
    ratePercent: 100,
    isExempt: false,
    updatedAt: '2026-10-01',
    notes: 'Reserva com liquidez imediata (100% CDI)',
  },
];

export const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: 'demo-1',
    ticker: 'MXRF11',
    date: '2026-10-01',
    shares: 11,
    price: 9.42,
    total: 103.62,
    broker: 'XP Investimentos',
    notes: 'Primeiro aporte do mês',
  },
  {
    id: 'demo-2',
    ticker: 'VGIR11',
    date: '2026-10-01',
    shares: 10,
    price: 9.6,
    total: 96.0,
    broker: 'XP Investimentos',
    notes: 'Diversificação em Papel/CDI',
  },
];

export function loadScopedData(userId: string | null) {
  if (typeof window === 'undefined') {
    return {
      transactions: [],
      fixedIncomeAssets: [],
      goals: DEFAULT_GOALS,
      customDividends: {},
    };
  }

  const txKey = getScopedStorageKey(BASE_KEY_TRANSACTIONS, userId);
  const fiKey = getScopedStorageKey(BASE_KEY_FIXED_INCOME, userId);
  const goalsKey = getScopedStorageKey(BASE_KEY_GOALS, userId);
  const divKey = getScopedStorageKey(BASE_KEY_DIVIDENDS, userId);

  const rawTx = localStorage.getItem(txKey);
  const rawFi = localStorage.getItem(fiKey);
  const rawGoals = localStorage.getItem(goalsKey);
  const rawDiv = localStorage.getItem(divKey);

  let transactions: Transaction[] = [];
  let fixedIncomeAssets: FixedIncomeAsset[] = [];
  let goals: PortfolioGoals = DEFAULT_GOALS;
  let customDividends: Record<string, number> = {};

  try {
    if (rawTx) transactions = JSON.parse(rawTx);
  } catch {}
  try {
    if (rawFi) fixedIncomeAssets = JSON.parse(rawFi);
  } catch {}
  try {
    if (rawGoals) goals = JSON.parse(rawGoals);
  } catch {}
  try {
    if (rawDiv) customDividends = JSON.parse(rawDiv);
  } catch {}

  return { transactions, fixedIncomeAssets, goals, customDividends };
}

