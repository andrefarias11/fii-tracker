export type DividendStatus = 'ESTIMATED' | 'CONFIRMED' | 'PAID';

export interface DividendEvent {
  id: string;
  ticker: string;
  shares: number;
  dividendPerShare: number;
  totalValue: number;
  status: DividendStatus;
  paymentDateFormatted: string; // Ex: "15/10/2026"
  paymentDay: number; // Ex: 15
  announcementDate?: string; // Ex: "30/09/2026" (Data-Com)
  isOfficial: boolean; // Se foi anunciado oficialmente pela gestora
  dividendSource?: 'B3_OFICIAL' | 'MERCADO' | 'CATALOGO' | 'MANUAL';
}

export interface MonthProventosSummary {
  totalExpected: number;
  totalReceived: number;
  totalConfirmed: number;
  totalEstimated: number;
  receivedCount: number;
  confirmedCount: number;
  estimatedCount: number;
}

