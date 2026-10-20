import { DividendEvent, MonthProventosSummary, DividendStatus } from '../types/dividend';
import { FiiPosition, Transaction } from '../types/portfolio';
import { findFiiInfo } from './fiiDatabase';
import { normalizeTransactionForSplit } from '../domain/portfolioEngine';
import { normalizeB3Ticker } from '../lib/ticker';

export function getFiiSchedule(ticker: string) {
  const info = findFiiInfo(ticker);
  return { announcementDay: info.announcementDay ?? 1, paymentDay: info.paymentDay ?? 15, announcedAmount: info.estimatedMonthlyDividend };
}
function isoDate(value?: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

/** Parses supported B3 date formats as a local calendar date (without UTC drift). */
export function parseDividendCalendarDate(value?: string): Date | null {
  const normalized = isoDate(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function getDividendEventDates(event: DividendEvent, monthDate: Date) {
  const parsedPayment = parseDividendCalendarDate(event.paymentDateFormatted);
  const paymentDate = parsedPayment ?? new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    Math.min(event.paymentDay, new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate())
  );

  // Data-Com somente é exibida como data do evento quando existe anúncio confirmado.
  const announcementDate = event.status === 'CONFIRMED'
    ? parseDividendCalendarDate(event.announcementDate)
    : null;

  return { paymentDate, announcementDate };
}

export function formatDividendCalendarDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...options,
    timeZone: 'America/Sao_Paulo',
  }).replace('.', '');
}
export function calculateMonthDividends(
  positions: FiiPosition[], currentDate = new Date(),
  _legacyOverrides: Record<string, DividendStatus> = {}, transactions: Transaction[] = []
): { events: DividendEvent[]; summary: MonthProventosSummary } {
  void _legacyOverrides; // Old callers cannot override ledger receipt status.
  const today = currentDate.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const month = today.slice(0, 7);
  const events: DividendEvent[] = [];
  const receipts = new Map<string, { amount: number; date: string }>();
  for (const tx of transactions) {
    if (tx.type !== 'DIVIDEND' || tx.date.slice(0, 7) !== month || tx.date > today) continue;
    const ticker = normalizeB3Ticker(tx.ticker);
    const old = receipts.get(ticker);
    receipts.set(ticker, { amount: (old?.amount || 0) + Math.abs(tx.total), date: tx.date });
  }
  for (const [ticker, receipt] of receipts) {
    events.push({ id: `receipt-${ticker}-${month}`, ticker, shares: 0, dividendPerShare: 0,
      totalValue: Number(receipt.amount.toFixed(2)), status: 'PAID', paymentDay: Number(receipt.date.slice(8)),
      paymentDateFormatted: receipt.date.split('-').reverse().join('/'), isOfficial: true, dividendSource: 'B3_OFICIAL' });
  }
  for (const pos of positions) {
    if (receipts.has(pos.ticker)) continue;
    const payment = isoDate(pos.dividendPaymentDate);
    const cutoff = isoDate(pos.dividendExDate);
    const announced = Boolean(pos.isCurrentMonthAnnounced && payment.startsWith(month) && cutoff && transactions.length && (pos.assetClass !== 'ACAO' || pos.announcedDividendPerShare !== undefined));
    let shares = pos.totalShares;
    if (announced) {
      shares = 0;
      for (const tx of [...transactions].sort((a,b) => a.date.localeCompare(b.date))) {
        if (tx.type === 'DIVIDEND' || normalizeB3Ticker(tx.ticker) !== pos.ticker || tx.date > cutoff) continue;
        const n = normalizeTransactionForSplit(tx, cutoff);
        shares = Math.max(0, shares + (tx.type === 'SELL' ? -n.shares : n.shares));
      }
    }
    if (shares <= 0) continue;
    const schedule = getFiiSchedule(pos.ticker);
    const paymentDay = announced ? Number(payment.slice(8)) : schedule.paymentDay;
    const amountPerShare = announced ? (pos.announcedDividendPerShare ?? pos.monthlyDividendPerShare) : pos.monthlyDividendPerShare;
    events.push({ id: `expected-${pos.ticker}-${month}`, ticker: pos.ticker, shares,
      dividendPerShare: amountPerShare, totalValue: Number((shares * amountPerShare).toFixed(2)),
      status: announced && pos.dividendSource !== 'MANUAL' ? 'CONFIRMED' : 'ESTIMATED',
      paymentDay, paymentDateFormatted: announced ? payment.split('-').reverse().join('/') : `${String(paymentDay).padStart(2,'0')}/${month.slice(5)}/${month.slice(0,4)}`,
      announcementDate: pos.dividendExDate, isOfficial: announced && pos.dividendSource === 'B3_OFICIAL', dividendSource: pos.dividendSource });
  }
  events.sort((a,b) => a.paymentDay - b.paymentDay);
  const total = (status: DividendStatus) => Number(events.filter(e => e.status === status).reduce((sum,e) => sum + e.totalValue, 0).toFixed(2));
  const totalReceived = total('PAID'), totalConfirmed = total('CONFIRMED'), totalEstimated = total('ESTIMATED');
  return { events, summary: { totalReceived, totalConfirmed, totalEstimated,
    totalExpected: Number((totalReceived + totalConfirmed + totalEstimated).toFixed(2)),
    receivedCount: events.filter(e => e.status === 'PAID').length,
    confirmedCount: events.filter(e => e.status === 'CONFIRMED').length,
    estimatedCount: events.filter(e => e.status === 'ESTIMATED').length } };
}

/**
 * Returns confirmed announcements independently of the calendar's receipt
 * presentation. This lets reconciliation keep the announced cycle visible
 * after an imported dividend receipt replaces that ticker in the summary.
 */
export function calculateConfirmedDividendAnnouncements(
  positions: FiiPosition[], currentDate = new Date(), transactions: Transaction[] = []
): DividendEvent[] {
  const month = currentDate.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
  const events: DividendEvent[] = [];

  for (const pos of positions) {
    const payment = isoDate(pos.dividendPaymentDate);
    const cutoff = isoDate(pos.dividendExDate);
    const announced = Boolean(
      pos.isCurrentMonthAnnounced && payment.startsWith(month) && cutoff && transactions.length &&
      (pos.assetClass !== 'ACAO' || pos.announcedDividendPerShare !== undefined)
    );
    if (!announced || pos.dividendSource === 'MANUAL') continue;

    let shares = 0;
    for (const tx of [...transactions].sort((a, b) => a.date.localeCompare(b.date))) {
      if (tx.type === 'DIVIDEND' || normalizeB3Ticker(tx.ticker) !== normalizeB3Ticker(pos.ticker) || tx.date > cutoff) continue;
      const normalized = normalizeTransactionForSplit(tx, cutoff);
      shares = Math.max(0, shares + (tx.type === 'SELL' ? -normalized.shares : normalized.shares));
    }
    if (shares <= 0) continue;

    const amountPerShare = pos.announcedDividendPerShare ?? pos.monthlyDividendPerShare;
    events.push({
      id: `announcement-${normalizeB3Ticker(pos.ticker)}-${month}`,
      ticker: pos.ticker,
      shares,
      dividendPerShare: amountPerShare,
      totalValue: Number((shares * amountPerShare).toFixed(2)),
      status: 'CONFIRMED',
      paymentDay: Number(payment.slice(8)),
      paymentDateFormatted: payment.split('-').reverse().join('/'),
      announcementDate: pos.dividendExDate,
      isOfficial: pos.dividendSource === 'B3_OFICIAL',
      dividendSource: pos.dividendSource,
    });
  }

  return events;
}
