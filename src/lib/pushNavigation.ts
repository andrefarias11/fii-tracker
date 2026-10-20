import { normalizeB3Ticker } from './ticker';

export type PushAlertEventType =
  | 'DIVIDEND_ANNOUNCED'
  | 'DIVIDEND_UPDATED'
  | 'EX_DATE_REMINDER'
  | 'PAYMENT_REMINDER'
  | 'FII_NEWS'
  | 'MACRO_NEWS'
  | 'MARKET_OPEN'
  | 'MARKET_CLOSE';

const ALLOWED_EVENT_TYPES = new Set<PushAlertEventType>([
  'DIVIDEND_ANNOUNCED',
  'DIVIDEND_UPDATED',
  'EX_DATE_REMINDER',
  'PAYMENT_REMINDER',
  'FII_NEWS',
  'MACRO_NEWS',
  'MARKET_OPEN',
  'MARKET_CLOSE',
]);

export interface PushNavigationTarget {
  tab: 'portfolio' | 'proventos' | 'radar' | 'goals';
  exploreSubView?: 'radar' | 'universal' | 'map' | 'ai' | 'mentors';
  homeSubView?: 'assets' | 'fixed_income' | 'history';
  ticker: string | null;
  date: string | null; // YYYY-MM-DD
  eventType: PushAlertEventType | null;
}

export function isValidIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Constrói uma URL interna segura para navegação a partir da notificação Push.
 * Nunca inclui valores financeiros, quantidade de cotas, tokens ou identificadores de conta.
 */
export function buildSafePushUrl(params: {
  tab?: 'portfolio' | 'proventos' | 'radar' | 'goals';
  ticker?: string | null;
  date?: string | null;
  eventType?: PushAlertEventType | null;
}): string {
  const search = new URLSearchParams();
  const tab = params.tab || 'proventos';
  search.set('tab', tab);

  if (params.ticker) {
    const cleanTicker = normalizeB3Ticker(params.ticker);
    if (/^[A-Z]{4}\d{1,2}B?$/.test(cleanTicker)) {
      search.set('ticker', cleanTicker);
    }
  }

  if (params.date && isValidIsoCalendarDate(params.date)) {
    search.set('date', params.date);
  }

  if (params.eventType && ALLOWED_EVENT_TYPES.has(params.eventType)) {
    search.set('event', params.eventType);
  }

  return `/?${search.toString()}`;
}

/**
 * Faz o parse seguro de uma URL de notificação Push para navegação interna.
 */
export function parsePushNavigationUrl(
  rawUrl: string,
  baseOrigin = 'https://fiitracker.local'
): PushNavigationTarget | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const parsedOrigin = new URL(baseOrigin);
    const url = new URL(rawUrl, parsedOrigin.origin);
    if (url.origin !== parsedOrigin.origin) return null;

    const rawTab = url.searchParams.get('tab');
    const rawTicker = url.searchParams.get('ticker');
    const rawDate = url.searchParams.get('date');
    const rawEvent = url.searchParams.get('event');

    const cleanTicker = rawTicker ? normalizeB3Ticker(rawTicker) : '';
    const ticker = /^[A-Z]{4}\d{1,2}B?$/.test(cleanTicker) ? cleanTicker : null;
    const date = isValidIsoCalendarDate(rawDate) ? rawDate : null;
    const eventType =
      rawEvent && ALLOWED_EVENT_TYPES.has(rawEvent as PushAlertEventType)
        ? (rawEvent as PushAlertEventType)
        : null;

    let tab: PushNavigationTarget['tab'] = 'portfolio';
    let exploreSubView: PushNavigationTarget['exploreSubView'] = undefined;
    let homeSubView: PushNavigationTarget['homeSubView'] = undefined;

    if (rawTab === 'proventos' || (!rawTab && (ticker || date || eventType))) {
      tab = 'proventos';
    } else if (rawTab === 'radar') {
      tab = 'radar';
      exploreSubView = 'radar';
    } else if (rawTab === 'mentors') {
      tab = 'radar';
      exploreSubView = 'mentors';
    } else if (rawTab === 'universal') {
      tab = 'radar';
      exploreSubView = 'universal';
    } else if (rawTab === 'map') {
      tab = 'radar';
      exploreSubView = 'map';
    } else if (rawTab === 'ai') {
      tab = 'radar';
      exploreSubView = 'ai';
    } else if (rawTab === 'goals' || rawTab === 'achievements') {
      tab = 'goals';
    } else if (rawTab === 'history') {
      tab = 'portfolio';
      homeSubView = 'history';
    } else if (rawTab === 'fixed_income' || rawTab === 'caixinhas') {
      tab = 'portfolio';
      homeSubView = 'fixed_income';
    } else if (rawTab === 'portfolio') {
      tab = 'portfolio';
      homeSubView = 'assets';
    } else if (!rawTab) {
      return null;
    }

    return {
      tab,
      exploreSubView,
      homeSubView,
      ticker,
      date,
      eventType,
    };
  } catch {
    return null;
  }
}

