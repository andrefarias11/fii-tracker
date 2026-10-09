import { NextResponse } from 'next/server';

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        symbol?: string;
      };
    }>;
    error?: unknown;
  };
}

async function fetchTickerQuote(ticker: string) {
  const clean = ticker.trim().toUpperCase();
  const yahooSymbol = clean.endsWith('.SA') ? clean : `${clean}.SA`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal,
        next: { revalidate: 60 } // Cache no servidor Next.js por 60 segundos para performance máxima
      }
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const data: YahooChartResult = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      return null;
    }

    const currentPrice = Number(meta.regularMarketPrice.toFixed(2));
    const prevClose = Number((meta.previousClose || meta.chartPreviousClose || currentPrice).toFixed(2));
    const change = currentPrice - prevClose;
    const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

    return {
      ticker: clean,
      price: currentPrice,
      prevClose,
      changePercent,
      updatedAt: new Date().toISOString()
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
    return NextResponse.json({ error: 'Nenhum ticker fornecido. Use ?tickers=MXRF11,VGIR11' }, { status: 400 });
  }

  const tickerList = tickersParam
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0)
    .slice(0, 30); // Limite de 30 tickers por requisição

  const quotesResults = await Promise.all(tickerList.map((t) => fetchTickerQuote(t)));

  const quotesMap: Record<string, { price: number; prevClose: number; changePercent: number; updatedAt: string }> = {};

  for (const quote of quotesResults) {
    if (quote) {
      quotesMap[quote.ticker] = {
        price: quote.price,
        prevClose: quote.prevClose,
        changePercent: quote.changePercent,
        updatedAt: quote.updatedAt
      };
    }
  }

  return NextResponse.json({
    quotes: quotesMap,
    timestamp: new Date().toISOString()
  });
}

