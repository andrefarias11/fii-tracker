export interface Transaction {
  id: string;
  ticker: string;
  type?: 'BUY' | 'SELL' | 'DIVIDEND'; // Padrão: 'BUY' ('DIVIDEND' = provento real da aba Movimentação B3)
  date: string; // YYYY-MM-DD
  shares: number;
  price: number; // Preço pago/recebido por cota (ou valor unitário do provento)
  total: number;
  splitAdjustment?: { effectiveDate: string; factor: number; source: string };
  broker: string; // Ex: "XP Investimentos"
  notes?: string;
}

export type AssetClass = 'FII' | 'ACAO';

export interface FiiCatalogItem {
  ticker: string;
  name: string;
  assetClass?: AssetClass; // Padrão: 'FII'
  segment:
    | 'Papel'
    | 'Tijolo - Logística'
    | 'Tijolo - Shopping'
    | 'Tijolo - Renda Urbana'
    | 'Tijolo - Lajes'
    | 'FOF'
    | 'Fiagro'
    | 'Ações - Bancos'
    | 'Ações - Energia'
    | 'Ações - Saneamento'
    | 'Ações - Seguros'
    | 'Ações - Commodities'
    | 'Ações - Telecom & Indústria'
    | 'Ações - Outros'
    | 'Outros';
  base: 10 | 100;
  vp: number; // Valor Patrimonial de referência por cota/ação (VP ou VPA)
  estimatedMonthlyDividend: number; // Dividendo mensal (FII) ou média mensal equivalente 12m/12 (Ação)
  announcementDay?: number;
  paymentDay?: number;
}


export interface FiiPosition {
  ticker: string;
  name: string;
  assetClass: AssetClass;
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
  ceilingPrice: number; // Preço teto (0.90% a.m. para FIIs ou 6% a.a. Barsi para Ações)
  magicNumber: number; // Quantas cotas/ações precisa para comprar 1 por mês
  magicProgressPercent: number;
  paybackReceived?: number; // Total acumulado de dividendos já recebidos deste ativo desde o 1º aporte
  paybackPercent?: number; // % do valor investido que já retornou em dividendos
  dailyChangePercent?: number;
  lastUpdated?: string;
  announcedDividendPerShare?: number;
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
  assetClass?: AssetClass;
  price: number;
  changePercent: number;
  prevClose: number;
  lastDividend?: number; // Dividendo mensal (FII) ou média mensal 12m/12 (Ação)
  annualDividend12m?: number; // Soma acumulada 12 meses por cota/ação
  announcedDividendPerShare?: number;
  dividendExDate?: string; // Ex: "30/09/2026"
  dividendPaymentDate?: string; // Ex: "15/10/2026"
  dividendPaymentDay?: number;
  isCurrentMonthAnnounced?: boolean;
  dividendSource?: 'B3_OFICIAL' | 'MERCADO';
  vp?: number;
  pvp?: number;
  updatedAt: string;
}

export interface FocusYearlyProjection {
  year: number;
  selicMedian: number;
  ipcaMedian: number;
  realRateAnnual: number;
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
  focusReportDate?: string;
  focusProjections?: FocusYearlyProjection[];
}

export type FixedIncomeType =
  | 'CAIXINHA' // Caixinhas (Nubank, PicPay, Mercado Pago, etc.)
  | 'CDB' // CDB 100% CDI, 110% CDI, Liquidez Diária
  | 'TESOURO_SELIC' // Tesouro Selic (Reserva de Emergência)
  | 'TESOURO_IPCA' // Tesouro IPCA+ (Proteção contra inflação)
  | 'TESOURO_PREFIXADO' // Tesouro Prefixado
  | 'LCI_LCA' // LCI / LCA (Isentos de Imposto de Renda)
  | 'OUTROS';

export interface FixedIncomeAsset {
  id: string;
  name: string; // Ex: "Caixinha Reserva Nubank", "Tesouro Selic 2029", "CDB XP 110% CDI"
  type: FixedIncomeType;
  institution: string; // Ex: "Nubank", "XP", "Tesouro Direto", "Inter", "Itaú"
  investedAmount: number; // Valor original aplicado (R$)
  currentBalance: number; // Saldo atual acumulado com rendimentos (R$)
  rateType: 'CDI' | 'IPCA' | 'PREFIXADO';
  ratePercent: number; // Ex: 100 (% do CDI) ou 6.5 (IPCA + 6.5%) ou 12.0 (% Prefixado)
  isExempt: boolean; // Se é isento de IR (LCI/LCA = true)
  maturityDate?: string; // YYYY-MM-DD (Data de vencimento opcional)
  notes?: string;
  updatedAt: string; // YYYY-MM-DD
}

export interface UnifiedPortfolioSummary {
  // Bolsa (FIIs + Ações)
  bolsaEquity: number;
  bolsaInvested: number;
  bolsaProfitLoss: number;
  bolsaProfitLossPercent: number;
  bolsaMonthlyDividends: number;

  // Renda Fixa & Caixinhas
  fixedIncomeEquity: number;
  fixedIncomeInvested: number;
  fixedIncomeProfitLoss: number;
  fixedIncomeMonthlyYield: number; // Rendimento mensal líquido estimado em R$

  // Patrimônio Unificado Global
  totalGlobalEquity: number;
  totalGlobalInvested: number;
  totalGlobalProfitLoss: number;
  totalGlobalProfitLossPercent: number;
  totalGlobalMonthlyIncome: number; // Dividendos da Bolsa + Rendimento da Renda Fixa

  // Macro Alocação (%)
  fiiEquity: number;
  fiiPercent: number;
  acaoEquity: number;
  acaoPercent: number;
  fixedIncomePercent: number;
}



