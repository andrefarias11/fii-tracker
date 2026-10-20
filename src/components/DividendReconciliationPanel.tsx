'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Clock3 } from 'lucide-react';
import type { DividendEvent } from '../types/dividend';
import type { FiiPosition, Transaction } from '../types/portfolio';
import { parseDividendCalendarDate } from '../data/fiiDividendCalendar';
import { normalizeB3Ticker } from '../lib/ticker';
import { formatCurrency } from '../lib/formatFinancial';

type ReconciliationStatus = 'received' | 'pending' | 'divergent' | 'review';

interface ReconciliationRow {
  id: string;
  ticker: string;
  exDate: Date | null;
  paymentDate: Date | null;
  expectedAmount: number | null;
  receivedAmount: number | null;
  status: ReconciliationStatus;
  explanation: string;
}

interface DividendReconciliationPanelProps {
  positions: FiiPosition[];
  transactions: Transaction[];
  confirmedEvents: DividendEvent[];
  month: string;
  isPrivacyMode?: boolean;
}

const toIsoCalendarDate = (value?: string) => {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
};

const formatDate = (date: Date | null) =>
  date?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '') || 'Data indisponível';

function statusPresentation(status: ReconciliationStatus) {
  switch (status) {
    case 'received':
      return { label: 'Recebido', icon: CheckCircle2, className: 'text-emerald-300 bg-emerald-400/10' };
    case 'pending':
      return { label: 'Pendente', icon: Clock3, className: 'text-amber-300 bg-amber-400/10' };
    case 'divergent':
      return { label: 'Divergente', icon: AlertTriangle, className: 'text-rose-300 bg-rose-400/10' };
    default:
      return { label: 'Conferir', icon: CircleHelp, className: 'text-zinc-300 bg-white/[0.06]' };
  }
}

/**
 * Reconciles only a confirmed announcement with a receipt on the exact announced
 * payment date. Receipt dates alone do not identify an announcement cycle safely.
 */
