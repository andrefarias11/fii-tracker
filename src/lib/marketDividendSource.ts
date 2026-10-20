import { findFiiInfo } from '../data/fiiDatabase';
import { normalizeB3Ticker } from './ticker';
import { isValidIsoCalendarDate } from './pushNavigation';

export type VerifiedDividendSourceName = 'STATUS_INVEST' | 'BRAPI';

export interface VerifiedDividendAnnouncement {
  ticker: string;
  source: VerifiedDividendSourceName;
  amountPerShare: number;
  exDate: string; // YYYY-MM-DD
  exDateBr: string; // DD/MM/YYYY
  paymentDate: string; // YYYY-MM-DD
  paymentDateBr: string; // DD/MM/YYYY
  referenceCycle: string; // YYYY-MM
  dataVersion: string; // v=...|ed=...|pd=...
  fetchedAt: string; // ISO timestamp
}

export function normalizeBrOrIsoDate(value?: string | null): { iso: string; br: string } | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    if (!isValidIsoCalendarDate(trimmed)) return null;
    const [y, m, d] = trimmed.split('-');
    return { iso: trimmed, br: `${d}/${m}/${y}` };
  }

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    const iso = `${y}-${m}-${d}`;
    if (!isValidIsoCalendarDate(iso)) return null;
    return { iso, br: `${d}/${m}/${y}` };
  }

  // ISO datetime string (e.g. from Brapi: "2026-10-15T00:00:00.000Z")
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(trimmed)) {
    const datePart = trimmed.slice(0, 10);
    if (!isValidIsoCalendarDate(datePart)) return null;
    const [y, m, d] = datePart.split('-');
    return { iso: datePart, br: `${d}/${m}/${y}` };
  }

  return null;
}

export function computeAnnouncementDataVersion(
  amountPerShare: number,
  exDateIso: string,
  paymentDateIso: string
): string {
  return `v=${Number(amountPerShare).toFixed(4)}|ed=${exDateIso}|pd=${paymentDateIso}`;
}

/**
 * Valida estritamente se um candidato de provento é um anúncio oficial confirmado.
 * Rejeita estimativas, valores manuais, catálogo estático ou eventos sem Data-Com e Data de Pagamento verificáveis.
 */
export function buildVerifiedAnnouncement(input: {
  ticker: string;
  source?: string | null;
  amountPerShare?: number | null;
  exDate?: string | null;
  paymentDate?: string | null;
  isCurrentMonthAnnounced?: boolean;
  referenceDateIso?: string;
  fetchedAt?: string;
}): VerifiedDividendAnnouncement | null {
  const cleanTicker = normalizeB3Ticker(input.ticker || '');
  if (!cleanTicker) return null;

  // Nunca aceita fontes manuais, catálogo estático ou estimativas de mercado sem comunicado completo
  if (input.source !== 'STATUS_INVEST' && input.source !== 'BRAPI') {
    return null;
  }

  if (input.isCurrentMonthAnnounced === false) {
    return null;
  }

  const amount = Number(input.amountPerShare);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const exNorm = normalizeBrOrIsoDate(input.exDate);
  const payNorm = normalizeBrOrIsoDate(input.paymentDate);
  if (!exNorm || !payNorm) {
    return null;
  }

  if (payNorm.iso < exNorm.iso) {
    return null;
  }

  if (
    input.referenceDateIso &&
    !isCycleRelevantForReferenceDate(exNorm.iso, payNorm.iso, input.referenceDateIso)
  ) {
    return null;
  }

  const normalizedAmount = Number(amount.toFixed(4));
  const referenceCycle = payNorm.iso.slice(0, 7);
  const dataVersion = computeAnnouncementDataVersion(normalizedAmount, exNorm.iso, payNorm.iso);

  return {
    ticker: cleanTicker,
    source: input.source,
    amountPerShare: normalizedAmount,
    exDate: exNorm.iso,
    exDateBr: exNorm.br,
    paymentDate: payNorm.iso,
    paymentDateBr: payNorm.br,
    referenceCycle,
    dataVersion,
    fetchedAt: input.fetchedAt || new Date().toISOString(),
  };
}

