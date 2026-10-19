import { protectedApi, readLimitedJson } from '../../../lib/serverSecurity';
import { NextResponse, connection } from 'next/server';
import { FII_FUNDAMENTALS } from '../../../data/fiiFundamentals';
import { FII_PROPERTIES_CATALOG } from '../../../data/fiiProperties';

export interface PortfolioPositionSummaryInput {
  ticker: string;
  name: string;
  assetClass?: 'FII' | 'ACAO';
  segment: string;
  totalShares: number;
  averagePrice: number;
  currentPrice: number;
  currentTotal: number;
  totalMonthlyDividend: number;
  yieldOnCostPercent: number;
  pvp: number;
  allocationPercent: number;
}

export interface RelevantFactItem {
  ticker: string;
  name: string;
  segment: string;
  headline: string;
  publishedAt: string;
  sourceName: string;
  sentiment: 'POSITIVO' | 'NEUTRO' | 'ATENCAO';
  bullets: [string, string, string];
  officialUrl: string;
}

export interface AiPortfolioInsightsResponse {
  engineSource: 'GEMINI_AI' | 'GROQ_AI' | 'MOTOR_INSTITUCIONAL_B3';
  healthScore: number;
  healthLabel: 'Excelente' | 'Saudável' | 'Moderada' | 'Concentrada';
  executiveSummary: string;
  promptQuestion: string;
  promptAnswer: string[];
  macroCorrelation: {
    papelPercent: number;
    tijoloPercent: number;
    acoesPercent: number;
    rendaFixaPercent: number;
    verdict: string;
  };
  riskAlerts: {
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    detail: string;
  }[];
  relevantFacts: RelevantFactItem[];
  generatedAt: string;
}

interface RequestPayload {
  positions?: PortfolioPositionSummaryInput[];
  fixedIncomeTotal?: number;
  selicAnnual?: number;
  cdiAnnual?: number;
  ipca12m?: number;
  focusProjections?: {
    year: number;
    selicMedian: number;
    ipcaMedian: number;
    realRateAnnual: number;
  }[];
  promptType?: 'GERAL' | 'RISCOS' | 'TIJOLO_VS_PAPEL' | 'DESCONTADOS' | 'CUSTOM';
  customQuestion?: string;
  customApiKey?: string;
}

async function fetchLiveGoogleNewsHeadline(
  ticker: string
): Promise<{ title: string; pubDate: string; link: string; source: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2800);
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${ticker} FII OR B3 OR dividendos`
    )}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FII-Tracker/4.6)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const xml = await res.text();

    const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
    if (!itemMatch) return null;

    const itemXml = itemMatch[1];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/);

    const rawTitle = (titleMatch?.[1] || titleMatch?.[2] || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (!rawTitle) return null;

    let formattedDate = 'Recente';
    if (dateMatch?.[1]) {
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        formattedDate = parsed.toLocaleDateString('pt-BR');
      }
    }

    return {
      title: rawTitle,
      pubDate: formattedDate,
      link: linkMatch?.[1] || `https://statusinvest.com.br/fundos-imobiliarios/${ticker.toLowerCase()}`,
      source: sourceMatch?.[1] || 'B3 / Mídia Financeira',
    };
  } catch {
    return null;
  }
}

