export interface Transaction {
  id: string;
  ticker: string;
  type?: 'BUY' | 'SELL'; // Padrão: 'BUY'
  date: string; // YYYY-MM-DD
  shares: number;
  price: number; // Preço pago/recebido por cota
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
  dividendExDate?: string; // Data-Com oficial (DD/MM/YYYY)
  dividendPaymentDate?: string; // Data de pagamento oficial (DD/MM/YYYY)
  dividendPaymentDay?: number; // Dia numérico de pagamento
  isCurrentMonthAnnounced?: boolean; // Se o comunicado do mês atual já saiu oficialmente
  dividendSource?: 'B3_OFICIAL' | 'MERCADO' | 'CATALOGO' | 'MANUAL';
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
  dividendExDate?: string; // Ex: "30/09/2026"
  dividendPaymentDate?: string; // Ex: "15/10/2026"
  dividendPaymentDay?: number;
  isCurrentMonthAnnounced?: boolean;
  dividendSource?: 'B3_OFICIAL' | 'MERCADO';
  vp?: number;
  pvp?: number;
  updatedAt: string;
}

export interface BcbIndicators {
  selicAnnual: number;
  cdiAnnual: number;
  cdiNetAnnual: number;
  cdiNetMonthly: number;
  ipca12m: number;
  ipcaMonthly: number;
  updatedAt: string;
  source: 'BCB_OFICIAL' | 'FALLBACK';
}



