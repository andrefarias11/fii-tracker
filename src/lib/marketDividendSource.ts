import { findFiiInfo } from '../data/fiiDatabase';
import { normalizeB3Ticker } from './ticker';
import { isValidIsoCalendarDate } from './pushNavigation';

export type VerifiedDividendSourceName = 'STATUS_INVEST' | 'BRAPI' | 'FUNDAMENTUS';

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

export interface VerifiedAnnouncementsBatch {
  announcements: Record<string, VerifiedDividendAnnouncement[]>;
  unavailableTickers: string[];
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

  // Nunca aceita fontes manuais, catálogo estático ou estimativas sem datas e valor completos.
  if (
    input.source !== 'STATUS_INVEST' &&
    input.source !== 'BRAPI' &&
    input.source !== 'FUNDAMENTUS'
  ) {
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
      // Tenta próximo endpoint ou fallback gratuito.
    }
  }

  return { announcements: [], available: false };
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFundamentusAmount(value: string): number | null {
  const amount = Number(value.trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

async function fetchFromFundamentus(
  ticker: string,
  referenceDateIso: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ announcements: VerifiedDividendAnnouncement[]; available: boolean }> {
  try {
    const url = `https://www.fundamentus.com.br/fii_proventos.php?papel=${encodeURIComponent(ticker)}&tipo=2`;
    const res = await fetchImpl(url, {
      headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { announcements: [], available: false };

    const html = await res.text();
    const table = html.match(/<table\b[^>]*\bid=["']resultado["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
    if (!table || !/Data de Pagamento/i.test(decodeHtmlText(table))) {
      return { announcements: [], available: false };
    }

    const rows = Array.from(table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
    const candidates: Array<{ amount: number; exIso: string; payIso: string }> = [];
    for (const [, row] of rows.slice(1)) {
      const cells = Array.from(row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi))
        .map(([, cell]) => decodeHtmlText(cell));
      if (cells.length < 4 || !/^rendimento$/i.test(cells[1])) continue;

      const ex = normalizeBrOrIsoDate(cells[0]);
      const pay = normalizeBrOrIsoDate(cells[2]);
      const amount = parseFundamentusAmount(cells[3]);
      if (!ex || !pay) continue;
      if (!amount) continue;
      if (!isCycleRelevantForReferenceDate(ex.iso, pay.iso, referenceDateIso)) continue;
      candidates.push({ amount, exIso: ex.iso, payIso: pay.iso });
    }

    const announcements = candidates
      .map(({ amount, exIso, payIso }) =>
        buildVerifiedAnnouncement({
          ticker,
          source: 'FUNDAMENTUS',
          amountPerShare: amount,
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
    const fromStatusInvest = await fetchFromStatusInvest(cleanTicker, refDate, fetchImpl);
    const fromFundamentus =
      !fromStatusInvest.available || fromStatusInvest.announcements.length === 0
        ? await fetchFromFundamentus(cleanTicker, refDate, fetchImpl)
        : { announcements: [], available: true };
    if (!fromStatusInvest.available && !fromFundamentus.available) {
      throw new Error(`Fontes de proventos indisponíveis para ${cleanTicker}.`);
    }
    const unique = new Map<string, VerifiedDividendAnnouncement>();
    for (const event of [...fromStatusInvest.announcements, ...fromFundamentus.announcements]) {
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
): Promise<VerifiedAnnouncementsBatch> {
  const uniqueTickers = Array.from(
    new Set(tickers.map((t) => normalizeB3Ticker(t)).filter((t) => /^[A-Z]{4}\d{1,2}B?$/.test(t)))
  );

  const map: Record<string, VerifiedDividendAnnouncement[]> = {};
  const unavailableTickers: string[] = [];
  const concurrency = 20;
  for (let offset = 0; offset < uniqueTickers.length; offset += concurrency) {
    const chunk = uniqueTickers.slice(offset, offset + concurrency);
    const results = await Promise.all(chunk.map(async (ticker) => {
      try {
        return { ticker, announcement: await fetchVerifiedAnnouncementForTicker(ticker, options) };
      } catch {
        return { ticker, announcement: null };
      }
    }));

    for (const result of results) {
      if (result.announcement === null) unavailableTickers.push(result.ticker);
      else map[result.ticker] = result.announcement;
    }
  }
  return { announcements: map, unavailableTickers };
}