interface StatusInvestEarningItem {
  v?: number;
  ed?: string;
  pd?: string;
  et?: string;
}

interface StatusInvestProventsResponse {
  assetEarningsModels?: StatusInvestEarningItem[];
}

interface BrapiCashDividend {
  paymentDate?: string;
  rate?: number;
  approvedOn?: string;
  lastDatePrior?: string;
  exDate?: string;
}

interface BrapiDividendResponse {
  dividends?: BrapiCashDividend[];
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

function isCycleRelevantForReferenceDate(
  exDateIso: string,
  paymentDateIso: string,
  referenceDateIso: string
): boolean {
  const refMonth = referenceDateIso.slice(0, 7);
  // O anúncio deve pertencer ao mês corrente ou futuro (por Data-Com ou Data de Pagamento)
  return exDateIso.slice(0, 7) >= refMonth || paymentDateIso.slice(0, 7) >= refMonth;
}

async function fetchFromStatusInvest(
  ticker: string,
  referenceDateIso: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ announcements: VerifiedDividendAnnouncement[]; available: boolean }> {
  const catalogInfo = findFiiInfo(ticker);
  const isFiagro = catalogInfo.segment === 'Fiagro';
  const isStock = catalogInfo.assetClass === 'ACAO';

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
      const res = await fetchImpl(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;

      const data: StatusInvestProventsResponse = await res.json();
      const list = data?.assetEarningsModels;
      if (!Array.isArray(list)) continue;

      const candidates: Array<{ item: StatusInvestEarningItem; exIso: string; payIso: string }> = [];
      for (const item of list) {
        if (typeof item.v !== 'number' || item.v <= 0) continue;
        const ex = normalizeBrOrIsoDate(item.ed);
        const pay = normalizeBrOrIsoDate(item.pd);
        if (!ex || !pay) continue;
        if (!isCycleRelevantForReferenceDate(ex.iso, pay.iso, referenceDateIso)) continue;
        candidates.push({ item, exIso: ex.iso, payIso: pay.iso });
      }

      const announcements = candidates
        .map(({ item, exIso, payIso }) =>
          buildVerifiedAnnouncement({
            ticker,
            source: 'STATUS_INVEST',
            amountPerShare: item.v,
            exDate: exIso,
            paymentDate: payIso,
            isCurrentMonthAnnounced: true,
          })
        )
        .filter((event): event is VerifiedDividendAnnouncement => Boolean(event));
      return { announcements, available: true };
    } catch {
      // Tenta próximo endpoint ou fallback Brapi
    }
  }

  return { announcements: [], available: false };
}

