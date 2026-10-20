import { createHash } from 'node:crypto';
import type { CandidateAlertEvent, ServerPushPreferences } from './serverPushEngine';

const BCB_FEEDS = [
  'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/comunicadoscopom',
  'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/atascopom',
  'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/focus',
];
const MATERIAL_NEWS = /default|inadimpl|vac[aâ]ncia|desocupa|ren[uú]ncia|troca de gestor|liquida[cç][aã]o|recupera[cç][aã]o judicial|emiss[aã]o|dilui[cç][aã]o|aquisi[cç][aã]o|venda de im[oó]vel|inc[eê]ndio|processo|cvm|fato relevante|resultado|fraude/i;
const MACRO_MATERIAL = /copom|selic|ata do copom|infla[cç][aã]o|ipca|igpm|focus/i;

function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function parseItems(xml: string): Array<{ title: string; link: string; published: string }> {
  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi)).map(([raw]) => {
    const field = (name: string) => decodeXml(raw.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '');
    const link = field('link') || decodeXml(raw.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || '');
    return { title: field('title'), link, published: field('pubDate') || field('published') || field('updated') };
  }).filter((item) => item.title && item.link);
}

function eventId(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function makeEvent(input: {
  ticker: string; type: CandidateAlertEvent['eventType']; source: CandidateAlertEvent['source'];
  reference: string; date: string; headline: string; url?: string;
}): CandidateAlertEvent {
  return {
    ticker: input.ticker, eventType: input.type, eventReference: input.reference,
    dataVersion: eventId(input.headline), source: input.source, sourceEventDate: input.date,
    headline: input.headline, eventUrl: input.url, priority: 75,
    amountPerShare: 0, exDate: input.date, exDateBr: new Date(`${input.date}T12:00:00Z`).toLocaleDateString('pt-BR'),
    paymentDate: input.date, paymentDateBr: new Date(`${input.date}T12:00:00Z`).toLocaleDateString('pt-BR'),
    eligibleShares: 0, personalTotalAmount: 0,
  };
}

async function fetchFeed(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(3500), headers: { 'User-Agent': 'FII-Tracker/5.1 (+push alerts)' }, cache: 'no-store' });
  if (!response.ok) return '';
  return response.text();
}

async function fetchFiiNews(tickers: string[], now: Date): Promise<CandidateAlertEvent[]> {
  const cutoff = now.getTime() - 36 * 60 * 60 * 1000;
  const batches = await Promise.all(tickers.map(async (ticker) => {
    try {
      const query = encodeURIComponent(`"${ticker}" FII (inadimplência OR vacância OR emissão OR gestor OR imóvel OR CVM OR fato relevante)`);
      const xml = await fetchFeed(`https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`);
      return parseItems(xml).filter((item) => {
        const date = new Date(item.published).getTime();
        return item.title.toUpperCase().includes(ticker) && MATERIAL_NEWS.test(item.title) && Number.isFinite(date) && date >= cutoff && date <= now.getTime() + 5 * 60_000;
      }).slice(0, 1).map((item) => makeEvent({ ticker, type: 'FII_NEWS', source: 'GOOGLE_NEWS', reference: item.link, date: new Date(item.published).toISOString().slice(0, 10), headline: item.title.slice(0, 150), url: item.link }));
    } catch { return []; }
  }));
  return batches.flat();
}

async function fetchMacroNews(now: Date): Promise<CandidateAlertEvent[]> {
  const items = await Promise.all(BCB_FEEDS.map(async (url) => {
    try { return parseItems(await fetchFeed(url)); } catch { return []; }
  }));
  const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
  const unique = new Map<string, CandidateAlertEvent>();
  for (const item of items.flat()) {
    const publishedAt = new Date(item.published);
    if (!Number.isFinite(publishedAt.getTime()) || publishedAt.getTime() < cutoff || publishedAt.getTime() > now.getTime() + 5 * 60_000 || !MACRO_MATERIAL.test(item.title)) continue;
    unique.set(item.link, makeEvent({ ticker: 'MACRO', type: 'MACRO_NEWS', source: 'BANCO_CENTRAL', reference: item.link, date: publishedAt.toISOString().slice(0, 10), headline: item.title.slice(0, 150), url: item.link }));
  }
  return Array.from(unique.values()).slice(0, 2);
}

function brazilDate(date: Date): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function brazilMinute(date: Date): number { const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date); return Number(parts.find((part) => part.type === 'hour')?.value || 0) * 60 + Number(parts.find((part) => part.type === 'minute')?.value || 0); }
function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, easterMonth - 1, easterDay));
}
function isMarketHoliday(date: string): boolean {
  const year = Number(date.slice(0, 4));
  const fixed = new Set([
    `${year}-01-01`, `${year}-04-21`, `${year}-05-01`, `${year}-09-07`,
    `${year}-10-12`, `${year}-11-02`, `${year}-11-15`, `${year}-11-20`,
    `${year}-12-24`, `${year}-12-25`, `${year}-12-31`,
  ]);
  // Easter computus for the movable B3 closures (Carnival, Good Friday, Corpus Christi).
  const easter = easterDate(year);
  const offsetDate = (offset: number) => new Date(easter.getTime() + offset * 86400000).toISOString().slice(0, 10);
  if (date === offsetDate(-2) || date === offsetDate(60)) return true;
  // B3's 2026 calendar includes Monday/Tuesday Carnival and Ash Wednesday has a delayed opening.
  if (date === offsetDate(-48) || date === offsetDate(-47)) return true;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6 || fixed.has(date);
}

export function getMarketSessionEvents(now: Date): CandidateAlertEvent[] {
  const date = brazilDate(now);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6 || isMarketHoliday(date)) return [];
  const minute = brazilMinute(now);
  const closeMinute = date >= '2026-11-03' ? 18 * 60 : 17 * 60;
  const easter = easterDate(Number(date.slice(0, 4)));
  const ashWednesday = new Date(easter.getTime() - 46 * 86400000).toISOString().slice(0, 10);
  const openMinute = date === ashWednesday ? 13 * 60 : 10 * 60;
  const sessionEvents: CandidateAlertEvent[] = [];
  if (minute >= openMinute && minute < openMinute + 30) sessionEvents.push(makeEvent({ ticker: 'B3', type: 'MARKET_OPEN', source: 'B3', reference: `open:${date}`, date, headline: `A sessão regular da B3 começou às ${openMinute / 60}h.` }));
  if (minute >= closeMinute && minute < closeMinute + 30) sessionEvents.push(makeEvent({ ticker: 'B3', type: 'MARKET_CLOSE', source: 'B3', reference: `close:${date}`, date, headline: `O pregão regular da B3 encerrou às ${closeMinute / 60}h.` }));
  return sessionEvents;
}

export async function fetchRelevantPushNews(tickers: string[], now: Date): Promise<CandidateAlertEvent[]> {
  const [fii, macro] = await Promise.all([fetchFiiNews(tickers, now), fetchMacroNews(now)]);
  return [...fii, ...macro, ...getMarketSessionEvents(now)];
}

export function filterPushNewsForUser(events: CandidateAlertEvent[], prefs: ServerPushPreferences, tickers: string[]): CandidateAlertEvent[] {
  return events.filter((event) => event.eventType === 'FII_NEWS'
    ? prefs.notifyImportantNews !== false && tickers.includes(event.ticker)
    : event.eventType === 'MACRO_NEWS' ? prefs.notifyMacroNews !== false
      : prefs.notifyMarketSession !== false);
}