export function DividendReconciliationPanel({
  positions,
  transactions,
  confirmedEvents,
  month,
  isPrivacyMode = false,
}: DividendReconciliationPanelProps) {
  const rows = useMemo(() => {
    const monthReceipts = transactions.filter((transaction) =>
      transaction.type === 'DIVIDEND' && transaction.date.startsWith(month)
    );
    const positionsByTicker = new Map(
      positions.map((position) => [normalizeB3Ticker(position.ticker), position])
    );
    const eligibleAnnouncements = confirmedEvents.filter((event) =>
      event.status === 'CONFIRMED' && positionsByTicker.has(normalizeB3Ticker(event.ticker))
    );
    const cyclesPerTickerPayment = new Map<string, number>();
    for (const event of eligibleAnnouncements) {
      const ticker = normalizeB3Ticker(event.ticker);
      const paymentKey = toIsoCalendarDate(event.paymentDateFormatted) || 'unknown';
      const key = `${ticker}|${paymentKey}`;
      cyclesPerTickerPayment.set(key, (cyclesPerTickerPayment.get(key) || 0) + 1);
    }

    const reconciledReceiptIds = new Set<string>();
    const result: ReconciliationRow[] = eligibleAnnouncements.map((event) => {
      const ticker = normalizeB3Ticker(event.ticker);
      const exDate = parseDividendCalendarDate(event.announcementDate);
      const paymentDate = parseDividendCalendarDate(event.paymentDateFormatted);
      const cycleKey = `${ticker}|${toIsoCalendarDate(event.paymentDateFormatted) || 'unknown'}`;
      const exactCycleIsUnique = (cyclesPerTickerPayment.get(cycleKey) || 0) === 1;

      if (!exDate || !paymentDate || !exactCycleIsUnique) {
        return {
          id: `${ticker}|${cycleKey}|${event.id}`,
          ticker,
          exDate,
          paymentDate,
          expectedAmount: event.totalValue,
          receivedAmount: null,
          status: 'review',
          explanation: 'O anúncio não identifica Data-Com e pagamento como um ciclo único.',
        };
      }

      const paymentIso = toIsoCalendarDate(event.paymentDateFormatted);
      if (!paymentIso) {
        return {
          id: `${ticker}|${cycleKey}|${event.id}`,
          ticker,
          exDate,
          paymentDate,
          expectedAmount: event.totalValue,
          receivedAmount: null,
          status: 'review',
          explanation: 'A data de pagamento não está em um formato reconhecido.',
        };
      }
      const exactReceipts = monthReceipts.filter((transaction) =>
        normalizeB3Ticker(transaction.ticker) === ticker && transaction.date === paymentIso
      );
      const otherTickerReceipts = monthReceipts.filter((transaction) =>
        normalizeB3Ticker(transaction.ticker) === ticker && transaction.date !== paymentIso
      );

      if (exactReceipts.length === 0 && otherTickerReceipts.length > 0) {
        return {
          id: `${ticker}|${paymentIso}|${event.id}`,
          ticker,
          exDate,
          paymentDate,
          expectedAmount: event.totalValue,
          receivedAmount: null,
          status: 'review',
          explanation: 'Há recibo do ticker neste mês, mas a data não coincide com a data de pagamento anunciada.',
        };
      }

      if (exactReceipts.length === 0) {
        return {
          id: `${ticker}|${paymentIso}|${event.id}`,
          ticker,
          exDate,
          paymentDate,
          expectedAmount: event.totalValue,
          receivedAmount: null,
          status: 'pending',
          explanation: 'Nenhum recibo foi encontrado na data de pagamento anunciada.',
        };
      }

      exactReceipts.forEach((receipt) => reconciledReceiptIds.add(receipt.id));
      const receivedAmount = exactReceipts.reduce((total, receipt) => total + Math.abs(receipt.total), 0);
      // Allow only a small rounding difference for imported statement amounts.
      const tolerance = 0.02;
      const amountMatches = Math.abs(receivedAmount - event.totalValue) <= tolerance;

      return {
        id: `${ticker}|${paymentIso}|${event.id}`,
        ticker,
        exDate,
        paymentDate,
        expectedAmount: event.totalValue,
        receivedAmount,
        status: amountMatches ? 'received' : 'divergent',
        explanation: amountMatches
          ? 'Recibo encontrado na data anunciada e valor compatível.'
          : 'O recibo encontrado na data anunciada tem valor diferente do provento esperado.',
      };
    });

    // Keep orphan receipts visible as review items instead of assuming they belong to a cycle.
    for (const receipt of monthReceipts) {
      if (reconciledReceiptIds.has(receipt.id)) continue;
      const ticker = normalizeB3Ticker(receipt.ticker);
      const date = parseDividendCalendarDate(receipt.date);
      result.push({
        id: `receipt|${receipt.id}`,
        ticker,
        exDate: null,
        paymentDate: date,
        expectedAmount: null,
        receivedAmount: Math.abs(receipt.total),
        status: 'review',
        explanation: 'Recibo importado sem ciclo confirmado correspondente; confira Data-Com e pagamento.',
      });
    }

    return result.sort((a, b) => {
      const dateDelta = (a.paymentDate?.getTime() || 0) - (b.paymentDate?.getTime() || 0);
      return dateDelta || a.ticker.localeCompare(b.ticker);
    });
  }, [confirmedEvents, month, positions, transactions]);

  const formatAmount = (amount: number | null) =>
    amount === null ? '—' : formatCurrency(amount, isPrivacyMode);

  const statusCounts = rows.reduce<Record<ReconciliationStatus, number>>((counts, row) => {
    counts[row.status] += 1;
    return counts;
  }, { received: 0, pending: 0, divergent: 0, review: 0 });

  return (
    <details className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--surface-card)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-white">Conciliação de proventos</span>
          <span className="mt-0.5 block text-[10px] text-zinc-500">Comunicados confirmados × recibos importados</span>
        </span>
        <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] tabular-nums text-zinc-300">
          {rows.length} {rows.length === 1 ? 'item' : 'itens'}
        </span>
      </summary>

      <div className="border-t border-white/[0.06] px-3.5 py-3">
        <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px]" aria-label="Resumo da conciliação">
          <span className="text-emerald-300">Recebido {statusCounts.received}</span>
          <span className="text-amber-300">Pendente {statusCounts.pending}</span>
          <span className="text-rose-300">Divergente {statusCounts.divergent}</span>
          <span className="text-zinc-400">Conferir {statusCounts.review}</span>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl bg-white/[0.03] px-3 py-3 text-xs leading-relaxed text-zinc-400">
            Ainda não há anúncios confirmados ou recibos do mês para conciliar.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const presentation = statusPresentation(row.status);
              const StatusIcon = presentation.icon;
              return (
                <article key={row.id} className="rounded-xl border border-white/[0.05] bg-[#1C1C1F] px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-xs font-bold text-white">{row.ticker}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${presentation.className}`}>
                        <StatusIcon className="h-3 w-3" />{presentation.label}
                      </span>
                    </div>
                    <span className="text-[10px] tabular-nums text-zinc-400">Pagamento · {formatDate(row.paymentDate)}</span>
                  </div>

                  {row.exDate && (
                    <p className="mt-1 text-[10px] text-zinc-500">Data-Com · {formatDate(row.exDate)}</p>
                  )}
                  <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-400">{row.explanation}</p>

                  {(row.expectedAmount !== null || row.receivedAmount !== null) && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.05] pt-2 text-[10px] tabular-nums">
                      {row.expectedAmount !== null && <span className="text-zinc-400">Esperado <strong className="font-semibold text-zinc-200">{formatAmount(row.expectedAmount)}</strong></span>}
                      {row.receivedAmount !== null && <span className="text-zinc-400">Importado <strong className="font-semibold text-zinc-200">{formatAmount(row.receivedAmount)}</strong></span>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
          A conciliação usa a data do recibo como correspondência com o pagamento anunciado. Itens sem ciclo identificável ficam como “Conferir”.
        </p>
      </div>
    </details>
  );
}
