import { NextResponse } from 'next/server';
import { findFiiInfo } from '../../../data/fiiDatabase';

interface YahooDividendEvent {
  amount: number;
  date: number;
}

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketPreviousClose?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        symbol?: string;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
      events?: {
        dividends?: Record<string, YahooDividendEvent>;
      };
    }>;
    error?: unknown;
  };
}

interface StatusInvestEarningItem {
  v?: number; // Valor por cota
  ed?: string; // Data-Com (DD/MM/YYYY)
  pd?: string; // Data de Pagamento (DD/MM/YYYY)
  et?: string; // Tipo ("Rendimento")
}

interface StatusInvestProventsResponse {
  assetEarningsModels?: StatusInvestEarningItem[];
}

interface OfficialDividendData {
  lastDividend: number;
  dividendExDate?: string;
  dividendPaymentDate?: string;
  dividendPaymentDay?: number;
  isCurrentMonthAnnounced: boolean;
  dividendSource: 'B3_OFICIAL' | 'MERCADO';
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

function isDateInCurrentCycle(dateBr?: string): boolean {
  if (!dateBr || !dateBr.includes('/')) return false;
  const parts = dateBr.split('/');
  if (parts.length !== 3) return false;
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  if (year === curYear && month === curMonth) return true;

  // Anúncio no final do mês anterior (ex: dia 28-31) que paga no mês atual
  const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
  const prevYear = curMonth === 1 ? curYear - 1 : curYear;
  const day = parseInt(parts[0], 10);
  if (year === prevYear && month === prevMonth && day >= 25) return true;

  return false;
}

async function fetchStatusInvestDividend(ticker: string, isFiagro: boolean): Promise<OfficialDividendData | null> {
  const endpoints = isFiagro
    ? [
        `https://statusinvest.com.br/fiagro/companytickerprovents?ticker=${encodeURIComponent(ticker)}&chartProventsType=1`,
        `https://statusinvest.com.br/fii/companytickerprovents?ticker=${encodeURIComponent(ticker)}&chartProventsType=1`,
      ]
    : [
        `https://statusinvest.com.br/fii/companytickerprovents?ticker=${encodeURIComponent(ticker)}&chartProventsType=1`,
      ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3200);

      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: controller.signal,
        next: { revalidate: 300 }, // Cache de 5 minutos para comunicados de proventos
      });

      clearTimeout(timeoutId);
      if (!res.ok) continue;

      const data: StatusInvestProventsResponse = await res.json();
      const list = data?.assetEarningsModels;
      if (!Array.isArray(list) || list.length === 0) continue;

      // Ordenar para pegar o comunicado mais recente com valor válido
      const valid = list.filter((item) => typeof item.v === 'number' && item.v > 0);
      if (valid.length === 0) continue;

      const latest = valid[0];
      const amount = Number((latest.v || 0).toFixed(4));
      const exDate = latest.ed && latest.ed !== '-' ? latest.ed : undefined;
      const payDate = latest.pd && latest.pd !== '-' ? latest.pd : undefined;

      let paymentDay: number | undefined = undefined;
      if (payDate && payDate.includes('/')) {
        const dayNum = parseInt(payDate.split('/')[0], 10);
        if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
          paymentDay = dayNum;
        }
      }

      const isCurrentMonthAnnounced =
        isDateInCurrentCycle(payDate) || isDateInCurrentCycle(exDate);

      return {
        lastDividend: amount,
        dividendExDate: exDate,
        dividendPaymentDate: payDate,
        dividendPaymentDay: paymentDay,
        isCurrentMonthAnnounced,
        dividendSource: 'B3_OFICIAL',
      };
    } catch {
      // Silencioso: faz fallback para o Yahoo Finance se houver timeout/bloqueio
    }
  }

  return null;
}

