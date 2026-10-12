import { NextResponse, connection } from 'next/server';
import { FII_DATABASE, findFiiInfo } from '../../../data/fiiDatabase';
import { classifyB3Ticker } from '../../../lib/b3Parser';

export interface UniversalMarketItem {
  ticker: string;
  name: string;
  assetClass: 'FII' | 'ACAO';
  segment: string;
  price?: number;
  changePercent?: number;
  logoUrl?: string;
  isCurated: boolean;
}

interface BrapiQuoteListItem {
  stock?: string;
  name?: string;
  close?: number;
  change?: number;
  volume?: number;
  market_cap?: number | null;
  logo?: string;
  sector?: string | null;
  type?: string; // "stock" | "fund" | "bdr"
}

interface BrapiQuoteListResponse {
  stocks?: BrapiQuoteListItem[];
}

interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
}

interface YahooSearchResponse {
  quotes?: YahooSearchQuote[];
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

let cachedB3Directory: UniversalMarketItem[] | null = null;
let cachedB3DirectoryExpiresAt = 0;
const DIRECTORY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

function mapBrapiSectorToSegment(
  sector: string | null | undefined,
  assetClass: 'FII' | 'ACAO',
  fallbackSegment: string
): string {
  if (fallbackSegment && fallbackSegment !== 'Outros' && fallbackSegment !== 'Ações - Outros') {
    return fallbackSegment;
  }
  if (assetClass === 'FII') {
    return 'FII B3';
  }
  if (!sector) return 'Ações B3';
  const s = sector.toLowerCase();
  if (s.includes('financ') || s.includes('bank')) return 'Ações - Financeiro';
  if (s.includes('utilit') || s.includes('energ') || s.includes('elétr')) return 'Ações - Energia & Utilidades';
  if (s.includes('mineral') || s.includes('basic') || s.includes('oil') || s.includes('petr'))
    return 'Ações - Commodities';
  if (s.includes('retail') || s.includes('varej') || s.includes('consum')) return 'Ações - Consumo & Varejo';
  if (s.includes('health') || s.includes('saúde')) return 'Ações - Saúde';
  if (s.includes('tech') || s.includes('communic')) return 'Ações - Tecnologia & Telecom';
  if (s.includes('industr') || s.includes('transp')) return 'Ações - Indústria & Logística';
  return 'Ações B3';
}

async function getFullB3Directory(): Promise<UniversalMarketItem[]> {
  if (cachedB3Directory && cachedB3DirectoryExpiresAt > Date.now()) {
    return cachedB3Directory;
  }

  const map = new Map<string, UniversalMarketItem>();

  // 1. Garante todos os ativos da curadoria local (75+ FIIs e 30+ Ações de Dividendos)
  for (const item of FII_DATABASE) {
    map.set(item.ticker, {
      ticker: item.ticker,
      name: item.name,
      assetClass: item.assetClass || 'FII',
      segment: item.segment,
      isCurated: true,
    });
  }

  // 2. Puxa a lista universal de todos os ativos negociados na B3 via Brapi (/api/quote/list)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      'https://brapi.dev/api/quote/list?sortBy=volume&sortOrder=desc&limit=1200',
      {
        headers: BROWSER_HEADERS,
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (res.ok) {
      const data: BrapiQuoteListResponse = await res.json();
      const stocks = data?.stocks || [];

      for (const raw of stocks) {
        const ticker = (raw.stock || '').trim().toUpperCase();
        if (!ticker || ticker.endsWith('F')) continue;
        if (raw.type === 'bdr') continue;

        const classification = classifyB3Ticker(ticker);
        if (classification !== 'FII' && classification !== 'ACAO') continue;

        const existing = map.get(ticker);
        const catalogInfo = findFiiInfo(ticker);

        const price =
          typeof raw.close === 'number' && raw.close > 0
            ? Number(raw.close.toFixed(2))
            : undefined;
        const changePercent =
          typeof raw.change === 'number' ? Number(raw.change.toFixed(2)) : undefined;

        map.set(ticker, {
          ticker,
          name: existing?.name || raw.name || catalogInfo.name,
          assetClass: existing?.assetClass || classification,
          segment: mapBrapiSectorToSegment(
            raw.sector,
            existing?.assetClass || classification,
            existing?.segment || catalogInfo.segment
          ),
          price,
          changePercent,
          logoUrl: raw.logo,
          isCurated: existing?.isCurated ?? false,
        });
      }
    }
  } catch {
    // Em caso de falha de rede externa, mantém a base local ativa
  }

  const list = Array.from(map.values());
  cachedB3Directory = list;
  cachedB3DirectoryExpiresAt = Date.now() + DIRECTORY_CACHE_TTL_MS;
  return list;
}

async function searchYahooB3(query: string): Promise<UniversalMarketItem[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      query
    )}&quotesCount=20&newsCount=0`;

    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const data: YahooSearchResponse = await res.json();
    const quotes = data?.quotes || [];
    const results: UniversalMarketItem[] = [];

    for (const q of quotes) {
      const rawSymbol = (q.symbol || '').toUpperCase();
      if (!rawSymbol.endsWith('.SA')) continue;

      const ticker = rawSymbol.replace(/\.SA$/, '');
      if (ticker.endsWith('F')) continue;

      const classification = classifyB3Ticker(ticker);
      if (classification !== 'FII' && classification !== 'ACAO') continue;

      const catalogInfo = findFiiInfo(ticker);
      const isGeneric =
        catalogInfo.name.endsWith('Ação B3') ||
        catalogInfo.name.endsWith('Fundo Imobiliário B3');

      results.push({
        ticker,
        name: !isGeneric
          ? catalogInfo.name
          : q.longname || q.shortname || catalogInfo.name,
        assetClass: classification,
        segment: catalogInfo.segment === 'Outros' ? 'FII B3' : catalogInfo.segment,
        isCurated: !isGeneric,
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  await connection();
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim().toUpperCase();
  const assetType = (searchParams.get('type') || 'ALL').toUpperCase();
  const limit = Math.min(120, Math.max(10, parseInt(searchParams.get('limit') || '60', 10)));

  const directory = await getFullB3Directory();

  let filtered = directory.filter((item) => {
    if (assetType === 'FII' && item.assetClass !== 'FII') return false;
    if (assetType === 'ACAO' && item.assetClass !== 'ACAO') return false;
    if (!query) return true;
    return (
      item.ticker.includes(query) ||
      item.name.toUpperCase().includes(query) ||
      item.segment.toUpperCase().includes(query)
    );
  });

  // Se o usuário digitou um ticker ou nome específico e encontramos poucos resultados locais,
  // consulta em tempo real o índice global .SA do Yahoo Finance para cobrir 100% da B3
  if (query.length >= 2 && filtered.length < 8) {
    const yahooMatches = await searchYahooB3(query);
    const seen = new Set(filtered.map((i) => i.ticker));
    for (const ym of yahooMatches) {
      if (assetType === 'FII' && ym.assetClass !== 'FII') continue;
      if (assetType === 'ACAO' && ym.assetClass !== 'ACAO') continue;
      if (!seen.has(ym.ticker)) {
        seen.add(ym.ticker);
        filtered.push(ym);
      }
    }
  }

  // Se a query parece um ticker direto da B3 (ex: PRIO3, MGLU3, JURO11) e ainda não está na lista,
  // adiciona o candidato direto para permitir inspeção ao vivo via /api/quote
  const directClass = classifyB3Ticker(query);
  if (
    (directClass === 'FII' || directClass === 'ACAO') &&
    !filtered.some((i) => i.ticker === query)
  ) {
    if (
      assetType === 'ALL' ||
      (assetType === 'FII' && directClass === 'FII') ||
      (assetType === 'ACAO' && directClass === 'ACAO')
    ) {
      const info = findFiiInfo(query);
      filtered = [
        {
          ticker: query,
          name: info.name,
          assetClass: directClass,
          segment: info.segment,
          isCurated: false,
        },
        ...filtered,
      ];
    }
  }

  return NextResponse.json({
    totalDirectoryCount: directory.length,
    matchCount: filtered.length,
    items: filtered.slice(0, limit),
    timestamp: new Date().toISOString(),
  });
}
