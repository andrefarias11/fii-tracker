import { FiiCatalogItem } from '../types/portfolio';

/**
 * Catálogo expandido de FIIs e Fiagros da B3 (Principais ativos do IFIX — Base 10 e Base 100)
 */
export const FII_DATABASE: FiiCatalogItem[] = [
  // ======================== PAPEL (CRI) — BASE 10 ========================
  { ticker: 'MXRF11', name: 'Maxi Renda FII', segment: 'Papel', base: 10, vp: 9.72, estimatedMonthlyDividend: 0.09, announcementDay: 1, paymentDay: 15 },
  { ticker: 'VGIR11', name: 'Valora RE III', segment: 'Papel', base: 10, vp: 9.85, estimatedMonthlyDividend: 0.10, announcementDay: 7, paymentDay: 14 },
  { ticker: 'CPTS11', name: 'Capitânia Securities II', segment: 'Papel', base: 10, vp: 8.92, estimatedMonthlyDividend: 0.075, announcementDay: 5, paymentDay: 15 },
  { ticker: 'KNSC11', name: 'Kinea Securities', segment: 'Papel', base: 10, vp: 8.95, estimatedMonthlyDividend: 0.09, announcementDay: 1, paymentDay: 14 },
  { ticker: 'BTCI11', name: 'BTG Pactual Crédito Imobiliário', segment: 'Papel', base: 10, vp: 10.12, estimatedMonthlyDividend: 0.095, announcementDay: 7, paymentDay: 14 },
  { ticker: 'VGHF11', name: 'Valora Hedge Fund', segment: 'Papel', base: 10, vp: 8.85, estimatedMonthlyDividend: 0.085, announcementDay: 1, paymentDay: 7 },
  { ticker: 'APTO11', name: 'Navi Residencial e Crédito', segment: 'Papel', base: 10, vp: 9.95, estimatedMonthlyDividend: 0.10, announcementDay: 1, paymentDay: 14 },
  { ticker: 'GAME11', name: 'Guardian Multiestratégia', segment: 'Papel', base: 10, vp: 9.65, estimatedMonthlyDividend: 0.095, announcementDay: 7, paymentDay: 16 },
  { ticker: 'MANA11', name: 'Manatí Capital Hedge Fund', segment: 'Papel', base: 10, vp: 9.48, estimatedMonthlyDividend: 0.10, announcementDay: 5, paymentDay: 15 },
  { ticker: 'SNCI11', name: 'Suno Recebíveis Imobiliários', segment: 'Papel', base: 10, vp: 9.65, estimatedMonthlyDividend: 0.10, announcementDay: 15, paymentDay: 25 },
  { ticker: 'RBHY11', name: 'Rio Bravo Crédito High Yield', segment: 'Papel', base: 10, vp: 9.75, estimatedMonthlyDividend: 0.10, announcementDay: 1, paymentDay: 15 },
  { ticker: 'GEXP11', name: 'Galapagos FII', segment: 'Papel', base: 10, vp: 9.60, estimatedMonthlyDividend: 0.08, announcementDay: 1, paymentDay: 15 },

  // ======================== PAPEL (CRI) — BASE 100 ========================
  { ticker: 'KNCR11', name: 'Kinea Rendimentos Imobiliários (CDI)', segment: 'Papel', base: 100, vp: 101.80, estimatedMonthlyDividend: 1.05, announcementDay: 1, paymentDay: 14 },
  { ticker: 'KNIP11', name: 'Kinea Índices de Preços (IPCA)', segment: 'Papel', base: 100, vp: 93.40, estimatedMonthlyDividend: 0.80, announcementDay: 1, paymentDay: 14 },
  { ticker: 'KNUQ11', name: 'Kinea Unique HY CDI', segment: 'Papel', base: 100, vp: 101.20, estimatedMonthlyDividend: 1.15, announcementDay: 1, paymentDay: 14 },
  { ticker: 'HGCR11', name: 'CSHG Recebíveis Imobiliários', segment: 'Papel', base: 100, vp: 101.10, estimatedMonthlyDividend: 0.95, announcementDay: 1, paymentDay: 15 },
  { ticker: 'RBRR11', name: 'RBR Rendimento High Grade', segment: 'Papel', base: 100, vp: 92.80, estimatedMonthlyDividend: 0.85, announcementDay: 7, paymentDay: 15 },
  { ticker: 'RBRY11', name: 'RBR Crédito Imobiliário Estruturado', segment: 'Papel', base: 100, vp: 98.40, estimatedMonthlyDividend: 1.05, announcementDay: 7, paymentDay: 15 },
  { ticker: 'MCCI11', name: 'Mauá Capital Recebíveis', segment: 'Papel', base: 100, vp: 94.50, estimatedMonthlyDividend: 0.85, announcementDay: 7, paymentDay: 15 },
  { ticker: 'IRDM11', name: 'Iridium Recebíveis Imobiliários', segment: 'Papel', base: 100, vp: 81.90, estimatedMonthlyDividend: 0.76, announcementDay: 9, paymentDay: 16 },
  { ticker: 'RECR11', name: 'REC Recebíveis Imobiliários', segment: 'Papel', base: 100, vp: 88.70, estimatedMonthlyDividend: 0.88, announcementDay: 7, paymentDay: 14 },
  { ticker: 'VRTA11', name: 'Fator Verità Recebíveis', segment: 'Papel', base: 100, vp: 89.20, estimatedMonthlyDividend: 0.85, announcementDay: 1, paymentDay: 15 },
  { ticker: 'CVBI11', name: 'VBI CRI', segment: 'Papel', base: 100, vp: 91.50, estimatedMonthlyDividend: 0.92, announcementDay: 7, paymentDay: 15 },
  { ticker: 'AFHI11', name: 'AF Invest CRI High Grade', segment: 'Papel', base: 100, vp: 95.80, estimatedMonthlyDividend: 0.95, announcementDay: 5, paymentDay: 14 },
  { ticker: 'BCRI11', name: 'Banestes Recebíveis Imobiliários', segment: 'Papel', base: 100, vp: 86.40, estimatedMonthlyDividend: 0.78, announcementDay: 1, paymentDay: 15 },
  { ticker: 'VGIP11', name: 'Valora CRI Índice de Preço', segment: 'Papel', base: 100, vp: 89.10, estimatedMonthlyDividend: 0.86, announcementDay: 7, paymentDay: 14 },
  { ticker: 'HABT11', name: 'Habitat II Recebíveis', segment: 'Papel', base: 100, vp: 94.20, estimatedMonthlyDividend: 0.98, announcementDay: 5, paymentDay: 14 },
  { ticker: 'URPR11', name: 'Urca Prime Renda', segment: 'Papel', base: 100, vp: 96.30, estimatedMonthlyDividend: 1.02, announcementDay: 5, paymentDay: 15 },
  { ticker: 'CACR11', name: 'Cartesia Recebíveis Imobiliários', segment: 'Papel', base: 100, vp: 98.10, estimatedMonthlyDividend: 1.15, announcementDay: 1, paymentDay: 10 },
  { ticker: 'DEVA11', name: 'Devant Recebíveis Imobiliários', segment: 'Papel', base: 100, vp: 84.50, estimatedMonthlyDividend: 0.55, announcementDay: 5, paymentDay: 14 },
  { ticker: 'HCTR11', name: 'Hectare CE', segment: 'Papel', base: 100, vp: 82.00, estimatedMonthlyDividend: 0.50, announcementDay: 5, paymentDay: 14 },

  // ======================== TIJOLO — LOGÍSTICA (BASE 10 & BASE 100) ========================
  { ticker: 'GALG11', name: 'Guardian Logística', segment: 'Tijolo - Logística', base: 10, vp: 9.15, estimatedMonthlyDividend: 0.084, announcementDay: 7, paymentDay: 14 },
  { ticker: 'GGRC11', name: 'GGR Covepi Renda Logística', segment: 'Tijolo - Logística', base: 10, vp: 11.25, estimatedMonthlyDividend: 0.095, announcementDay: 1, paymentDay: 9 },
  { ticker: 'BLMG11', name: 'BlueMacaw Logística', segment: 'Tijolo - Logística', base: 10, vp: 8.90, estimatedMonthlyDividend: 0.075, announcementDay: 5, paymentDay: 14 },
  { ticker: 'HGLG11', name: 'CSHG Logística', segment: 'Tijolo - Logística', base: 100, vp: 154.20, estimatedMonthlyDividend: 1.10, announcementDay: 1, paymentDay: 15 },
  { ticker: 'BTLG11', name: 'BTG Pactual Logística', segment: 'Tijolo - Logística', base: 100, vp: 102.50, estimatedMonthlyDividend: 0.78, announcementDay: 15, paymentDay: 25 },
  { ticker: 'XPLG11', name: 'XP Log FII', segment: 'Tijolo - Logística', base: 100, vp: 109.80, estimatedMonthlyDividend: 0.78, announcementDay: 1, paymentDay: 15 },
  { ticker: 'VILG11', name: 'Vinci Logística', segment: 'Tijolo - Logística', base: 100, vp: 111.40, estimatedMonthlyDividend: 0.68, announcementDay: 1, paymentDay: 14 },
  { ticker: 'BRCO11', name: 'Bresco Logística', segment: 'Tijolo - Logística', base: 100, vp: 119.50, estimatedMonthlyDividend: 0.87, announcementDay: 1, paymentDay: 15 },
  { ticker: 'LVBI11', name: 'VBI Logístico', segment: 'Tijolo - Logística', base: 100, vp: 116.80, estimatedMonthlyDividend: 0.83, announcementDay: 1, paymentDay: 15 },
  { ticker: 'RBRL11', name: 'RBR Logística', segment: 'Tijolo - Logística', base: 100, vp: 105.60, estimatedMonthlyDividend: 0.72, announcementDay: 7, paymentDay: 15 },
  { ticker: 'PATL11', name: 'Pátria Logística', segment: 'Tijolo - Logística', base: 100, vp: 97.40, estimatedMonthlyDividend: 0.65, announcementDay: 1, paymentDay: 10 },
  { ticker: 'SDIL11', name: 'SDI Rio Bravo Logística', segment: 'Tijolo - Logística', base: 100, vp: 99.80, estimatedMonthlyDividend: 0.76, announcementDay: 5, paymentDay: 15 },

  // ======================== TIJOLO — SHOPPINGS (BASE 10 & BASE 100) ========================
  { ticker: 'HGBS11', name: 'Hedge Brasil Shopping', segment: 'Tijolo - Shopping', base: 10, vp: 22.80, estimatedMonthlyDividend: 0.16, announcementDay: 1, paymentDay: 15 },
  { ticker: 'AJFI11', name: 'Almeida Junior Shopping', segment: 'Tijolo - Shopping', base: 10, vp: 12.10, estimatedMonthlyDividend: 0.08, announcementDay: 5, paymentDay: 15 },
  { ticker: 'XPML11', name: 'XP Malls FII', segment: 'Tijolo - Shopping', base: 100, vp: 112.30, estimatedMonthlyDividend: 0.92, announcementDay: 15, paymentDay: 25 },
  { ticker: 'VISC11', name: 'Vinci Shopping Centers', segment: 'Tijolo - Shopping', base: 100, vp: 125.10, estimatedMonthlyDividend: 1.00, announcementDay: 1, paymentDay: 14 },
  { ticker: 'HSML11', name: 'HSI Malls', segment: 'Tijolo - Shopping', base: 100, vp: 107.80, estimatedMonthlyDividend: 0.76, announcementDay: 1, paymentDay: 8 },
  { ticker: 'MALL11', name: 'Genial Malls', segment: 'Tijolo - Shopping', base: 100, vp: 118.40, estimatedMonthlyDividend: 0.82, announcementDay: 1, paymentDay: 15 },
  { ticker: 'BPML11', name: 'BTG Pactual Shoppings', segment: 'Tijolo - Shopping', base: 100, vp: 132.00, estimatedMonthlyDividend: 0.90, announcementDay: 10, paymentDay: 20 },
  { ticker: 'CPSH11', name: 'Capitânia Shoppings', segment: 'Tijolo - Shopping', base: 10, vp: 11.40, estimatedMonthlyDividend: 0.095, announcementDay: 5, paymentDay: 15 },

  // ======================== TIJOLO — RENDA URBANA & HÍBRIDOS ========================
  { ticker: 'GARE11', name: 'Guardian Real Estate', segment: 'Tijolo - Renda Urbana', base: 10, vp: 9.25, estimatedMonthlyDividend: 0.088, announcementDay: 7, paymentDay: 14 },
  { ticker: 'VIUR11', name: 'Vinci Imóveis Urbanos', segment: 'Tijolo - Renda Urbana', base: 10, vp: 8.65, estimatedMonthlyDividend: 0.072, announcementDay: 1, paymentDay: 14 },
  { ticker: 'TRXF11', name: 'TRX Real Estate', segment: 'Tijolo - Renda Urbana', base: 100, vp: 101.20, estimatedMonthlyDividend: 0.93, announcementDay: 1, paymentDay: 15 },
  { ticker: 'HGRU11', name: 'CSHG Renda Urbana', segment: 'Tijolo - Renda Urbana', base: 100, vp: 126.90, estimatedMonthlyDividend: 0.85, announcementDay: 1, paymentDay: 15 },
  { ticker: 'KNRI11', name: 'Kinea Renda Imobiliária', segment: 'Tijolo - Renda Urbana', base: 100, vp: 161.40, estimatedMonthlyDividend: 1.00, announcementDay: 1, paymentDay: 14 },
  { ticker: 'ALZR11', name: 'Alianza Trust Renda Imobiliária', segment: 'Tijolo - Renda Urbana', base: 10, vp: 10.65, estimatedMonthlyDividend: 0.08, announcementDay: 15, paymentDay: 25 },
  { ticker: 'RBVA11', name: 'Rio Bravo Renda Varejo', segment: 'Tijolo - Renda Urbana', base: 10, vp: 10.95, estimatedMonthlyDividend: 0.09, announcementDay: 1, paymentDay: 15 },
  { ticker: 'RZTR11', name: 'Riza Terrax (Terras Agrícolas)', segment: 'Tijolo - Renda Urbana', base: 100, vp: 98.70, estimatedMonthlyDividend: 1.00, announcementDay: 1, paymentDay: 8 },
  { ticker: 'TGAR11', name: 'TG Ativo Real (Desenvolvimento)', segment: 'Outros', base: 100, vp: 115.60, estimatedMonthlyDividend: 1.25, announcementDay: 1, paymentDay: 14 },
  { ticker: 'RSPD11', name: 'RBR Desenvolvimento', segment: 'Outros', base: 10, vp: 9.80, estimatedMonthlyDividend: 0.09, announcementDay: 1, paymentDay: 15 },

  // ======================== TIJOLO — LAJES CORPORATIVAS ========================
  { ticker: 'VINO11', name: 'Vinci Offices', segment: 'Tijolo - Lajes', base: 10, vp: 10.45, estimatedMonthlyDividend: 0.055, announcementDay: 1, paymentDay: 14 },
  { ticker: 'PVBI11', name: 'VBI Prime Properties', segment: 'Tijolo - Lajes', base: 100, vp: 106.40, estimatedMonthlyDividend: 0.65, announcementDay: 1, paymentDay: 15 },
  { ticker: 'HGRE11', name: 'CSHG Real Estate', segment: 'Tijolo - Lajes', base: 100, vp: 152.00, estimatedMonthlyDividend: 0.78, announcementDay: 1, paymentDay: 15 },
  { ticker: 'JSRE11', name: 'JS Real Estate Multigestão', segment: 'Tijolo - Lajes', base: 100, vp: 108.90, estimatedMonthlyDividend: 0.48, announcementDay: 1, paymentDay: 15 },
  { ticker: 'BRCR11', name: 'BTG Pactual Corporate Office', segment: 'Tijolo - Lajes', base: 100, vp: 92.10, estimatedMonthlyDividend: 0.45, announcementDay: 7, paymentDay: 14 },
  { ticker: 'TEPP11', name: 'Tellus Properties', segment: 'Tijolo - Lajes', base: 100, vp: 96.50, estimatedMonthlyDividend: 0.72, announcementDay: 1, paymentDay: 15 },
  { ticker: 'RECT11', name: 'REC Renda Imobiliária', segment: 'Tijolo - Lajes', base: 100, vp: 89.20, estimatedMonthlyDividend: 0.40, announcementDay: 7, paymentDay: 15 },

  // ======================== FUNDO DE FUNDOS (FOF) ========================
  { ticker: 'KISU11', name: 'Kilima FIC de FII', segment: 'FOF', base: 10, vp: 8.78, estimatedMonthlyDividend: 0.075, announcementDay: 1, paymentDay: 14 },
  { ticker: 'BCFF11', name: 'BTG Pactual Fundo de Fundos', segment: 'FOF', base: 10, vp: 9.25, estimatedMonthlyDividend: 0.072, announcementDay: 7, paymentDay: 14 },
  { ticker: 'BTHF11', name: 'BTG Pactual Hedge Fund', segment: 'FOF', base: 10, vp: 9.85, estimatedMonthlyDividend: 0.095, announcementDay: 7, paymentDay: 15 },
  { ticker: 'RBRF11', name: 'RBR Alpha Multiestratégia', segment: 'FOF', base: 10, vp: 9.10, estimatedMonthlyDividend: 0.068, announcementDay: 7, paymentDay: 15 },
  { ticker: 'XPSF11', name: 'XP Selection FoF', segment: 'FOF', base: 10, vp: 8.35, estimatedMonthlyDividend: 0.075, announcementDay: 7, paymentDay: 15 },
  { ticker: 'JSAF11', name: 'JS Ativos Financeiros', segment: 'FOF', base: 10, vp: 9.60, estimatedMonthlyDividend: 0.095, announcementDay: 1, paymentDay: 15 },
  { ticker: 'HFOF11', name: 'Hedge Top FOFII 3', segment: 'FOF', base: 100, vp: 79.80, estimatedMonthlyDividend: 0.62, announcementDay: 1, paymentDay: 15 },
  { ticker: 'KFOF11', name: 'Kinea Fundo de Fundos', segment: 'FOF', base: 100, vp: 98.50, estimatedMonthlyDividend: 0.82, announcementDay: 1, paymentDay: 14 },
  { ticker: 'RVBI11', name: 'VBI Reits Multiestratégia', segment: 'FOF', base: 100, vp: 85.20, estimatedMonthlyDividend: 0.75, announcementDay: 7, paymentDay: 16 },

  // ======================== FIAGROS (AGRONEGÓCIO) ========================
  { ticker: 'SNAG11', name: 'Suno Agro Fiagro', segment: 'Fiagro', base: 10, vp: 10.08, estimatedMonthlyDividend: 0.105, announcementDay: 7, paymentDay: 25 },
  { ticker: 'VGIA11', name: 'Valora CRA Fiagro', segment: 'Fiagro', base: 10, vp: 9.45, estimatedMonthlyDividend: 0.11, announcementDay: 7, paymentDay: 19 },
  { ticker: 'FGAA11', name: 'FG/Agro Fiagro', segment: 'Fiagro', base: 10, vp: 9.62, estimatedMonthlyDividend: 0.105, announcementDay: 1, paymentDay: 15 },
  { ticker: 'RZAG11', name: 'Riza Agro Fiagro', segment: 'Fiagro', base: 10, vp: 9.48, estimatedMonthlyDividend: 0.10, announcementDay: 5, paymentDay: 18 },
  { ticker: 'XPCA11', name: 'XP Crédito Agrícola Fiagro', segment: 'Fiagro', base: 10, vp: 9.35, estimatedMonthlyDividend: 0.10, announcementDay: 7, paymentDay: 15 },
  { ticker: 'RURA11', name: 'Itaú Asset Rural Fiagro', segment: 'Fiagro', base: 10, vp: 10.12, estimatedMonthlyDividend: 0.10, announcementDay: 1, paymentDay: 7 },
  { ticker: 'AAZQ11', name: 'AZ Quest Sole Fiagro', segment: 'Fiagro', base: 10, vp: 8.85, estimatedMonthlyDividend: 0.095, announcementDay: 1, paymentDay: 15 },
  { ticker: 'OIAG11', name: 'Ourinvest Innovation Fiagro', segment: 'Fiagro', base: 10, vp: 9.80, estimatedMonthlyDividend: 0.10, announcementDay: 5, paymentDay: 14 },
  { ticker: 'KNCA11', name: 'Kinea Crédito Agro Fiagro', segment: 'Fiagro', base: 100, vp: 102.50, estimatedMonthlyDividend: 1.05, announcementDay: 1, paymentDay: 14 },
  { ticker: 'BBGO11', name: 'BB Crédito Fiagro', segment: 'Fiagro', base: 100, vp: 96.40, estimatedMonthlyDividend: 0.92, announcementDay: 5, paymentDay: 15 },

  // ======================== AÇÕES DE DIVIDENDOS (MÉTODO BESST + BLUE CHIPS B3) ========================
  // Bancos
  { ticker: 'BBAS3', name: 'Banco do Brasil ON', assetClass: 'ACAO', segment: 'Ações - Bancos', base: 10, vp: 31.40, estimatedMonthlyDividend: 0.22, announcementDay: 10, paymentDay: 28 },
  { ticker: 'ITSA4', name: 'Itaúsa PN', assetClass: 'ACAO', segment: 'Ações - Bancos', base: 10, vp: 8.65, estimatedMonthlyDividend: 0.065, announcementDay: 1, paymentDay: 15 },
  { ticker: 'ITUB4', name: 'Itaú Unibanco PN', assetClass: 'ACAO', segment: 'Ações - Bancos', base: 10, vp: 20.80, estimatedMonthlyDividend: 0.21, announcementDay: 1, paymentDay: 1 },
  { ticker: 'BBDC4', name: 'Bradesco PN', assetClass: 'ACAO', segment: 'Ações - Bancos', base: 10, vp: 15.20, estimatedMonthlyDividend: 0.09, announcementDay: 1, paymentDay: 2 },
  { ticker: 'SANB11', name: 'Santander Brasil Unit', assetClass: 'ACAO', segment: 'Ações - Bancos', base: 10, vp: 24.50, estimatedMonthlyDividend: 0.18, announcementDay: 10, paymentDay: 25 },
  { ticker: 'ABCB4', name: 'Banco ABC Brasil PN', assetClass: 'ACAO', segment: 'Ações - Bancos', base: 10, vp: 26.90, estimatedMonthlyDividend: 0.16, announcementDay: 15, paymentDay: 28 },
  { ticker: 'BRSR6', name: 'Banrisul PNB', assetClass: 'ACAO', segment: 'Ações - Bancos', base: 10, vp: 24.80, estimatedMonthlyDividend: 0.095, announcementDay: 10, paymentDay: 25 },
  { ticker: 'BPAC11', name: 'BTG Pactual Unit', assetClass: 'ACAO', segment: 'Ações - Bancos', base: 10, vp: 14.50, estimatedMonthlyDividend: 0.11, announcementDay: 5, paymentDay: 15 },

  // Energia Elétrica (Transmissão & Geração)
  { ticker: 'TAEE11', name: 'Taesa Unit', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 19.80, estimatedMonthlyDividend: 0.26, announcementDay: 10, paymentDay: 25 },
  { ticker: 'ISAE4', name: 'ISA Energia Brasil PN (ex-TRPL4)', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 28.40, estimatedMonthlyDividend: 0.19, announcementDay: 15, paymentDay: 28 },
  { ticker: 'TRPL4', name: 'ISA CTEEP Transmissão Paulista PN', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 28.40, estimatedMonthlyDividend: 0.19, announcementDay: 15, paymentDay: 28 },
  { ticker: 'EGIE3', name: 'Engie Brasil Energia ON', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 14.20, estimatedMonthlyDividend: 0.28, announcementDay: 10, paymentDay: 25 },
  { ticker: 'CPFE3', name: 'CPFL Energia ON', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 16.90, estimatedMonthlyDividend: 0.25, announcementDay: 15, paymentDay: 28 },
  { ticker: 'CMIG4', name: 'Cemig PN', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 9.20, estimatedMonthlyDividend: 0.095, announcementDay: 15, paymentDay: 30 },
  { ticker: 'CPLE6', name: 'Copel PNB', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 8.40, estimatedMonthlyDividend: 0.055, announcementDay: 15, paymentDay: 28 },
  { ticker: 'ALUP11', name: 'Alupar Investimento Unit', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 26.50, estimatedMonthlyDividend: 0.16, announcementDay: 10, paymentDay: 25 },
  { ticker: 'ENGI11', name: 'Energisa Unit', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 34.20, estimatedMonthlyDividend: 0.20, announcementDay: 15, paymentDay: 28 },
  { ticker: 'AURE3', name: 'Auren Energia ON', assetClass: 'ACAO', segment: 'Ações - Energia', base: 10, vp: 12.80, estimatedMonthlyDividend: 0.08, announcementDay: 10, paymentDay: 25 },

  // Seguros & Bolsa
  { ticker: 'BBSE3', name: 'BB Seguridade ON', assetClass: 'ACAO', segment: 'Ações - Seguros', base: 10, vp: 5.60, estimatedMonthlyDividend: 0.29, announcementDay: 10, paymentDay: 25 },
  { ticker: 'CXSE3', name: 'Caixa Seguridade ON', assetClass: 'ACAO', segment: 'Ações - Seguros', base: 10, vp: 4.30, estimatedMonthlyDividend: 0.10, announcementDay: 10, paymentDay: 20 },
  { ticker: 'PSSA3', name: 'Porto Seguro ON', assetClass: 'ACAO', segment: 'Ações - Seguros', base: 10, vp: 20.50, estimatedMonthlyDividend: 0.17, announcementDay: 10, paymentDay: 25 },
  { ticker: 'B3SA3', name: 'B3 Brasil Bolsa Balcão ON', assetClass: 'ACAO', segment: 'Ações - Seguros', base: 10, vp: 3.90, estimatedMonthlyDividend: 0.05, announcementDay: 10, paymentDay: 25 },

  // Saneamento
  { ticker: 'SAPR11', name: 'Sanepar Unit', assetClass: 'ACAO', segment: 'Ações - Saneamento', base: 10, vp: 33.80, estimatedMonthlyDividend: 0.19, announcementDay: 15, paymentDay: 28 },
  { ticker: 'SAPR4', name: 'Sanepar PN', assetClass: 'ACAO', segment: 'Ações - Saneamento', base: 10, vp: 6.76, estimatedMonthlyDividend: 0.04, announcementDay: 15, paymentDay: 28 },
  { ticker: 'CSMG3', name: 'Copasa ON', assetClass: 'ACAO', segment: 'Ações - Saneamento', base: 10, vp: 20.90, estimatedMonthlyDividend: 0.16, announcementDay: 15, paymentDay: 28 },
  { ticker: 'SBSP3', name: 'Sabesp ON', assetClass: 'ACAO', segment: 'Ações - Saneamento', base: 10, vp: 48.50, estimatedMonthlyDividend: 0.22, announcementDay: 15, paymentDay: 28 },

  // Telecom, Indústria & Commodities
  { ticker: 'VIVT3', name: 'Telefônica Brasil (Vivo) ON', assetClass: 'ACAO', segment: 'Ações - Telecom & Indústria', base: 10, vp: 42.10, estimatedMonthlyDividend: 0.28, announcementDay: 15, paymentDay: 28 },
  { ticker: 'KLBN11', name: 'Klabin Unit', assetClass: 'ACAO', segment: 'Ações - Telecom & Indústria', base: 10, vp: 10.40, estimatedMonthlyDividend: 0.11, announcementDay: 10, paymentDay: 25 },
  { ticker: 'WEGE3', name: 'WEG S.A. ON', assetClass: 'ACAO', segment: 'Ações - Telecom & Indústria', base: 10, vp: 4.80, estimatedMonthlyDividend: 0.06, announcementDay: 15, paymentDay: 28 },
  { ticker: 'PETR4', name: 'Petrobras PN', assetClass: 'ACAO', segment: 'Ações - Commodities', base: 10, vp: 31.20, estimatedMonthlyDividend: 0.38, announcementDay: 15, paymentDay: 20 },
  { ticker: 'VALE3', name: 'Vale S.A. ON', assetClass: 'ACAO', segment: 'Ações - Commodities', base: 10, vp: 45.80, estimatedMonthlyDividend: 0.42, announcementDay: 10, paymentDay: 25 },
  { ticker: 'GOAU4', name: 'Metalúrgica Gerdau PN', assetClass: 'ACAO', segment: 'Ações - Commodities', base: 10, vp: 18.20, estimatedMonthlyDividend: 0.08, announcementDay: 10, paymentDay: 25 },
];