function buildDeterministicInsights(
  positions: PortfolioPositionSummaryInput[],
  fixedIncomeTotal: number,
  selicAnnual: number,
  ipca12m: number,
  focusProjections: {
    year: number;
    selicMedian: number;
    ipcaMedian: number;
    realRateAnnual: number;
  }[],
  promptType: string,
  customQuestion: string,
  liveNewsMap: Map<string, { title: string; pubDate: string; link: string; source: string }>
): AiPortfolioInsightsResponse {
  const b3Total = positions.reduce((acc, p) => acc + p.currentTotal, 0);
  const globalTotal = Math.max(1, b3Total + fixedIncomeTotal);

  let papelValue = 0;
  let tijoloValue = 0;
  let acoesValue = 0;

  for (const p of positions) {
    if (p.assetClass === 'ACAO' || p.segment.startsWith('Ações')) {
      acoesValue += p.currentTotal;
    } else if (
      p.segment.includes('Papel') ||
      p.segment.includes('CRI') ||
      p.segment.includes('Fiagro') ||
      p.segment.includes('FOF') ||
      p.segment.includes('Fundo de Fundos')
    ) {
      papelValue += p.currentTotal;
    } else {
      tijoloValue += p.currentTotal;
    }
  }

  const papelPercent = Math.round((papelValue / globalTotal) * 100);
  const tijoloPercent = Math.round((tijoloValue / globalTotal) * 100);
  const acoesPercent = Math.round((acoesValue / globalTotal) * 100);
  const rendaFixaPercent = Math.max(
    0,
    100 - (papelPercent + tijoloPercent + acoesPercent)
  );

  // Cálculo do Score de Saúde da Carteira (0 a 100)
  let score = 72;
  if (positions.length >= 5) score += 10;
  if (positions.length >= 8) score += 6;
  if (papelPercent > 0 && tijoloPercent > 0) score += 6;
  if (fixedIncomeTotal > 0) score += 6;

  const maxPosition = [...positions].sort(
    (a, b) => b.allocationPercent - a.allocationPercent
  )[0];
  if (maxPosition && maxPosition.allocationPercent > 35) {
    score -= 12;
  } else if (maxPosition && maxPosition.allocationPercent > 25) {
    score -= 5;
  }

  const avgPvp =
    positions.length > 0
      ? positions.reduce((acc, p) => acc + (p.pvp || 1), 0) / positions.length
      : 1;
  if (avgPvp <= 0.98) score += 5;

  const healthScore = Math.max(35, Math.min(99, Math.round(score)));
  const healthLabel: AiPortfolioInsightsResponse['healthLabel'] =
    healthScore >= 85
      ? 'Excelente'
      : healthScore >= 72
      ? 'Saudável'
      : healthScore >= 58
      ? 'Moderada'
      : 'Concentrada';

  // Alertas de Risco e Correlação Oculta
  const riskAlerts: AiPortfolioInsightsResponse['riskAlerts'] = [];

  if (maxPosition && maxPosition.allocationPercent > 25) {
    riskAlerts.push({
      level: maxPosition.allocationPercent > 40 ? 'HIGH' : 'MEDIUM',
      title: `Concentração elevada em ${maxPosition.ticker} (${maxPosition.allocationPercent}%)`,
      detail: `Um único ativo representa ${maxPosition.allocationPercent}% da sua carteira B3. O ideal institucional é limitar cada FII/Ação a no máximo 15%–20% para diluir risco de crédito ou vacância.`,
    });
  }

  if (papelPercent > 65) {
    riskAlerts.push({
      level: 'MEDIUM',
      title: `Alta dependência de CRIs / Papel (${papelPercent}% do patrimônio)`,
      detail: `Fundos de papel pagam dividendos altos no curto prazo com Selic em ${selicAnnual}% a.a., mas não reajustam o valor patrimonial dos imóveis como os FIIs de Tijolo.`,
    });
  } else if (tijoloPercent > 70) {
    riskAlerts.push({
      level: 'LOW',
      title: `Forte exposição a Imóveis Físicos (${tijoloPercent}% em Tijolo)`,
      detail: `Excelente proteção patrimonial de longo prazo, porém mais sensível à curva de juros futuros. Adicionar FIIs de Papel High Grade ou Caixinhas equilibra o fluxo de caixa.`,
    });
  }

  if (fixedIncomeTotal <= 0) {
    riskAlerts.push({
      level: 'MEDIUM',
      title: 'Ausência de Reserva de Oportunidade em Caixinha / Selic',
      detail: `Com a Selic em ${selicAnnual}% a.a., manter uma reserva em liquidez diária (100% CDI) garante munição para aproveitar quedas bruscas na B3.`,
    });
  }

  if (riskAlerts.length === 0) {
    riskAlerts.push({
      level: 'LOW',
      title: 'Equilíbrio Setorial e Risco Controlado',
      detail: `Sua carteira combina ${positions.length} ativos na B3 com P/VP médio de ${avgPvp.toFixed(
        2
      )} e distribuição saudável entre indexadores (IPCA ${ipca12m}% a.a. e CDI).`,
    });
  }

  // Veredito Macro com Curva do Boletim Focus (API Olinda BCB)
  const focusSummaryText =
    focusProjections.length > 0
      ? ` O Boletim Focus (API Olinda BCB) projeta Selic de ${focusProjections
          .map((f) => `${f.selicMedian}% em ${f.year}`)
          .join(', ')}.`
      : '';

  const macroVerdict =
    selicAnnual >= 10
      ? `Com Selic em ${selicAnnual}% a.a. e IPCA em ${ipca12m}% a.a., seus ativos de Papel (${papelPercent}%) e Caixinhas (${rendaFixaPercent}%) geram forte caixa imediato, enquanto os FIIs de Tijolo (${tijoloPercent}%) oferecem compra descontada abaixo do custo de reposição.${focusSummaryText}`
      : `Ciclo favorável para valorização de cota nos FIIs de Tijolo (${tijoloPercent}%) e Ações (${acoesPercent}%), mantendo FIIs de Papel (${papelPercent}%) como âncora de dividendos.${focusSummaryText}`;

  // Fatos Relevantes & Resumo Executivo de 3 Bullets por Ativo
  const targetPositions =
    positions.length > 0
      ? positions.slice(0, 8)
      : [
          {
            ticker: 'MXRF11',
            name: 'Maxi Renda FII',
            assetClass: 'FII' as const,
            segment: 'Papel (CRI)',
            totalShares: 10,
            averagePrice: 9.8,
            currentPrice: 9.75,
            currentTotal: 97.5,
            totalMonthlyDividend: 0.9,
            yieldOnCostPercent: 0.92,
            pvp: 1.0,
            allocationPercent: 35,
          },
          {
            ticker: 'HGLG11',
            name: 'Pátria Logística',
            assetClass: 'FII' as const,
            segment: 'Tijolo - Logística',
            totalShares: 2,
            averagePrice: 158,
            currentPrice: 156.5,
            currentTotal: 313,
            totalMonthlyDividend: 2.2,
            yieldOnCostPercent: 0.7,
            pvp: 0.98,
            allocationPercent: 65,
          },
        ];

  const relevantFacts: RelevantFactItem[] = targetPositions.map((pos) => {
    const fundInfo = FII_FUNDAMENTALS.find((f) => f.ticker === pos.ticker);
    const propsCount = FII_PROPERTIES_CATALOG.filter(
      (prop) => prop.ticker === pos.ticker
    ).length;
    const liveNews = liveNewsMap.get(pos.ticker);

    const isDiscounted = pos.pvp > 0 && pos.pvp < 0.99;
    const sentiment: RelevantFactItem['sentiment'] =
      pos.yieldOnCostPercent >= 0.8 || isDiscounted
        ? 'POSITIVO'
        : pos.pvp > 1.08
        ? 'ATENCAO'
        : 'NEUTRO';

    const headline =
      liveNews?.title ||
      (fundInfo
        ? `${pos.ticker}: Relatório Gerencial destaca gestão ${fundInfo.management} e carteira com ${fundInfo.diversification.toLowerCase()}`
        : `${pos.ticker}: Acompanhamento de proventos mensais e comunicado oficial ao mercado B3`);

    const bullet1 = isDiscounted
      ? `Desconto Patrimonial: negocia a P/VP ${pos.pvp.toFixed(2)} (${Math.round(
          (1 - pos.pvp) * 100
        )}% abaixo do valor patrimonial), oferecendo margem de segurança no aporte.`
      : `Valuation Atual: negocia a P/VP ${pos.pvp.toFixed(
          2
        )} com preço atual de R$ ${pos.currentPrice.toFixed(2)} vs seu Preço Médio de R$ ${pos.averagePrice.toFixed(
          2
        )}.`;

    const bullet2 = `Geração de Renda: entrega Yield on Cost de ${pos.yieldOnCostPercent.toFixed(
      2
    )}% a.m. na sua carteira (R$ ${pos.totalMonthlyDividend.toFixed(
      2
    )}/mês isentos ou líquidos).`;

    const bullet3 = fundInfo
      ? `Fundamento & Imóveis: ${fundInfo.thesis}${
          propsCount > 0 ? ` Possui ${propsCount} grandes ativos mapeados no Mapa Imobiliário.` : ''
        }`
      : `Posicionamento: representa ${pos.allocationPercent}% da sua carteira B3 no segmento ${pos.segment}.`;

    return {
      ticker: pos.ticker,
      name: pos.name,
      segment: pos.segment,
      headline,
      publishedAt: liveNews?.pubDate || 'Ciclo Atual B3',
      sourceName: liveNews?.source || 'FNet B3 / Relatório Gerencial',
      sentiment,
      bullets: [bullet1, bullet2, bullet3],
      officialUrl:
        liveNews?.link ||
        (pos.assetClass === 'ACAO'
          ? `https://statusinvest.com.br/acoes/${pos.ticker.toLowerCase()}`
          : `https://statusinvest.com.br/fundos-imobiliarios/${pos.ticker.toLowerCase()}`),
    };
  });

  // Resposta específica ao Prompt Selecionado
  const discountedList = [...positions]
    .filter((p) => p.pvp > 0 && p.pvp < 1.0)
    .sort((a, b) => a.pvp - b.pvp);

  let promptQuestion = 'Diagnóstico Executivo da Carteira & Fatos Relevantes';
  let promptAnswer: string[] = [];

  if (promptType === 'RISCOS') {
    promptQuestion = 'Qual é o maior risco oculto da minha carteira hoje?';
    promptAnswer = [
      maxPosition
        ? `1. Concentração Individual: seu maior ativo é ${maxPosition.ticker} com ${maxPosition.allocationPercent}% da bolsa. Caso esse ativo reduza dividendos em 20%, seu fluxo mensal sentiria impacto direto.`
        : '1. Carteira em fase inicial: adicione pelo menos 5 a 8 ativos de setores diferentes para diluir o risco.',
      `2. Sensibilidade Macroeconômica: você possui ${papelPercent}% em Papel (CRI) e ${tijoloPercent}% em Tijolo. Com Selic em ${selicAnnual}% a.a. e IPCA em ${ipca12m}% a.a., mantenha equilíbrio entre contratos indexados ao IPCA e ao CDI.`,
      `3. Liquidez de Oportunidade: suas Caixinhas / Renda Fixa representam ${rendaFixaPercent}% do patrimônio total, servindo como colchão de segurança.`,
    ];
  } else if (promptType === 'TIJOLO_VS_PAPEL') {
    promptQuestion = 'Devo focar o próximo aporte em Tijolo ou Papel no cenário atual?';
    const focusLine =
      focusProjections.length > 0
        ? `1. Curva Boletim Focus (API Olinda BCB): Selic hoje em ${selicAnnual}% a.a. com projeção de ${focusProjections
            .map((f) => `${f.selicMedian}% (${f.year})`)
            .join(' → ')} e IPCA projetado em ${focusProjections
            .map((f) => `${f.ipcaMedian}% (${f.year})`)
            .join(' → ')}.`
        : `1. Cenário Banco Central Hoje: Selic em ${selicAnnual}% a.a. e IPCA acumulado em ${ipca12m}% a.a. (juro real elevado).`;

    promptAnswer = [
      focusLine,
      tijoloPercent < papelPercent
        ? `2. Sua Alocação (${tijoloPercent}% Tijolo vs ${papelPercent}% Papel): você está sub-alocado em Tijolo. Com o fechamento futuro da Selic projetado pelo Focus, comprar Galpões e Shoppings abaixo de P/VP 1.00 trava ganho de capital e renda crescente.`
        : `2. Sua Alocação (${tijoloPercent}% Tijolo vs ${papelPercent}% Papel): você já tem boa base em imóveis físicos. Reforçar FIIs de Papel High Grade (CDI+ / IPCA+) aproveita o juro real de curto prazo e acelera a bola de neve mensal.`,
      `3. Regra Prática: direcione o aporte do mês para a classe que estiver abaixo de 45% da carteira e negociando abaixo do Preço-Teto.`,
    ];
  } else if (promptType === 'DESCONTADOS') {
    promptQuestion = 'Quais ativos da minha carteira estão mais descontados hoje?';
    if (discountedList.length > 0) {
      promptAnswer = discountedList.slice(0, 3).map(
        (p, i) =>
          `${i + 1}. ${p.ticker} (${p.segment}): negociando a P/VP ${p.pvp.toFixed(
            2
          )} (desconto de ${Math.round(
            (1 - p.pvp) * 100
          )}%) e pagando YoC de ${p.yieldOnCostPercent}% a.m. na sua carteira.`
      );
    } else {
      promptAnswer = [
        '1. Todos os ativos atuais da sua carteira estão negociando próximos ou acima de P/VP 1.00.',
        '2. Nesse cenário, priorize aportes nos ativos onde seu Preço Médio ainda está acima da cotação atual ou utilize o Radar B3 para buscar FIIs High Grade com P/VP entre 0.88 e 0.98.',
      ];
    }
  } else if (promptType === 'CUSTOM' && customQuestion.trim()) {
    promptQuestion = customQuestion.trim();
    promptAnswer = [
      `Análise baseada na sua carteira (${positions.length} ativos na B3, P/VP médio ${avgPvp.toFixed(
        2
      )}, Selic ${selicAnnual}% a.a.):`,
      `• Sua exposição atual é de ${tijoloPercent}% em Tijolo, ${papelPercent}% em Papel, ${acoesPercent}% em Ações e ${rendaFixaPercent}% em Renda Fixa.`,
      discountedList.length > 0
        ? `• Os ativos com maior margem de segurança patrimonial hoje na sua carteira são: ${discountedList
            .slice(0, 3)
            .map((d) => `${d.ticker} (P/VP ${d.pvp})`)
            .join(', ')}.`
        : `• Seus ativos operam com múltiplos sólidos e geração recorrente de caixa.`,
    ];
  } else {
    promptQuestion = 'Resumo Executivo da Carteira & Comunicados do Mês';
    promptAnswer = [
      `1. Saúde Global (${healthScore}/100 — ${healthLabel}): carteira com ${positions.length} ativos na B3 e P/VP médio de ${avgPvp.toFixed(2)}.`,
      `2. Proteção Inflacionária: com IPCA em ${ipca12m}% a.a. e Selic em ${selicAnnual}% a.a., sua combinação de ${tijoloPercent}% Tijolo + ${papelPercent}% Papel + ${rendaFixaPercent}% Caixinhas protege o poder de compra real.`,
      discountedList.length > 0
        ? `3. Destaque de Oportunidade Interna: ${discountedList[0].ticker} negocia com P/VP de ${discountedList[0].pvp.toFixed(
            2
          )} e entrega ${discountedList[0].yieldOnCostPercent}% a.m. sobre seu custo.`
        : `3. Fluxo de Caixa: todos os ativos monitorados seguem com distribuição regular de proventos no ciclo vigente.`,
    ];
  }

  return {
    engineSource: 'MOTOR_INSTITUCIONAL_B3',
    healthScore,
    healthLabel,
    executiveSummary: `Carteira avaliada com nota ${healthScore}/100 (${healthLabel}). Exposição de ${tijoloPercent}% em Tijolo, ${papelPercent}% em Papel, ${acoesPercent}% em Ações e ${rendaFixaPercent}% em Caixinhas/RF.`,
    promptQuestion,
    promptAnswer,
    macroCorrelation: {
      papelPercent,
      tijoloPercent,
      acoesPercent,
      rendaFixaPercent,
      verdict: macroVerdict,
    },
    riskAlerts,
    relevantFacts,
    generatedAt: new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

async function tryGenerateWithGeminiOrGroq(
  apiKey: string,
  baseInsights: AiPortfolioInsightsResponse,
  positions: PortfolioPositionSummaryInput[],
  selicAnnual: number,
  ipca12m: number
): Promise<AiPortfolioInsightsResponse | null> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return null;

  const isGroq = cleanKey.startsWith('gsk_');
  const portfolioText = positions
    .map(
      (p) =>
        `${p.ticker} (${p.segment}): ${p.totalShares} cotas, PM R$${p.averagePrice}, Atual R$${p.currentPrice}, P/VP ${p.pvp}, YoC ${p.yieldOnCostPercent}% a.m., Alocação ${p.allocationPercent}%`
    )
    .join('; ');

  const headlinesText = baseInsights.relevantFacts
    .map((f) => `${f.ticker}: ${f.headline}`)
    .join(' | ');

  const systemPrompt = `Você é um analista institucional sênior de FIIs e Ações da B3 (estilo XP Investimentos Private). Responda de forma direta, técnica e objetiva em português (Brasil), SEM falar sobre imposto de renda. Retorne APENAS um JSON válido com as chaves: "executiveSummary" (string curta de 2 frases) e "promptAnswer" (array de exatamente 3 strings com bullet points numerados respondendo à pergunta do investidor).`;

  const userPrompt = `Carteira do investidor: ${portfolioText || 'Carteira em construção'}. Indicadores BCB: Selic ${selicAnnual}% a.a., IPCA ${ipca12m}% a.a. Manchetes recentes: ${headlinesText}. Pergunta do investidor: "${baseInsights.promptQuestion}"`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    if (isGroq) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.executiveSummary && Array.isArray(parsed.promptAnswer)) {
            return {
              ...baseInsights,
              engineSource: 'GROQ_AI',
              executiveSummary: parsed.executiveSummary,
              promptAnswer: parsed.promptAnswer.slice(0, 4),
            };
          }
        }
      }
    } else {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
          cleanKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (parsed.executiveSummary && Array.isArray(parsed.promptAnswer)) {
            return {
              ...baseInsights,
              engineSource: 'GEMINI_AI',
              executiveSummary: parsed.executiveSummary,
              promptAnswer: parsed.promptAnswer.slice(0, 4),
            };
          }
        }
      }
    }
  } catch {
    // Em caso de erro ou chave inválida, mantém o diagnóstico determinístico institucional
  }

  return null;
}

