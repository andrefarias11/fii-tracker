'use client';

import { useState } from 'react';
import {
  Coins,
  CheckCircle2,
  Clock,
  HelpCircle,
  Calendar,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { FiiPosition } from '../types/portfolio';
import { calculateMonthDividends } from '../data/fiiDividendCalendar';
import { DividendStatus } from '../types/dividend';

interface DividendFlowProps {
  positions: FiiPosition[];
  monthlyContributionGoal?: number;
}

export function DividendFlow({ positions, monthlyContributionGoal = 200 }: DividendFlowProps) {
  const [filterStatus, setFilterStatus] = useState<'ALL' | DividendStatus>('ALL');
  const [statusOverrides, setStatusOverrides] = useState<Record<string, DividendStatus>>({});

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const currentDate = new Date();
  const currentMonthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  const { events, summary } = calculateMonthDividends(positions, currentDate, statusOverrides);

  const handleToggleStatus = (ticker: string, current: DividendStatus) => {
    const order: DividendStatus[] = ['ESTIMATED', 'CONFIRMED', 'PAID'];
    const nextIndex = (order.indexOf(current) + 1) % order.length;
    const nextStatus = order[nextIndex];
    setStatusOverrides((prev) => ({ ...prev, [ticker]: nextStatus }));
  };

  const filteredEvents = events.filter((ev) => {
    if (filterStatus === 'ALL') return true;
    return ev.status === filterStatus;
  });

  // Simulação de renda futura para os próximos 6 meses considerando o aporte contínuo de R$ 200
  const futureMonthsProjection = [1, 2, 3, 6, 12].map((m) => {
    const yieldRate = 0.009; // 0,90% a.m. (média sólida)
    let projectedEquity = positions.reduce((acc, p) => acc + p.currentTotal, 0);

    for (let i = 1; i <= m; i++) {
      projectedEquity += monthlyContributionGoal;
      projectedEquity += projectedEquity * yieldRate; // Reinvestimento
    }

    const projectedIncome = Number((projectedEquity * yieldRate).toFixed(2));

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + m);
    const monthLabel = futureDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

    return {
      monthsAhead: m,
      monthLabel: monthLabel.toUpperCase(),
      projectedIncome,
      projectedEquity: Number(projectedEquity.toFixed(2)),
    };
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
              <p className="text-[11px] text-zinc-400">Fluxo de dividendos na conta da XP</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Total: {formatBRL(summary.totalExpected)}
          </span>
        </div>

        {/* 3 COLUNAS VISUAIS DE STATUS */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {/* 1. Já Recebido (Verde) */}
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

          {/* 2. Confirmado (Amarelo / Âmbar) */}
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

          {/* 3. Estimado (Azul / Ciano) */}
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

            return (
              <div
                key={ev.id}
                className="rounded-2xl bg-zinc-900 border border-zinc-800/80 p-3.5 shadow-sm hover:border-zinc-700 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white">{ev.ticker}</span>
                      <span className="text-[10px] text-zinc-400">
                        {ev.shares} {ev.shares === 1 ? 'cota' : 'cotas'} • {formatBRL(ev.dividendPerShare)}/cota
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
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
                        Pago na XP no dia {ev.paymentDay}
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
                        Estimado: Previsão dia {ev.paymentDay}
                      </span>
                    )}
                  </div>

                  {/* Botão de Alternar Status Manualmente */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(ev.ticker, ev.status)}
                    className="text-[10px] text-zinc-400 hover:text-white bg-zinc-800/80 px-2 py-1 rounded-lg transition-all active:scale-95"
                    title="Alternar entre Estimado / Confirmado / Pago"
                  >
                    Alternar Status
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. PROJEÇÃO DE RENDA FUTURA (PRÓXIMOS MESES COM R$ 200/MÊS) */}
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Previsão de Renda Futura</h3>
            <p className="text-[11px] text-zinc-400">
              Mantendo seus R$ {monthlyContributionGoal}/mês de aporte constante
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed mb-3">
          Veja como sua renda passiva mensal vai crescer à medida que você continua aportando e reinvestindo os proventos:
        </p>

        <div className="space-y-2">
          {futureMonthsProjection.map((proj) => (
            <div
              key={proj.monthsAhead}
              className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/70 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  +{proj.monthsAhead} {proj.monthsAhead === 1 ? 'mês' : 'meses'}
                </span>
                <span className="text-zinc-300 font-medium">{proj.monthLabel}</span>
              </div>

              <div className="text-right">
                <span className="text-emerald-400 font-bold block">
                  {formatBRL(proj.projectedIncome)} <span className="text-[10px] font-normal text-zinc-500">/ mês</span>
                </span>
                <span className="text-[10px] text-zinc-500">
                  Patrimônio: {formatBRL(proj.projectedEquity)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

