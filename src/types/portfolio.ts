export interface Transaction {
  id: string;
  ticker: string;
  date: string; // YYYY-MM-DD
  shares: number;
  price: number; // Preço pago por cota
  total: number;
  broker: string; // Ex: "XP Investimentos"
  notes?: string;
}

export interface FiiCatalogItem {
  ticker: string;
  name: string;
  segment: 'Papel' | 'Tijolo - Logística' | 'Tijolo - Shopping' | 'Tijolo - Renda Urbana' | 'Tijolo - Lajes' | 'FOF' | 'Fiagro' | 'Outros';
  base: 10 | 100;
  vp: number; // Valor Patrimonial de referência por cota
  estimatedMonthlyDividend: number; // Ex: 0.09
  announcementDay?: number;
  paymentDay?: number;
}


export interface FiiPosition {
  ticker: string;
  name: string;
  segment: string;
  base: 10 | 100;
  vp: number;
  pvp: number;
  totalShares: number;
  averagePrice: number;
  totalInvested: number;
  currentPrice: number;
  currentTotal: number;
  profitLoss: number;
  profitLossPercent: number;
  monthlyDividendPerShare: number;
  totalMonthlyDividend: number;
  currentYieldPercent: number; // Yield mensal sobre preço atual
  yieldOnCostPercent: number; // Yield mensal sobre preço médio pago (YoC)
  ceilingPrice: number; // Preço teto para 0.90% a.m.
  magicNumber: number; // Quantas cotas precisa para comprar 1 cota por mês
  magicProgressPercent: number;
  dailyChangePercent?: number;
  lastUpdated?: string;
}

export interface PortfolioGoals {
  monthlyTarget: number; // Padrão: 200
  milestoneEquityTarget: number; // Ex: 1000, 5000, 10000
  monthlyIncomeTarget: number; // Ex: 10, 50, 100
}

export interface QuoteData {
  ticker: string;
  price: number;
  changePercent: number;
  prevClose: number;
  lastDividend?: number;
  updatedAt: string;
}


