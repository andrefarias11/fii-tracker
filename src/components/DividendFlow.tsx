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

  const currentDate =
    typeof window !== 'undefined' ? new Date() : new Date('2026-10-12T12:00:00Z');
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
      {/* Seletor Segmentado 3-em-1 Estilo XP Investimentos */}
      <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#1c1c1e] border border-white/[0.04] gap-1">
        <button
          type="button"
          onClick={() => setSubView('calendar')}
          className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
            subView === 'calendar'
              ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
          <span>Calendário</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('staircase')}
          className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
            subView === 'staircase'
              ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
          <span>Evolução</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('chart')}
          className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
            subView === 'chart'
              ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
          <span>vs CDI</span>
        </button>
      </div>

      {subView === 'calendar' ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* HERO CARD DE PROVENTOS */}
          <div className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400 font-medium truncate">
                Proventos • {capitalizedMonth}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800] border border-[#f5b800]/30 shrink-0">
                Isento de IR
              </span>
            </div>

            <div className="text-[28px] sm:text-[32px] font-extrabold text-white tracking-tight mb-2 truncate tabular-nums">
              {formatBRL(summary.totalExpected)}
            </div>

            {/* 3 Colunas Limpas Separadas por Divisória */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.06] pt-4 mt-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'PAID' ? 'ALL' : 'PAID')}
                className={`pr-2 text-left transition-all cursor-pointer ${
                  filterStatus === 'PAID' ? 'opacity-100' : 'opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 mb-0.5 whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Pago</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-white tabular-nums truncate">
                  {formatBRL(summary.totalReceived)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'CONFIRMED' ? 'ALL' : 'CONFIRMED')}
                className={`px-2 text-left transition-all cursor-pointer ${
                  filterStatus === 'CONFIRMED' ? 'opacity-100' : 'opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 mb-0.5 whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Confirmado</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-white tabular-nums truncate">
                  {formatBRL(summary.totalConfirmed)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'ESTIMATED' ? 'ALL' : 'ESTIMATED')}
                className={`pl-2 text-left transition-all cursor-pointer ${
                  filterStatus === 'ESTIMATED' ? 'opacity-100' : 'opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-sky-400 mb-0.5 whitespace-nowrap">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Previsto</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-white tabular-nums truncate">
                  {formatBRL(summary.totalEstimated)}
                </div>
              </button>
            </div>
          </div>

          {/* LISTA UNIFICADA ESTILO XP */}
          <div className="space-y-2">
            {filterStatus !== 'ALL' && (
              <div className="flex justify-end px-1">
                <button
                  onClick={() => setFilterStatus('ALL')}
                  className="text-xs text-[#f5b800] font-semibold"
                >
                  Mostrar todos ({events.length})
                </button>
              </div>
            )}

            <div className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] divide-y divide-white/[0.06] overflow-hidden">
              {filteredEvents.map((ev) => {
                const isPaid = ev.status === 'PAID';
                const isConfirmed = ev.status === 'CONFIRMED';

                return (
                  <div
                    key={ev.id}
                    onClick={() => handleToggleStatus(ev.ticker, ev.status)}
                    className="p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                          isPaid
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : isConfirmed
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-white/[0.05] text-zinc-400'
                        }`}
                      >
                        <span className="text-[8px] uppercase font-bold leading-none">Dia</span>
                        <span className="text-xs font-bold leading-tight tabular-nums">{ev.paymentDay}</span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white whitespace-nowrap">{ev.ticker}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
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

                        <div className="text-[11px] text-zinc-500 mt-0.5 truncate tabular-nums">
                          {ev.shares} {ev.shares === 1 ? 'cota' : 'cotas'} × {formatBRL(ev.dividendPerShare)}
                          {ev.announcementDate ? ` • Com ${ev.announcementDate.slice(0, 5)}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                        +{formatBRL(ev.totalValue)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