export async function POST(request: Request) {
  await connection();
  const access = await protectedApi(request, 'ai', 15);
  if (access.response) return access.response;
  try {
    const body = await readLimitedJson(request) as RequestPayload;
    if (!body || !Array.isArray(body.positions) || body.positions.length > 100 ||
      body.positions.some(p => !p || !/^[A-Z]{4}\d{1,2}B?$/.test(p.ticker) ||
        !['name', 'segment'].every(k => typeof p[k as 'name' | 'segment'] === 'string') ||
        ![p.totalShares, p.averagePrice, p.currentPrice, p.currentTotal, p.totalMonthlyDividend, p.yieldOnCostPercent, p.pvp, p.allocationPercent].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)) ||
      (body.customQuestion !== undefined && (typeof body.customQuestion !== 'string' || body.customQuestion.length > 2000)) ||
      (body.customApiKey !== undefined && (typeof body.customApiKey !== 'string' || body.customApiKey.length > 512))) {
      return NextResponse.json({ error: 'Dados de análise inválidos.' }, { status: 400 });
    }
    const positions = Array.isArray(body.positions) ? body.positions : [];
    const fixedIncomeTotal = Number(body.fixedIncomeTotal) || 0;
    const selicAnnual = Number(body.selicAnnual) || 10.75;
    const ipca12m = Number(body.ipca12m) || 4.42;
    const focusProjections = Array.isArray(body.focusProjections)
      ? body.focusProjections
      : [];
    const promptType = body.promptType || 'GERAL';
    const customQuestion = body.customQuestion || '';

    // Busca manchetes/comunicados em paralelo para os principais ativos da carteira (máx 5 para resposta rápida)
    const topTickers =
      positions.length > 0
        ? positions.slice(0, 5).map((p) => p.ticker)
        : ['MXRF11', 'HGLG11'];

    const newsResults = await Promise.allSettled(
      topTickers.map(async (ticker) => ({
        ticker,
        news: await fetchLiveGoogleNewsHeadline(ticker),
      }))
    );

    const liveNewsMap = new Map<
      string,
      { title: string; pubDate: string; link: string; source: string }
    >();
    for (const r of newsResults) {
      if (r.status === 'fulfilled' && r.value.news) {
        liveNewsMap.set(r.value.ticker, r.value.news);
      }
    }

    const baseInsights = buildDeterministicInsights(
      positions,
      fixedIncomeTotal,
      selicAnnual,
      ipca12m,
      focusProjections,
      promptType,
      customQuestion,
      liveNewsMap
    );

    const activeApiKey =
      body.customApiKey?.trim() ||
      process.env.GEMINI_API_KEY ||
      process.env.GROQ_API_KEY ||
      '';

    if (activeApiKey) {
      const llmEnhanced = await tryGenerateWithGeminiOrGroq(
        activeApiKey,
        baseInsights,
        positions,
        selicAnnual,
        ipca12m
      );
      if (llmEnhanced) {
        return NextResponse.json(llmEnhanced);
      }
    }

    return NextResponse.json(baseInsights);
  } catch (err) {
    console.error('Erro em /api/ai-insights:', err);
    return NextResponse.json(
      { error: 'Falha ao processar análise da carteira.' },
      { status: 500 }
    );
  }
}

