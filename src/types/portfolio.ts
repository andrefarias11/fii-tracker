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
  estimatedMonthlyDividend: number; // Ex: 0.09
}

export interface FiiPosition {
  ticker: string;
  name: string;
  segment: string;
  base: 10 | 100;
  totalShares: number;
  averagePrice: number;
  totalInvested: number;
  currentPrice: number;
  currentTotal: number;
  profitLoss: number;
  profitLossPercent: number;
  monthlyDividendPerShare: number;
  totalMonthlyDividend: number;
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
  updatedAt: string;
}

