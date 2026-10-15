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
        shortName?: string;
        longName?: string;
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
  lastDividend: number; // Mensal (FII) ou Média Mensal 12m/12 (Ação)
  annualDividend12m?: number;
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

function parseDateBrToTimestamp(dateBr?: string): number | null {
  if (!dateBr || !dateBr.includes('/')) return null;
  const parts = dateBr.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m, d).getTime();
}

function getSaoPauloDate(date: Date = new Date()): { day: number; month: number; year: number } {
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    const day = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
    const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
    const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10);
    return { day, month, year };
  } catch {
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }
}

function isDateInMonthYear(
  dateBr: string | undefined,
  targetMonth: number,
  targetYear: number
): boolean {
  if (!dateBr || typeof dateBr !== 'string' || !dateBr.includes('/')) return false;
  const parts = dateBr.split('/');
  if (parts.length !== 3) return false;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return false;
  return m === targetMonth && y === targetYear;
}

async function fetchStatusInvestJson(
  url: string,
  timeoutMs = 3500
): Promise<StatusInvestProventsResponse | null> {
  // 1. Tentar com fetch nativo primeiro
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      next: { revalidate: 300 }, // Cache de 5 minutos para comunicados de proventos
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: StatusInvestProventsResponse = await res.json();
      if (Array.isArray(data?.assetEarningsModels) && data.assetEarningsModels.length > 0) {
        return data;
      }
    }
  } catch {
    // Continua para o fallback de curl caso fetch sofra timeout ou bloqueio de TLS/Cloudflare
  }

  try {
    const { execFile } = await import('child_process');
    const { existsSync } = await import('fs');
    const curlBin =
      process.platform === 'win32'
        ? 'curl.exe'
        : existsSync('/usr/bin/curl')
        ? '/usr/bin/curl'
        : 'curl';

    const stdout = await new Promise<string | null>((resolve) => {
      execFile(
        curlBin,
        [
          '-s',
          url,
          '-H',
          `User-Agent: ${BROWSER_HEADERS['User-Agent']}`,
          '-H',
          'Accept: application/json',
          '--max-time',
          String(Math.ceil(timeoutMs / 1000)),
        ],
        (error, out) => {
          if (error || !out) resolve(null);
          else resolve(out);
        }
      );
    });

    if (stdout) {
      const data: StatusInvestProventsResponse = JSON.parse(stdout);
      if (Array.isArray(data?.assetEarningsModels) && data.assetEarningsModels.length > 0) {
        return data;
      }
    }
  } catch {
    // Silencioso se curl não estiver disponível no runtime
  }

  return null;
}

async function fetchStatusInvestDividend(
  ticker: string,
  isFiagro: boolean,
  isStock: boolean
): Promise<OfficialDividendData | null> {
  const endpoints = isStock
    ? [
        `https://statusinvest.com.br/acao/companytickerprovents?ticker=${encodeURIComponent(ticker)}&chartProventsType=0`,
        `https://statusinvest.com.br/acoes/companytickerprovents?ticker=${encodeURIComponent(ticker)}&chartProventsType=0`,
      ]
    : isFiagro
    ? [
        `https://statusinvest.com.br/fii/companytickerprovents?ticker=${encodeURIComponent(ticker)}&chartProventsType=0`,
        `https://statusinvest.com.br/fiagro/companytickerprovents?ticker=${encodeURIComponent(ticker)}&chartProventsType=0`,
      ]
    : [
        `https://statusinvest.com.br/fii/companytickerprovents?ticker=${encodeURIComponent(ticker)}&chartProventsType=0`,
      ];

  for (const url of endpoints) {
    try {
      const data = await fetchStatusInvestJson(url, 3500);
      const list = data?.assetEarningsModels;
      if (!Array.isArray(list) || list.length === 0) continue;

      // Filtrar apenas proventos com valor numérico positivo válido
      const valid = list.filter((item) => typeof item.v === 'number' && item.v > 0);
      if (valid.length === 0) continue;

      // Ordenar do mais recente para o mais antigo por data de pagamento ou data-com
      valid.sort((a, b) => {
        const tsA = parseDateBrToTimestamp(a.pd) || parseDateBrToTimestamp(a.ed) || 0;
        const tsB = parseDateBrToTimestamp(b.pd) || parseDateBrToTimestamp(b.ed) || 0;
        return tsB - tsA;
      });

      const { month: curMonth, year: curYear } = getSaoPauloDate();

      // Procurar se há algum provento na lista cujo pd (Data de Pagamento) ou ed (Data-Com) pertença ao mês/ano vigente no fuso America/Sao_Paulo
      const currentMonthProvent = valid.find(
        (item) =>
          isDateInMonthYear(item.pd, curMonth, curYear) ||
          isDateInMonthYear(item.ed, curMonth, curYear)
      );

      const isCurrentMonthAnnounced = Boolean(currentMonthProvent);
      // Se existir comunicado para o mês vigente, usa ele; senão usa o último pago como referência de estimativa
      const targetItem = currentMonthProvent || valid[0];

      const exDate = targetItem.ed && targetItem.ed !== '-' ? targetItem.ed : undefined;
      const payDate = targetItem.pd && targetItem.pd !== '-' ? targetItem.pd : undefined;

      let paymentDay: number | undefined = undefined;
      if (payDate && payDate.includes('/')) {
        const dayNum = parseInt(payDate.slice(0, 2), 10);
        if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
          paymentDay = dayNum;
        }
      }

      let amount = Number((targetItem.v || 0).toFixed(4));
      let annualDividend12m = Number((amount * 12).toFixed(4));

      // Para Ações (dividendos trimestrais/semestrais/JCP), calcula o acumulado de 12 meses dividido por 12 (média mensal equivalente)
      if (isStock) {
        const oneYearAgoMs = Date.now() - 370 * 24 * 60 * 60 * 1000;
        const sum12m = valid.reduce((acc, item) => {
          const ts = parseDateBrToTimestamp(item.ed) || parseDateBrToTimestamp(item.pd);
          if (ts && ts >= oneYearAgoMs) {
            return acc + (item.v || 0);
          }
          return acc;
        }, 0);

        if (sum12m > 0) {
          annualDividend12m = Number(sum12m.toFixed(4));
          amount = Number((sum12m / 12).toFixed(4));
        }
      }

      return {
        lastDividend: amount,
        annualDividend12m,
        dividendExDate: exDate,
        dividendPaymentDate: payDate,
        dividendPaymentDay: paymentDay,
        isCurrentMonthAnnounced,
        dividendSource: 'B3_OFICIAL',
      };
    } catch {
      // Silencioso: tenta próximo endpoint ou cai no fallback do Yahoo Finance
    }
  }

  return null;
}

