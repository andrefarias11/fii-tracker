'use client';

import { useState } from 'react';
import {
  Coins,
  CheckCircle2,
  Clock,
  HelpCircle,
  Calendar,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { FiiPosition, Transaction, BcbIndicators } from '../types/portfolio';
import { calculateMonthDividends } from '../data/fiiDividendCalendar';
import { DividendStatus } from '../types/dividend';
import { PerformanceComparisonChart } from './PerformanceComparisonChart';
import { DividendStaircaseChart } from './DividendStaircaseChart';

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
  const [subView, setSubView] = useState<'calendar' | 'staircase' | 'chart'>('calendar');
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
      <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-8 text-center">
        <Coins className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
        <h3 className="text-sm font-bold text-white mb-1">Nenhum dividendo previsto ainda</h3>
        <p className="text-xs text-zinc-500">
          Quando você registrar seus primeiros FIIs ou Ações, o fluxo de proventos aparecerá aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seletor Segmentado 3-em-1 Estilo Apple iOS */}
      <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#121215] border border-white/[0.06]">
        <button
          type="button"
          onClick={() => setSubView('calendar')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            subView === 'calendar'
              ? 'bg-white/[0.1] text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          Calendário
        </button>

        <button
          type="button"
          onClick={() => setSubView('staircase')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            subView === 'staircase'
              ? 'bg-white/[0.1] text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
          Escadinha
        </button>

        <button
          type="button"
          onClick={() => setSubView('chart')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            subView === 'chart'
              ? 'bg-white/[0.1] text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          vs CDI
        </button>
      </div>

      {subView === 'calendar' ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* HERO CARD DE PROVENTOS ESTILO NUBANK */}
          <div className="rounded-[28px] bg-[#121215] border border-white/[0.07] p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400 font-medium">
                Proventos • {capitalizedMonth}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                Isento de IR
              </span>
            </div>

            <div className="text-[32px] font-extrabold text-white tracking-tight mb-4">
              {formatBRL(summary.totalExpected)}
            </div>

            {/* 3 Pílulas de Status Limpas */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'PAID' ? 'ALL' : 'PAID')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  filterStatus === 'PAID'
                    ? 'bg-emerald-500/15 border-emerald-500/40'
                    : 'bg-white/[0.03] border-white/[0.05] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 mb-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Pago
                </div>
                <div className="text-sm font-bold text-white">{formatBRL(summary.totalReceived)}</div>
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'CONFIRMED' ? 'ALL' : 'CONFIRMED')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  filterStatus === 'CONFIRMED'
                    ? 'bg-amber-500/15 border-amber-500/40'
                    : 'bg-white/[0.03] border-white/[0.05] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-amber-400 mb-0.5">
                  <Clock className="w-3 h-3" />
                  Confirmado
                </div>
                <div className="text-sm font-bold text-white">{formatBRL(summary.totalConfirmed)}</div>
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'ESTIMATED' ? 'ALL' : 'ESTIMATED')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  filterStatus === 'ESTIMATED'
                    ? 'bg-sky-500/15 border-sky-500/40'
                    : 'bg-white/[0.03] border-white/[0.05] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-sky-400 mb-0.5">
                  <HelpCircle className="w-3 h-3" />
                  Previsto
                </div>
                <div className="text-sm font-bold text-white">{formatBRL(summary.totalEstimated)}</div>
              </button>
            </div>
          </div>

          {/* LISTA MINIMALISTA DE PAGAMENTOS */}
          <div className="space-y-2">
            {filterStatus !== 'ALL' && (
              <div className="flex justify-end px-1">
                <button
                  onClick={() => setFilterStatus('ALL')}
                  className="text-xs text-emerald-400 font-semibold"
                >
                  Mostrar todos ({events.length})
                </button>
              </div>
            )}

            {filteredEvents.map((ev) => {
              const isPaid = ev.status === 'PAID';
              const isConfirmed = ev.status === 'CONFIRMED';

              return (
                <div
                  key={ev.id}
                  onClick={() => handleToggleStatus(ev.ticker, ev.status)}
                  className="rounded-[22px] bg-[#121215] border border-white/[0.06] hover:border-white/[0.12] p-4 flex items-center justify-between gap-3 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
                        isPaid
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : isConfirmed
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-white/[0.05] text-zinc-400'
                      }`}
                    >
                      <span className="text-[9px] uppercase font-bold leading-none">Dia</span>
                      <span className="text-xs font-extrabold leading-tight">{ev.paymentDay}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{ev.ticker}</span>
                        <span
                          className={`text-[9px] font-semibold px-2 py-0.2 rounded-full ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : isConfirmed
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-white/[0.06] text-zinc-400'
                          }`}
                        >
                          {isPaid ? 'Pago' : isConfirmed ? 'Confirmado' : 'Previsto'}
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                        {ev.shares} {ev.shares === 1 ? 'cota' : 'cotas'} × {formatBRL(ev.dividendPerShare)}
                        {ev.announcementDate ? ` • Data-Com ${ev.announcementDate.slice(0, 5)}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-emerald-400">
                      +{formatBRL(ev.totalValue)}
                    </div>
                    <span className="text-[9px] text-zinc-600">Toque p/ status</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : subView === 'staircase' ? (
        <div className="animate-in fade-in duration-150">
          <DividendStaircaseChart
            positions={positions}
            transactions={transactions}
            isPrivacyMode={isPrivacyMode}
          />
        </div>
      ) : (
        <div className="animate-in fade-in duration-150">
          <PerformanceComparisonChart
            positions={positions}
            transactions={transactions}
            monthlyContribution={monthlyContributionGoal}
            bcbIndicators={bcbIndicators}
            isPrivacyMode={isPrivacyMode}
          />
        </div>
      )}
    </div>
  );
}
