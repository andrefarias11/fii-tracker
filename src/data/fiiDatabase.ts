import { FiiCatalogItem } from '../types/portfolio';

export const FII_DATABASE: FiiCatalogItem[] = [
  // FIIs Base 10 (Ideais para quem aporta R$ 200/mês para diversificar facilmente)
  { ticker: 'MXRF11', name: 'Maxi Renda FII', segment: 'Papel', base: 10, estimatedMonthlyDividend: 0.09 },
  { ticker: 'VGIR11', name: 'Valora RE III', segment: 'Papel', base: 10, estimatedMonthlyDividend: 0.10 },
  { ticker: 'CPTS11', name: 'Capitânia Securities', segment: 'Papel', base: 10, estimatedMonthlyDividend: 0.07 },
  { ticker: 'MCCI11', name: 'Mauá Capital Recebíveis', segment: 'Papel', base: 100, estimatedMonthlyDividend: 0.85 },
  { ticker: 'KISU11', name: 'Kilima FIC de FII', segment: 'FOF', base: 10, estimatedMonthlyDividend: 0.075 },
  { ticker: 'GALG11', name: 'Guardian Logística', segment: 'Tijolo - Logística', base: 10, estimatedMonthlyDividend: 0.084 },
  { ticker: 'VGHF11', name: 'Valora Hedge Fund', segment: 'Outros', base: 10, estimatedMonthlyDividend: 0.085 },
  { ticker: 'GEXP11', name: 'Galapagos FII', segment: 'Papel', base: 10, estimatedMonthlyDividend: 0.08 },
  { ticker: 'RSPD11', name: 'RBR Desenvolvimento', segment: 'Outros', base: 10, estimatedMonthlyDividend: 0.09 },

  // Fiagros Base 10 (Foco em Agronegócio)
  { ticker: 'VGIA11', name: 'Valora CRA Fiagro', segment: 'Fiagro', base: 10, estimatedMonthlyDividend: 0.11 },
  { ticker: 'SNAG11', name: 'Suno Agro Fiagro', segment: 'Fiagro', base: 10, estimatedMonthlyDividend: 0.105 },
  { ticker: 'KNCA11', name: 'Kinea Crédito Agro', segment: 'Fiagro', base: 100, estimatedMonthlyDividend: 1.00 },

  // FIIs Base 100 Tradicionais (Tijolo, Papel e Shoppings)
  { ticker: 'XPML11', name: 'XP Malls FII', segment: 'Tijolo - Shopping', base: 100, estimatedMonthlyDividend: 0.92 },
  { ticker: 'VISC11', name: 'Vinci Shopping Centers', segment: 'Tijolo - Shopping', base: 100, estimatedMonthlyDividend: 1.00 },
  { ticker: 'HGLG11', name: 'CSHG Logística', segment: 'Tijolo - Logística', base: 100, estimatedMonthlyDividend: 1.10 },
  { ticker: 'BTLG11', name: 'BTG Pactual Logística', segment: 'Tijolo - Logística', base: 100, estimatedMonthlyDividend: 0.78 },
  { ticker: 'XPLG11', name: 'XP Log FII', segment: 'Tijolo - Logística', base: 100, estimatedMonthlyDividend: 0.78 },
  { ticker: 'KNCR11', name: 'Kinea Rendimentos (CDI)', segment: 'Papel', base: 100, estimatedMonthlyDividend: 1.05 },
  { ticker: 'KNIP11', name: 'Kinea Índice de Preços (IPCA)', segment: 'Papel', base: 100, estimatedMonthlyDividend: 0.80 },
  { ticker: 'KNSC11', name: 'Kinea Securities', segment: 'Papel', base: 100, estimatedMonthlyDividend: 0.90 },
  { ticker: 'RBRR11', name: 'RBR Rendimento High Grade', segment: 'Papel', base: 100, estimatedMonthlyDividend: 0.85 },
  { ticker: 'TRXF11', name: 'TRX Real Estate', segment: 'Tijolo - Renda Urbana', base: 100, estimatedMonthlyDividend: 0.93 },
  { ticker: 'TGAR11', name: 'TG Ativo Real', segment: 'Outros', base: 100, estimatedMonthlyDividend: 1.30 },
  { ticker: 'BTHF11', name: 'BTG Pactual Hedge Fund', segment: 'FOF', base: 10, estimatedMonthlyDividend: 0.10 },
  { ticker: 'HGRE11', name: 'CSHG Real Estate', segment: 'Tijolo - Lajes', base: 100, estimatedMonthlyDividend: 0.78 },
  { ticker: 'PVBI11', name: 'VBI Prime Properties', segment: 'Tijolo - Lajes', base: 100, estimatedMonthlyDividend: 0.65 }
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
    estimatedMonthlyDividend: 0.08
  };
}