interface BrapiCashDividend {
  assetIssued?: string;
  paymentDate?: string;
  rate?: number;
  relatedTo?: string;
  approvedOn?: string;
  lastDatePrior?: string;
}

interface BrapiDividendResponse {
  results?: Array<{
    symbol?: string;
    dividendsData?: {
      cashDividends?: BrapiCashDividend[];
    };
  }>;
}

async function fetchBrapiDividend(
  ticker: string,
  isStock: boolean
): Promise<OfficialDividendData | null> {
  const token = process.env.BRAPI_TOKEN || process.env.NEXT_PUBLIC_BRAPI_TOKEN;
  if (!token) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?dividends=true&token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json: BrapiDividendResponse = await res.json();
    const result = json?.results?.[0];
    const cashDividends = result?.dividendsData?.cashDividends;
    if (!Array.isArray(cashDividends) || cashDividends.length === 0) return null;

    const valid = cashDividends.filter(
      (d): d is BrapiCashDividend & { rate: number } => typeof d.rate === 'number' && d.rate > 0
    );
    if (valid.length === 0) return null;

    valid.sort((a, b) => {
      const tsA = new Date(a.paymentDate || a.lastDatePrior || 0).getTime();
      const tsB = new Date(b.paymentDate || b.lastDatePrior || 0).getTime();
      return tsB - tsA;
    });

    const { month: curMonth, year: curYear } = getSaoPauloDate();

    const currentMonthItem = valid.find((item) => {
      if (item.paymentDate) {
        const d = new Date(item.paymentDate);
        if (!isNaN(d.getTime())) {
          const { month, year } = getSaoPauloDate(d);
          if (month === curMonth && year === curYear) return true;
        }
      }
      if (item.lastDatePrior) {
        const d = new Date(item.lastDatePrior);
        if (!isNaN(d.getTime())) {
          const { month, year } = getSaoPauloDate(d);
          if (month === curMonth && year === curYear) return true;
        }
      }
      return false;
    });

    const isCurrentMonthAnnounced = Boolean(currentMonthItem);
    const targetItem = currentMonthItem || valid[0];

    const formatIsoToBr = (iso?: string) => {
      if (!iso) return undefined;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return undefined;
      const { day, month, year } = getSaoPauloDate(d);
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    };

    const exDate = formatIsoToBr(targetItem.lastDatePrior || targetItem.approvedOn);
    const payDate = formatIsoToBr(targetItem.paymentDate);
    let paymentDay: number | undefined = undefined;
    if (payDate) {
      const p = parseInt(payDate.slice(0, 2), 10);
      if (!isNaN(p) && p >= 1 && p <= 31) paymentDay = p;
    }

    let amount = Number(targetItem.rate.toFixed(4));
    let annualDividend12m = Number((amount * 12).toFixed(4));

    if (isStock) {
      const oneYearAgoMs = Date.now() - 370 * 24 * 60 * 60 * 1000;
      const sum12m = valid.reduce((acc, item) => {
        const ts = new Date(item.paymentDate || item.lastDatePrior || 0).getTime();
        if (ts && ts >= oneYearAgoMs) {
          return acc + (item.rate || 0);
        }
        return acc;
      }, 0);
      if (sum12m > 0) {
        annualDividend12m = Number(sum12m.toFixed(4));
        amount = Number((sum12m / 12).toFixed(4));
      }
    }

    return {
      lastDividend: amount,
      annualDividend12m,
      dividendExDate: exDate,
      dividendPaymentDate: payDate,
      dividendPaymentDay: paymentDay,
      isCurrentMonthAnnounced,
      dividendSource: 'B3_OFICIAL',
    };
  } catch {
    return null;
  }
}