async function fetchFromBrapi(
  ticker: string,
  referenceDateIso: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ announcements: VerifiedDividendAnnouncement[]; available: boolean }> {
  const token = (process.env.BRAPI_TOKEN || '').trim();
  if (!token) return { announcements: [], available: false };

  try {
    const catalogInfo = findFiiInfo(ticker);
    const isStock = catalogInfo.assetClass === 'ACAO';
    const isFiagro = catalogInfo.segment === 'Fiagro';
    const endpoint = isStock ? 'stocks' : isFiagro ? 'funds' : 'fii';
    const url = `https://brapi.dev/api/v2/${endpoint}/dividends?symbols=${encodeURIComponent(ticker)}`;
    const res = await fetchImpl(url, {
      headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { announcements: [], available: false };

    const json: BrapiDividendResponse = await res.json();
    const dividends = json?.dividends;
    if (!Array.isArray(dividends)) return { announcements: [], available: false };

    const candidates: Array<{ rate: number; exIso: string; payIso: string }> = [];
    for (const d of dividends) {
      if (typeof d.rate !== 'number' || d.rate <= 0) continue;
      // approvedOn e exDate não comprovam a última data com direito (Data-Com).
      const ex = normalizeBrOrIsoDate(d.lastDatePrior);
      const pay = normalizeBrOrIsoDate(d.paymentDate);
      if (!ex || !pay) continue;
      if (!isCycleRelevantForReferenceDate(ex.iso, pay.iso, referenceDateIso)) continue;
      candidates.push({ rate: d.rate, exIso: ex.iso, payIso: pay.iso });
    }

    const announcements = candidates
      .map(({ rate, exIso, payIso }) =>
        buildVerifiedAnnouncement({
          ticker,
          source: 'BRAPI',
          amountPerShare: rate,
          exDate: exIso,
          paymentDate: payIso,
          isCurrentMonthAnnounced: true,
        })
      )
      .filter((event): event is VerifiedDividendAnnouncement => Boolean(event));
    return { announcements, available: true };
  } catch {
    return { announcements: [], available: false };
  }
}

const ANNOUNCEMENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache compartilhado entre usuários
const announcementCache = new Map<
  string,
  { announcements: VerifiedDividendAnnouncement[]; expiresAt: number }
>();
const inFlightLookups = new Map<string, Promise<VerifiedDividendAnnouncement[]>>();

export function clearAnnouncementCache(): void {
  announcementCache.clear();
  inFlightLookups.clear();
}

export async function fetchVerifiedAnnouncementForTicker(
  ticker: string,
  options: {
    referenceDateIso?: string;
    fetchImpl?: typeof fetch;
    bypassCache?: boolean;
  } = {}
): Promise<VerifiedDividendAnnouncement[]> {
  const cleanTicker = normalizeB3Ticker(ticker);
  if (!cleanTicker) return [];

  const refDate =
    options.referenceDateIso ||
    new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const cacheKey = `${cleanTicker}:${refDate.slice(0, 7)}`;

  if (!options.bypassCache) {
    const cached = announcementCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.announcements;
    }
    const inflight = inFlightLookups.get(cacheKey);
    if (inflight) return inflight;
  }

  const lookupPromise = (async () => {
    const fetchImpl = options.fetchImpl || fetch;
    const [fromStatusInvest, fromBrapi] = await Promise.all([
      fetchFromStatusInvest(cleanTicker, refDate, fetchImpl),
      fetchFromBrapi(cleanTicker, refDate, fetchImpl),
    ]);
    if (!fromStatusInvest.available && !fromBrapi.available) {
      throw new Error(`Fontes de proventos indisponíveis para ${cleanTicker}.`);
    }
    const unique = new Map<string, VerifiedDividendAnnouncement>();
    for (const event of [...fromStatusInvest.announcements, ...fromBrapi.announcements]) {
      const key = `${event.exDate}:${event.paymentDate}:${event.amountPerShare}`;
      if (!unique.has(key)) unique.set(key, event);
    }
    const resolved = Array.from(unique.values()).sort(
      (a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.exDate.localeCompare(b.exDate)
    );

    if (announcementCache.size >= 1000) {
      const oldestKey = announcementCache.keys().next().value;
      if (oldestKey) announcementCache.delete(oldestKey);
    }
    announcementCache.set(cacheKey, {
      announcements: resolved,
      expiresAt: Date.now() + ANNOUNCEMENT_CACHE_TTL_MS,
    });

    return resolved;
  })().finally(() => {
    inFlightLookups.delete(cacheKey);
  });

  inFlightLookups.set(cacheKey, lookupPromise);
  return lookupPromise;
}

/**
 * Consulta uma única vez por ativo para todo o lote de usuários no processamento do servidor.
 */
export async function fetchVerifiedAnnouncementsBatch(
  tickers: string[],
  options: {
    referenceDateIso?: string;
    fetchImpl?: typeof fetch;
    bypassCache?: boolean;
  } = {}
): Promise<Record<string, VerifiedDividendAnnouncement[]>> {
  const uniqueTickers = Array.from(
    new Set(tickers.map((t) => normalizeB3Ticker(t)).filter((t) => /^[A-Z]{4}\d{1,2}B?$/.test(t)))
  );

  const results = await Promise.all(
    uniqueTickers.map(async (ticker) => ({
      ticker,
      announcement: await fetchVerifiedAnnouncementForTicker(ticker, options),
    }))
  );

  const map: Record<string, VerifiedDividendAnnouncement[]> = {};
  for (const item of results) {
    map[item.ticker] = item.announcement;
  }
  return map;
}
