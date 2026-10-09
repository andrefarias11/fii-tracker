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
      colors: ['#10b981', '#34d399', '#059669', '#f59e0b', '#38bdf8'],
    });
  };

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              Metas Financeiras
            </h3>
            <p className="text-[11px] text-zinc-400">Disciplina de aportes na XP</p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Ajustar metas
        </button>
      </div>

      {/* Meta Principal: R$ 200 / mês */}
      <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
            Meta deste Mês
            {isMonthlyGoalMet && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </span>
          <span className="text-xs font-bold text-white">
            {formatBRL(currentMonthInvested)}{' '}
            <span className="text-zinc-500 font-normal">/ {formatBRL(monthlyTarget)}</span>
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5 mb-2">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isMonthlyGoalMet
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                : 'bg-gradient-to-r from-amber-500 to-emerald-400'
            }`}
            style={{ width: `${Math.min(100, monthlyGoalProgressPercent)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">
            {isMonthlyGoalMet ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                🎉 Meta do mês batida!
              </span>
            ) : (
              <span>
                Faltam <strong className="text-zinc-200">{formatBRL(remainingThisMonth)}</strong> para fechar o mês
              </span>
            )}
          </span>

          {isMonthlyGoalMet ? (
            <button
              onClick={triggerConfetti}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 active:scale-95 transition-all"
            >
              <Sparkles className="w-3 h-3" />
              Comemorar
            </button>
          ) : (
            <span className="text-zinc-400 font-mono font-semibold">{monthlyGoalProgressPercent}%</span>
          )}
        </div>
      </div>

      {/* Metas Secundárias: Patrimônio & Renda Passiva */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Marco de Patrimônio */}
        <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/60">
          <div className="text-[11px] text-zinc-400 mb-0.5">Marco de Patrimônio</div>
          <div className="text-xs font-bold text-zinc-200 mb-1.5">
            {formatBRL(currentEquity)}{' '}
            <span className="text-[10px] text-zinc-500">/ {formatBRL(milestoneEquityTarget)}</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, equityGoalProgressPercent)}%` }}
            />
          </div>
          <div className="text-[10px] text-right text-zinc-400 mt-1 font-mono">
            {equityGoalProgressPercent}%
          </div>
        </div>

        {/* Meta de Renda Passiva */}
        <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/60">
          <div className="text-[11px] text-zinc-400 mb-0.5">Renda Passiva Mensal</div>
          <div className="text-xs font-bold text-zinc-200 mb-1.5">
            {formatBRL(totalMonthlyDividends)}{' '}
            <span className="text-[10px] text-zinc-500">/ {formatBRL(monthlyIncomeTarget)}</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, incomeGoalProgressPercent)}%` }}
            />
          </div>
          <div className="text-[10px] text-right text-zinc-400 mt-1 font-mono">
            {incomeGoalProgressPercent}%
          </div>
        </div>
      </div>
    </div>
  );
}