async function fetchTickerQuote(ticker: string) {
  const clean = ticker.trim().toUpperCase();
  const yahooSymbol = clean.endsWith('.SA') ? clean : `${clean}.SA`;
  const catalogInfo = findFiiInfo(clean);
  const isFiagro = catalogInfo.segment === 'Fiagro';
  const isStock = catalogInfo.assetClass === 'ACAO';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    // Busca em paralelo: Cotação em tempo real (Yahoo) + Comunicados oficiais de dividendos (StatusInvest/Brapi/B3)
    const [yahooRes, officialDiv] = await Promise.all([
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y&events=div`,
        {
          headers: BROWSER_HEADERS,
          signal: controller.signal,
          next: { revalidate: 60 },
        }
      ).catch(() => null),
      fetchStatusInvestDividend(clean, isFiagro, isStock).then(async (statusInvestRes) => {
        if (statusInvestRes) return statusInvestRes;
        // Fallback para API da Brapi caso StatusInvest sofra bloqueio ou timeout no ambiente Linux/Vercel
        return fetchBrapiDividend(clean, isStock);
      }),
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

    // Obter o fechamento anterior real (evitando chartPreviousClose de 1 ano atrás)
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
    let annualDividend12m = officialDiv?.annualDividend12m;
    let dividendExDate = officialDiv?.dividendExDate;
    const dividendPaymentDate = officialDiv?.dividendPaymentDate;
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
          if (isStock) {
            const sum12m = sortedDivs.reduce((acc, d) => acc + d.amount, 0);
            annualDividend12m = Number(sum12m.toFixed(4));
            lastDividend = Number((sum12m / 12).toFixed(4));
          } else {
            lastDividend = Number(latestYahooDiv.amount.toFixed(4));
            annualDividend12m = Number((lastDividend * 12).toFixed(4));
          }

          const exDateObj = new Date(latestYahooDiv.date * 1000);
          const { day: exDay, month: exMonth, year: exYear } = getSaoPauloDate(exDateObj);
          const dd = String(exDay).padStart(2, '0');
          const mm = String(exMonth).padStart(2, '0');
          const yyyy = exYear;
          dividendExDate = `${dd}/${mm}/${yyyy}`;

          const { month: curMonth, year: curYear } = getSaoPauloDate();
          const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
          const prevYear = curMonth === 1 ? curYear - 1 : curYear;

          // Validação rigorosa de ciclo atual (sem falsos positivos por janela deslizante):
          // 1) Data-Com dentro do mês/ano vigente no fuso America/Sao_Paulo (ex: 01/10/2026 ou 14/10/2026)
          // 2) OU Data-Com no final do mês imediatamente anterior (>= dia 25) cujo pagamento ocorre no mês atual
          const isExInCurMonth = exYear === curYear && exMonth === curMonth;
          const isExInPrevMonthEnd = exYear === prevYear && exMonth === prevMonth && exDay >= 25;

          isCurrentMonthAnnounced = isExInCurMonth || isExInPrevMonthEnd;
          dividendPaymentDay = catalogInfo.paymentDay ?? 15;
          dividendSource = 'MERCADO';
        }
      }
    }

    const vp = catalogInfo.vp || currentPrice;
    const pvp = vp > 0 ? Number((currentPrice / vp).toFixed(2)) : 1.0;
    const isGenericCatalogName =
      catalogInfo.name.endsWith('Ação B3') ||
      catalogInfo.name.endsWith('Fundo Imobiliário B3');
    const resolvedName =
      !isGenericCatalogName
        ? catalogInfo.name
        : meta.longName || meta.shortName || catalogInfo.name;

    return {
      ticker: clean,
      name: resolvedName,
      assetClass: catalogInfo.assetClass || 'FII',
      segment: catalogInfo.segment,
      price: currentPrice,
      prevClose,
      changePercent,
      lastDividend,
      annualDividend12m,
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

type ResolvedQuote = NonNullable<Awaited<ReturnType<typeof fetchTickerQuote>>>;

const QUOTE_CACHE_TTL_MS = 30_000; // 30 segundos de cache em memória para evitar rate-limit e acelerar respostas
const quoteMemoryCache = new Map<string, { data: ResolvedQuote; expiresAt: number }>();

async function fetchTickerQuoteWithCache(ticker: string): Promise<ResolvedQuote | null> {
  const clean = ticker.trim().toUpperCase();
  const cached = quoteMemoryCache.get(clean);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const fresh = await fetchTickerQuote(clean);
  if (fresh) {
    quoteMemoryCache.set(clean, {
      data: fresh,
      expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
    });
  }
  return fresh;
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

  const tickerList = Array.from(
    new Set(
      tickersParam
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0)
    )
  ).slice(0, 35);

  const quotesResults = await Promise.all(
    tickerList.map((t) => fetchTickerQuoteWithCache(t))
  );

  const quotesMap: Record<string, ResolvedQuote> = {};

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