const CATALOG_MAP = new Map<string, FiiCatalogItem>(
  FII_DATABASE.map((item) => [item.ticker, item])
);

export function findFiiInfo(ticker: string): FiiCatalogItem {
  const cleanTicker = ticker.toUpperCase().trim();
  const found = CATALOG_MAP.get(cleanTicker);
  if (found) {
    return {
      ...found,
      assetClass: found.assetClass || 'FII',
    };
  }

  // Verifica se é uma Ação da B3 (termina em 3, 4, 5, 6 ou Unit conhecida)
  const isStock = /^[A-Z]{4}[3456]$/.test(cleanTicker);
  if (isStock) {
    return {
      ticker: cleanTicker,
      name: `${cleanTicker} Ação B3`,
      assetClass: 'ACAO',
      segment: 'Ações - Outros',
      base: 10,
      vp: 15.0,
      estimatedMonthlyDividend: 0.09,
      announcementDay: 10,
      paymentDay: 25,
    };
  }

  // Inferência padrão caso um FII novo seja importado da B3
  return {
    ticker: cleanTicker,
    name: `${cleanTicker} Fundo Imobiliário B3`,
    assetClass: 'FII',
    segment: 'Outros',
    base: 10,
    vp: 10.0,
    estimatedMonthlyDividend: 0.085,
    announcementDay: 1,
    paymentDay: 15,
  };
}
