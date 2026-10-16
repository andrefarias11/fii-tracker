'use client';

import { Target, Sparkles, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GoalsCardProps {
  monthlyTarget: number;
  currentMonthInvested: number;
  monthlyGoalProgressPercent: number;
  milestoneEquityTarget: number;
  currentEquity: number;
  equityGoalProgressPercent: number;
  monthlyIncomeTarget: number;
  totalMonthlyDividends: number;
  incomeGoalProgressPercent: number;
  onOpenSettings: () => void;
}

export function GoalsCard({
  monthlyTarget,
  currentMonthInvested,
  monthlyGoalProgressPercent,
  milestoneEquityTarget,
  currentEquity,
  equityGoalProgressPercent,
  monthlyIncomeTarget,
  totalMonthlyDividends,
  incomeGoalProgressPercent,
  onOpenSettings,
}: GoalsCardProps) {
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const isMonthlyGoalMet = currentMonthInvested >= monthlyTarget;
  const remainingThisMonth = Math.max(0, monthlyTarget - currentMonthInvested);

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f5b800', '#22c55e', '#ffffff'],
    });
  };

  return (
    <div className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center text-white">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">
              Metas Financeiras
            </h3>
            <p className="text-[11px] text-zinc-400 uppercase tracking-wide mt-0.5">
              DISCIPLINA DE APORTES MENSAL
            </p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="px-3.5 py-1.5 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold active:scale-95 transition-all"
        >
          Ajustar metas
        </button>
      </div>

      {/* Meta Principal do Mês */}
      <div className="p-4 rounded-2xl bg-[#141416] mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
            Meta de aporte deste mês
            {isMonthlyGoalMet && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </span>
          <span className="text-xs font-bold text-white tabular-nums">
            {formatBRL(currentMonthInvested)}{' '}
            <span className="text-zinc-500 font-normal">/ {formatBRL(monthlyTarget)}</span>
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2.5">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isMonthlyGoalMet ? 'bg-emerald-400' : 'bg-[#f5b800]'
            }`}
            style={{ width: `${Math.min(100, monthlyGoalProgressPercent)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">
            {isMonthlyGoalMet ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                ▲ Meta do mês batida!
              </span>
            ) : (
              <span>
                Faltam <strong className="text-white tabular-nums">{formatBRL(remainingThisMonth)}</strong> no mês
              </span>
            )}
          </span>

          {isMonthlyGoalMet ? (
            <button
              onClick={triggerConfetti}
              className="text-xs font-bold text-zinc-950 flex items-center gap-1 bg-[#f5b800] px-3 py-1 rounded-full active:scale-95 transition-all"
            >
              <Sparkles className="w-3 h-3" />
              Comemorar
            </button>
          ) : (
            <span className="text-[#f5b800] font-bold tabular-nums">{monthlyGoalProgressPercent}%</span>
          )}
        </div>
      </div>

      {/* Metas Secundárias: Patrimônio & Renda Passiva */}
      <div className="grid grid-cols-2 gap-3">
        {/* Marco de Patrimônio */}
        <div className="p-3.5 rounded-2xl bg-[#141416]">
          <div className="text-[11px] text-zinc-400 mb-0.5">Marco de Patrimônio</div>
          <div className="text-xs font-bold text-white mb-2 tabular-nums">
            {formatBRL(currentEquity)}{' '}
            <span className="text-[11px] text-zinc-500 block font-normal">
              de {formatBRL(milestoneEquityTarget)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#f5b800] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, equityGoalProgressPercent)}%` }}
            />
          </div>
          <div className="text-[11px] text-right text-[#f5b800] mt-1 tabular-nums font-bold">
            {equityGoalProgressPercent}%
          </div>
        </div>

        {/* Meta de Renda Passiva */}
        <div className="p-3.5 rounded-2xl bg-[#141416]">
          <div className="text-[11px] text-zinc-400 mb-0.5">Renda Passiva Mensal</div>
          <div className="text-xs font-bold text-white mb-2 tabular-nums">
            {formatBRL(totalMonthlyDividends)}{' '}
            <span className="text-[11px] text-zinc-500 block font-normal">
              de {formatBRL(monthlyIncomeTarget)}/mês
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, incomeGoalProgressPercent)}%` }}
            />
          </div>
          <div className="text-[11px] text-right text-emerald-400 mt-1 tabular-nums font-bold">
            {incomeGoalProgressPercent}%
          </div>
        </div>
      </div>
    </div>
  );
}
