export interface FiiFundamentalData {
  ticker: string;
  name: string;
  segment: 'Papel (CRI)' | 'Tijolo (Logística)' | 'Tijolo (Shopping)' | 'Tijolo (Renda Urbana)' | 'Tijolo (Lajes)' | 'FOF' | 'Fiagro';
  base: 10 | 100;
  vp: number; // Valor Patrimonial por cota oficial
  typicalMonthlyDividend: number; // Média recente de proventos por cota
  diversification: string; // Ex: "Mais de 80 CRIs pulverizados"
  vacancyPhysical?: number; // Vacância física (%)
  management: string; // Ex: "XP Asset", "Kinea", "BTG"
  thesis: string; // Tese resumida de investimento
}

export const FII_FUNDAMENTALS: FiiFundamentalData[] = [
  // FIIs Base 10 (Ideais para aportes de R$ 200/mês para diversificação máxima)
  {
    ticker: 'MXRF11',
    name: 'Maxi Renda FII',
    segment: 'Papel (CRI)',
    base: 10,
    vp: 9.72,
    typicalMonthlyDividend: 0.09,
    diversification: 'Mais de 85 CRIs de devedores sólidos',
    management: 'XP Asset Management',
    thesis: 'O FII mais popular do Brasil. Carteira de crédito imobiliário resiliente com dividendos mensais consistentes e alta liquidez na bolsa.'
  },
  {
    ticker: 'VGIR11',
    name: 'Valora RE III',
    segment: 'Papel (CRI)',
    base: 10,
    vp: 9.85,
    typicalMonthlyDividend: 0.10,
    diversification: 'Foco em CRIs atrelados ao CDI',
    management: 'Valora Gestão',
    thesis: 'Excelente para momento de Selic e juros altos, pois sua carteira rende CDI + spread, entregando dividendos gordos acima de 1% ao mês.'
  },
  {
    ticker: 'CPTS11',
    name: 'Capitânia Securities',
    segment: 'Papel (CRI)',
    base: 10,
    vp: 8.92,
    typicalMonthlyDividend: 0.07,
    diversification: 'CRIs High Grade atrelados ao IPCA e MTM',
    management: 'Capitânia Investimentos',
    thesis: 'Gestão muito ativa de crédito imobiliário. Quando negocia com desconto sobre o patrimônio, oferece excelente potencial de valorização futura.'
  },
  {
    ticker: 'KISU11',
    name: 'Kilima FIC de FII',
    segment: 'FOF',
    base: 10,
    vp: 8.78,
    typicalMonthlyDividend: 0.075,
    diversification: 'Carteira investida em mais de 30 outros FIIs',
    management: 'Kilima Gestão',
    thesis: 'Fundo de Fundos acessível. Permite ao pequeno investidor ter uma cesta diversificada de dezenas de FIIs comprando uma única cota de Base 10.'
  },
  {
    ticker: 'GALG11',
    name: 'Guardian Logística',
    segment: 'Tijolo (Logística)',
    base: 10,
    vp: 9.15,
    typicalMonthlyDividend: 0.084,
    diversification: '5 centros logísticos modernos com contratos atípicos',
    vacancyPhysical: 0,
    management: 'Guardian Gestora',
    thesis: 'Um dos raros fundos de tijolo/galpões logísticos em Base 10. Contratos longos atípicos (BRF, BAT) com 100% de ocupação.'
  },
  {
    ticker: 'SNAG11',
    name: 'Suno Agro Fiagro',
    segment: 'Fiagro',
    base: 10,
    vp: 10.08,
    typicalMonthlyDividend: 0.105,
    diversification: 'Crédito do agronegócio com garantias reais de terras',
    management: 'Suno Asset',
    thesis: 'Exposição ao setor mais pujante da economia brasileira (Agronegócio). Carteira sem histórico de inadimplência e excelente retorno mensal.'
  },
  {
    ticker: 'VGIA11',
    name: 'Valora CRA Fiagro',
    segment: 'Fiagro',
    base: 10,
    vp: 9.45,
    typicalMonthlyDividend: 0.11,
    diversification: 'Mais de 30 CRAs do setor agropecuário',
    management: 'Valora Gestão',
    thesis: 'Fiagro de alta rentabilidade com pagamentos constantes, excelente para turbinar a renda passiva inicial de quem começa com R$ 200.'
  },

  // FIIs Base 100 Tradicionais (Tijolo de Primeira Linha)
  {
    ticker: 'XPML11',
    name: 'XP Malls FII',
    segment: 'Tijolo (Shopping)',
    base: 100,
    vp: 112.30,
    typicalMonthlyDividend: 0.92,
    diversification: '17 shopping centers líderes em capitais (Catarina, Cidade Jardim, etc.)',
    vacancyPhysical: 4.2,
    management: 'XP Asset Management',
    thesis: 'Maior fundo de shopping centers da bolsa. Imóveis de altíssimo padrão com fluxo constante de consumidores e vendas crescentes.'
  },
  {
    ticker: 'HGLG11',
    name: 'CSHG Logística',
    segment: 'Tijolo (Logística)',
    base: 100,
    vp: 154.20,
    typicalMonthlyDividend: 1.10,
    diversification: 'Mais de 20 galpões logísticos Triple A no eixo SP-RJ',
    vacancyPhysical: 5.8,
    management: 'Patria / Credit Suisse',
    thesis: 'O fundo de galpões logísticos mais tradicional e seguro do país. Inquilinos do nível de Mercado Livre, Volkswagen e Ambev.'
  },
  {
    ticker: 'BTLG11',
    name: 'BTG Pactual Logística',
    segment: 'Tijolo (Logística)',
    base: 100,
    vp: 102.50,
    typicalMonthlyDividend: 0.78,
    diversification: 'Galpões no raio de 30km da capital de São Paulo',
    vacancyPhysical: 3.5,
    management: 'BTG Pactual',
    thesis: 'Foco em logística de "última milha" (last mile) muito próxima dos grandes centros de consumo, garantindo baixíssima vacância.'
  },
  {
    ticker: 'KNCR11',
    name: 'Kinea Rendimentos',
    segment: 'Papel (CRI)',
    base: 100,
    vp: 101.80,
    typicalMonthlyDividend: 1.05,
    diversification: 'Carteira conservadora 100% CDI High Grade',
    management: 'Kinea / Itaú',
    thesis: 'Considerado um dos fundos de crédito mais seguros do mercado. Risco de calote quase nulo e rendimentos consistentes.'
  },
  {
    ticker: 'TRXF11',
    name: 'TRX Real Estate',
    segment: 'Tijolo (Renda Urbana)',
    base: 100,
    vp: 101.20,
    typicalMonthlyDividend: 0.93,
    diversification: 'Lojas de grandes redes (Assaí, Pão de Açúcar, Leroy Merlin)',
    vacancyPhysical: 0,
    management: 'TRX Gestora',
    thesis: 'Lojas essenciais de supermercado e atacarejo com contratos atípicos de 15 a 20 anos. Receita altamente previsível e segura.'
  }
];