async function fetchTickerQuote(ticker: string) {
  const clean = ticker.trim().toUpperCase();
  const yahooSymbol = clean.endsWith('.SA') ? clean : `${clean}.SA`;
  const catalogInfo = findFiiInfo(clean);
  const isFiagro = catalogInfo.segment === 'Fiagro';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    // Busca em paralelo: Cotação em tempo real (Yahoo) + Comunicados oficiais de dividendos (StatusInvest/B3)
    const [yahooRes, officialDiv] = await Promise.all([
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=6mo&events=div`,
        {
          headers: BROWSER_HEADERS,
          signal: controller.signal,
          next: { revalidate: 60 },
        }
      ).catch(() => null),
      fetchStatusInvestDividend(clean, isFiagro),
    ]);

    clearTimeout(timeoutId);

    if (!yahooRes || !yahooRes.ok) {
      return null;
    }

    const data: YahooChartResult = await yahooRes.json();
    const resultItem = data?.chart?.result?.[0];
    const meta = resultItem?.meta;

    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      return null;
    }

    const currentPrice = Number(meta.regularMarketPrice.toFixed(2));

    // Obter o fechamento anterior real (evitando chartPreviousClose de 6 meses atrás)
    const closes = (resultItem?.indicators?.quote?.[0]?.close || []).filter(
      (c): c is number => typeof c === 'number' && c > 0
    );
    const fallbackPrevClose =
      closes.length >= 2 ? closes[closes.length - 2] : (meta.previousClose || currentPrice);
    const rawPrevClose = meta.regularMarketPreviousClose || fallbackPrevClose;
    const prevClose = Number(rawPrevClose.toFixed(2));

    const change = currentPrice - prevClose;
    const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

    // 1. Verificar se temos comunicado oficial detalhado (Data-Com, Data Pagamento e Valor)
    let lastDividend = officialDiv?.lastDividend;
    let dividendExDate = officialDiv?.dividendExDate;
    let dividendPaymentDate = officialDiv?.dividendPaymentDate;
    let dividendPaymentDay = officialDiv?.dividendPaymentDay;
    let isCurrentMonthAnnounced = officialDiv?.isCurrentMonthAnnounced ?? false;
    let dividendSource: 'B3_OFICIAL' | 'MERCADO' | undefined = officialDiv?.dividendSource;

    // 2. Fallback para os eventos de dividendos do Yahoo Finance caso o StatusInvest não responda
    if (!lastDividend) {
      const divEvents = resultItem?.events?.dividends;
      if (divEvents) {
        const sortedDivs = Object.values(divEvents)
          .filter((d) => typeof d.amount === 'number' && d.amount > 0)
          .sort((a, b) => b.date - a.date);

        if (sortedDivs.length > 0) {
          const latestYahooDiv = sortedDivs[0];
          lastDividend = Number(latestYahooDiv.amount.toFixed(4));
          const exDateObj = new Date(latestYahooDiv.date * 1000);
          const dd = String(exDateObj.getDate()).padStart(2, '0');
          const mm = String(exDateObj.getMonth() + 1).padStart(2, '0');
          const yyyy = exDateObj.getFullYear();
          dividendExDate = `${dd}/${mm}/${yyyy}`;

          // Calcula se o último evento anunciado pertence ao ciclo atual (últimos 32 dias)
          const daysDiff = (Date.now() - exDateObj.getTime()) / (1000 * 60 * 60 * 24);
          isCurrentMonthAnnounced = daysDiff <= 32;
          dividendPaymentDay = catalogInfo.paymentDay ?? 15;
          dividendSource = 'MERCADO';
        }
      }
    }

    const vp = catalogInfo.vp || currentPrice;
    const pvp = vp > 0 ? Number((currentPrice / vp).toFixed(2)) : 1.0;

    return {
      ticker: clean,
      price: currentPrice,
      prevClose,
      changePercent,
      lastDividend,
      dividendExDate,
      dividendPaymentDate,
      dividendPaymentDay,
      isCurrentMonthAnnounced,
      dividendSource,
      vp,
      pvp,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Erro ao buscar cotação para ${ticker}:`, err);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');

  if (!tickersParam) {
    return NextResponse.json(
      { error: 'Nenhum ticker fornecido. Use ?tickers=MXRF11,VGIR11' },
      { status: 400 }
    );
  }

  const tickerList = tickersParam
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0)
    .slice(0, 30);

  const quotesResults = await Promise.all(tickerList.map((t) => fetchTickerQuote(t)));

  const quotesMap: Record<string, NonNullable<Awaited<ReturnType<typeof fetchTickerQuote>>>> = {};

  for (const quote of quotesResults) {
    if (quote) {
      quotesMap[quote.ticker] = quote;
    }
  }

  return NextResponse.json({
    quotes: quotesMap,
    timestamp: new Date().toISOString(),
  });
}


