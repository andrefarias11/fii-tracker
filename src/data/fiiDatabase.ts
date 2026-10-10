import { FiiCatalogItem } from '../types/portfolio';

export const FII_DATABASE: FiiCatalogItem[] = [
  // FIIs Base 10 (Ideais para quem aporta R$ 200/mês para diversificar facilmente)
  { ticker: 'MXRF11', name: 'Maxi Renda FII', segment: 'Papel', base: 10, vp: 9.72, estimatedMonthlyDividend: 0.09, announcementDay: 1, paymentDay: 15 },
  { ticker: 'VGIR11', name: 'Valora RE III', segment: 'Papel', base: 10, vp: 9.85, estimatedMonthlyDividend: 0.10, announcementDay: 1, paymentDay: 14 },
  { ticker: 'CPTS11', name: 'Capitânia Securities', segment: 'Papel', base: 10, vp: 8.92, estimatedMonthlyDividend: 0.07, announcementDay: 1, paymentDay: 15 },
  { ticker: 'MCCI11', name: 'Mauá Capital Recebíveis', segment: 'Papel', base: 100, vp: 94.50, estimatedMonthlyDividend: 0.85, announcementDay: 1, paymentDay: 15 },
  { ticker: 'KISU11', name: 'Kilima FIC de FII', segment: 'FOF', base: 10, vp: 8.78, estimatedMonthlyDividend: 0.075, announcementDay: 1, paymentDay: 14 },
  { ticker: 'GALG11', name: 'Guardian Logística', segment: 'Tijolo - Logística', base: 10, vp: 9.15, estimatedMonthlyDividend: 0.084, announcementDay: 7, paymentDay: 14 },
  { ticker: 'VGHF11', name: 'Valora Hedge Fund', segment: 'Outros', base: 10, vp: 8.85, estimatedMonthlyDividend: 0.085, announcementDay: 1, paymentDay: 7 },
  { ticker: 'GEXP11', name: 'Galapagos FII', segment: 'Papel', base: 10, vp: 9.60, estimatedMonthlyDividend: 0.08, announcementDay: 1, paymentDay: 15 },
  { ticker: 'RSPD11', name: 'RBR Desenvolvimento', segment: 'Outros', base: 10, vp: 9.80, estimatedMonthlyDividend: 0.09, announcementDay: 1, paymentDay: 15 },

  // Fiagros Base 10 (Foco em Agronegócio)
  { ticker: 'VGIA11', name: 'Valora CRA Fiagro', segment: 'Fiagro', base: 10, vp: 9.45, estimatedMonthlyDividend: 0.11, announcementDay: 1, paymentDay: 15 },
  { ticker: 'SNAG11', name: 'Suno Agro Fiagro', segment: 'Fiagro', base: 10, vp: 10.08, estimatedMonthlyDividend: 0.105, announcementDay: 1, paymentDay: 15 },
  { ticker: 'KNCA11', name: 'Kinea Crédito Agro', segment: 'Fiagro', base: 100, vp: 102.50, estimatedMonthlyDividend: 1.00, announcementDay: 1, paymentDay: 14 },

  // FIIs Base 100 Tradicionais (Tijolo, Papel e Shoppings)
  { ticker: 'XPML11', name: 'XP Malls FII', segment: 'Tijolo - Shopping', base: 100, vp: 112.30, estimatedMonthlyDividend: 0.92, announcementDay: 15, paymentDay: 25 },
  { ticker: 'VISC11', name: 'Vinci Shopping Centers', segment: 'Tijolo - Shopping', base: 100, vp: 125.10, estimatedMonthlyDividend: 1.00, announcementDay: 15, paymentDay: 24 },
  { ticker: 'HGLG11', name: 'CSHG Logística', segment: 'Tijolo - Logística', base: 100, vp: 154.20, estimatedMonthlyDividend: 1.10, announcementDay: 1, paymentDay: 15 },
  { ticker: 'BTLG11', name: 'BTG Pactual Logística', segment: 'Tijolo - Logística', base: 100, vp: 102.50, estimatedMonthlyDividend: 0.78, announcementDay: 15, paymentDay: 25 },
  { ticker: 'XPLG11', name: 'XP Log FII', segment: 'Tijolo - Logística', base: 100, vp: 109.80, estimatedMonthlyDividend: 0.78, announcementDay: 1, paymentDay: 15 },
  { ticker: 'KNCR11', name: 'Kinea Rendimentos (CDI)', segment: 'Papel', base: 100, vp: 101.80, estimatedMonthlyDividend: 1.05, announcementDay: 1, paymentDay: 14 },
  { ticker: 'KNIP11', name: 'Kinea Índice de Preços (IPCA)', segment: 'Papel', base: 100, vp: 93.40, estimatedMonthlyDividend: 0.80, announcementDay: 1, paymentDay: 14 },
  { ticker: 'KNSC11', name: 'Kinea Securities', segment: 'Papel', base: 100, vp: 8.95, estimatedMonthlyDividend: 0.09, announcementDay: 1, paymentDay: 14 },
  { ticker: 'RBRR11', name: 'RBR Rendimento High Grade', segment: 'Papel', base: 100, vp: 92.80, estimatedMonthlyDividend: 0.85, announcementDay: 1, paymentDay: 15 },
  { ticker: 'TRXF11', name: 'TRX Real Estate', segment: 'Tijolo - Renda Urbana', base: 100, vp: 101.20, estimatedMonthlyDividend: 0.93, announcementDay: 1, paymentDay: 15 },
  { ticker: 'TGAR11', name: 'TG Ativo Real', segment: 'Outros', base: 100, vp: 115.60, estimatedMonthlyDividend: 1.30, announcementDay: 1, paymentDay: 14 },
  { ticker: 'BTHF11', name: 'BTG Pactual Hedge Fund', segment: 'FOF', base: 10, vp: 9.85, estimatedMonthlyDividend: 0.10, announcementDay: 1, paymentDay: 15 },
  { ticker: 'HGRE11', name: 'CSHG Real Estate', segment: 'Tijolo - Lajes', base: 100, vp: 152.00, estimatedMonthlyDividend: 0.78, announcementDay: 1, paymentDay: 15 },
  { ticker: 'PVBI11', name: 'VBI Prime Properties', segment: 'Tijolo - Lajes', base: 100, vp: 106.40, estimatedMonthlyDividend: 0.65, announcementDay: 1, paymentDay: 15 }
];

export function findFiiInfo(ticker: string): FiiCatalogItem {
  const cleanTicker = ticker.toUpperCase().trim();
  const found = FII_DATABASE.find((item) => item.ticker === cleanTicker);
  if (found) return found;

  // Inferência padrão para novos tickers
  return {
    ticker: cleanTicker,
    name: `${cleanTicker} Fundo Imobiliário`,
    segment: 'Outros',
    base: cleanTicker.endsWith('11') ? 10 : 100,
    vp: 10.0,
    estimatedMonthlyDividend: 0.08,
    announcementDay: 1,
    paymentDay: 15
  };
}


