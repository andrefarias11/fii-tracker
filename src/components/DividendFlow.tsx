'use client';

import { useState } from 'react';
import {
  Coins,
  CheckCircle2,
  Clock,
  HelpCircle,
  Calendar,
} from 'lucide-react';
import { FiiPosition, Transaction, BcbIndicators } from '../types/portfolio';
import { calculateMonthDividends } from '../data/fiiDividendCalendar';
import { DividendStatus } from '../types/dividend';
import { PerformanceComparisonChart } from './PerformanceComparisonChart';

interface DividendFlowProps {
  positions: FiiPosition[];
  transactions?: Transaction[];
  bcbIndicators?: BcbIndicators | null;
  monthlyContributionGoal?: number;
  isPrivacyMode?: boolean;
}

export function DividendFlow({
  positions,
  transactions = [],
  bcbIndicators = null,
  monthlyContributionGoal = 200,
  isPrivacyMode = false,
}: DividendFlowProps) {
  const [filterStatus, setFilterStatus] = useState<'ALL' | DividendStatus>('ALL');

  const currentDate = new Date();
  const yearMonthKey = `fii_tracker_div_status_${currentDate.getFullYear()}_${currentDate.getMonth() + 1}`;

  const [statusOverrides, setStatusOverrides] = useState<Record<string, DividendStatus>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(yearMonthKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ •••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const currentMonthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  const { events, summary } = calculateMonthDividends(positions, currentDate, statusOverrides);

  const handleToggleStatus = (ticker: string, current: DividendStatus) => {
    const order: DividendStatus[] = ['ESTIMATED', 'CONFIRMED', 'PAID'];
    const nextIndex = (order.indexOf(current) + 1) % order.length;
    const nextStatus = order[nextIndex];
    const updated = { ...statusOverrides, [ticker]: nextStatus };
    setStatusOverrides(updated);
    try {
      localStorage.setItem(yearMonthKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filterStatus === 'ALL') return true;
    return ev.status === filterStatus;
  });

  if (positions.length === 0) {
    return (
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-8 text-center">
        <Coins className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
        <h3 className="text-sm font-bold text-white mb-1">Nenhum dividendo previsto ainda</h3>
        <p className="text-xs text-zinc-400">
          Quando você registrar seus primeiros FIIs, o fluxo de proventos aparecerá aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. CARD PRINCIPAL: RESUMO DE PROVENTOS DO MÊS */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800/80 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <Coins className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Proventos • {capitalizedMonth}</h2>
              <p className="text-[11px] text-zinc-400">Fluxo de dividendos isentos de IR</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Total: {formatBRL(summary.totalExpected)}
          </span>
        </div>

        {/* 3 COLUNAS VISUAIS DE STATUS */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div
            onClick={() => setFilterStatus(filterStatus === 'PAID' ? 'ALL' : 'PAID')}
            className={`cursor-pointer p-3 rounded-2xl border transition-all text-left ${
              filterStatus === 'PAID'
                ? 'bg-emerald-500/20 border-emerald-500/50 ring-1 ring-emerald-500/50'
                : 'bg-emerald-950/20 border-emerald-800/30 hover:border-emerald-700/50'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 mb-0.5">
              <CheckCircle2 className="w-3 h-3" />
              Recebido
            </div>
            <div className="text-sm font-extrabold text-white">{formatBRL(summary.totalReceived)}</div>
            <div className="text-[9px] text-zinc-400 mt-0.5">
              {summary.receivedCount} {summary.receivedCount === 1 ? 'fundo pago' : 'fundos pagos'}
            </div>
          </div>

          <div
            onClick={() => setFilterStatus(filterStatus === 'CONFIRMED' ? 'ALL' : 'CONFIRMED')}
            className={`cursor-pointer p-3 rounded-2xl border transition-all text-left ${
              filterStatus === 'CONFIRMED'
                ? 'bg-amber-500/20 border-amber-500/50 ring-1 ring-amber-500/50'
                : 'bg-amber-950/20 border-amber-800/30 hover:border-amber-700/50'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 mb-0.5">
              <Clock className="w-3 h-3" />
              Confirmado
            </div>
            <div className="text-sm font-extrabold text-white">{formatBRL(summary.totalConfirmed)}</div>
            <div className="text-[9px] text-zinc-400 mt-0.5">
              {summary.confirmedCount} a receber
            </div>
          </div>

          <div
            onClick={() => setFilterStatus(filterStatus === 'ESTIMATED' ? 'ALL' : 'ESTIMATED')}
            className={`cursor-pointer p-3 rounded-2xl border transition-all text-left ${
              filterStatus === 'ESTIMATED'
                ? 'bg-sky-500/20 border-sky-500/50 ring-1 ring-sky-500/50'
                : 'bg-sky-950/20 border-sky-800/30 hover:border-sky-700/50'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-400 mb-0.5">
              <HelpCircle className="w-3 h-3" />
              Estimado
            </div>
            <div className="text-sm font-extrabold text-white">{formatBRL(summary.totalEstimated)}</div>
            <div className="text-[9px] text-zinc-400 mt-0.5">
              {summary.estimatedCount} a anunciar
            </div>
          </div>
        </div>
      </div>

      {/* 2. LISTAGEM DOS DIVIDENDOS POR FUNDO */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Calendário de Pagamentos</h3>
          </div>
          {filterStatus !== 'ALL' && (
            <button
              onClick={() => setFilterStatus('ALL')}
              className="text-[11px] text-emerald-400 font-semibold"
            >
              Ver todos ({events.length})
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {filteredEvents.map((ev) => {
            const isPaid = ev.status === 'PAID';
            const isConfirmed = ev.status === 'CONFIRMED';
            const isEstimated = ev.status === 'ESTIMATED';
            const isSyncedFromMarket =
              ev.dividendSource === 'B3_OFICIAL' || ev.dividendSource === 'MERCADO';

            return (
              <div
                key={ev.id}
                className="rounded-2xl bg-zinc-900 border border-zinc-800/80 p-3.5 shadow-sm hover:border-zinc-700 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-sm text-white">{ev.ticker}</span>
                      {isSyncedFromMarket && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          B3 Auto
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400">
                        {ev.shares} {ev.shares === 1 ? 'cota' : 'cotas'} • {formatBRL(ev.dividendPerShare)}/cota
                      </span>
                    </div>
                    {ev.announcementDate && (
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        Data-Com: <span className="text-zinc-300 font-medium">{ev.announcementDate}</span>
                        <span className="mx-1.5">•</span>
                        Pagamento: <span className="text-zinc-300 font-medium">{ev.paymentDateFormatted}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold text-emerald-400">
                      {formatBRL(ev.totalValue)}
                    </span>
                  </div>
                </div>

                {/* Badge e Data de Pagamento */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                  <div className="flex items-center gap-1.5">
                    {isPaid && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Pago dia {ev.paymentDay}
                      </span>
                    )}

                    {isConfirmed && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        <Clock className="w-3 h-3" />
                        Confirmado: Cai dia {ev.paymentDay}
                      </span>
                    )}

                    {isEstimated && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                        <HelpCircle className="w-3 h-3" />
                        Previsto dia {ev.paymentDay}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(ev.ticker, ev.status)}
                    className="text-[10px] text-zinc-400 hover:text-white bg-zinc-800/80 px-2 py-1 rounded-lg transition-all active:scale-95"
                    title="Alternar manualmente caso queira sobrescrever o status automático"
                  >
                    {statusOverrides[ev.ticker] ? 'Manual (Alterar)' : 'Status Auto'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. GRÁFICO DE LINHAS COMPARATIVO (SUA CARTEIRA FII vs CDI vs POUPANÇA vs IPCA) */}
      <PerformanceComparisonChart
        positions={positions}
        transactions={transactions}
        monthlyContribution={monthlyContributionGoal}
        bcbIndicators={bcbIndicators}
        isPrivacyMode={isPrivacyMode}
      />
    </div>
  );
}


