'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { BcbIndicators, UnifiedPortfolioSummary } from '../types/portfolio';
import { triggerHaptic } from '../lib/haptic';

interface SummaryProps {
  currentEquity: number;
  totalInvested: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  totalMonthlyDividends: number;
  averageYieldOnCostPercent?: number;
  currentMonthInvested?: number;
  monthlyTarget?: number;
  monthlyGoalProgressPercent?: number;
  bcbIndicators?: BcbIndicators | null;
  unifiedSummary?: UnifiedPortfolioSummary | null;
  fixedIncomeCount?: number;
  isPrivacyMode?: boolean;
  onNavigateToProventos?: () => void;
  onNavigateToGoals?: () => void;
  onOpenExtrato?: () => void;
  onOpenB3Modal?: () => void;
  onNavigateToFixedIncome?: () => void;
}

export function PortfolioSummary({
  currentEquity,
  totalInvested,
  totalProfitLoss,
  totalProfitLossPercent,
  totalMonthlyDividends,
  averageYieldOnCostPercent = 0,
  bcbIndicators = null,
  unifiedSummary = null,
  fixedIncomeCount = 0,
  isPrivacyMode = false,
  onNavigateToGoals,
  onOpenB3Modal,
  onNavigateToFixedIncome,
}: SummaryProps) {
  const hasFixedIncome = Boolean(
    unifiedSummary && unifiedSummary.fixedIncomeEquity > 0
  );

  const [viewScope, setViewScope] = useState<'global' | 'bolsa'>(
    hasFixedIncome ? 'global' : 'bolsa'
  );

  const isGlobalView = viewScope === 'global' && hasFixedIncome;

  const displayEquity = isGlobalView
    ? unifiedSummary?.totalGlobalEquity ?? currentEquity
    : currentEquity;

  const displayInvested = isGlobalView
    ? unifiedSummary?.totalGlobalInvested ?? totalInvested
    : totalInvested;

  const displayProfitLoss = isGlobalView
    ? unifiedSummary?.totalGlobalProfitLoss ?? totalProfitLoss
    : totalProfitLoss;

  const displayProfitLossPercent = isGlobalView
    ? unifiedSummary?.totalGlobalProfitLossPercent ?? totalProfitLossPercent
    : totalProfitLossPercent;

  const displayMonthlyIncome = isGlobalView
    ? unifiedSummary?.totalGlobalMonthlyIncome ?? totalMonthlyDividends
    : totalMonthlyDividends;

  const isPositive = displayProfitLoss >= 0;

  const formatBRL = (value: number) => {
    if (isPrivacyMode) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="pt-2 pb-1">
      {/* Linha 1: Rótulo com ícone Info + Toggle de Escopo Bolsa/Global */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
          <span>{isGlobalView ? 'Total em Patrimônio Global' : 'Total em Bolsa de Valores'}</span>
          <span title="Custódia consolidada em Bolsa de Valores (B3)" className="inline-flex items-center">
            <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer" />
          </span>
        </div>

        {hasFixedIncome && (
          <div className="flex items-center gap-1 p-0.5 rounded-full bg-[#1c1c1e] border border-white/[0.04]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setViewScope('bolsa');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                viewScope === 'bolsa'
                  ? 'bg-[#2b2512] text-[#f5b800]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Bolsa
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setViewScope('global');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                viewScope === 'global'
                  ? 'bg-[#2b2512] text-[#f5b800]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Global
            </button>
          </div>
        )}
      </div>

      {/* Linha 2: Valor do patrimônio em destaque */}
      <div className="text-[32px] font-bold text-white tracking-tight mt-1 tabular-nums leading-tight">
        {formatBRL(displayEquity)}
      </div>

      {/* Linha 3: ▲ R$ X,XX (X,XX%) Resultado total */}
      <div className="flex items-center gap-1.5 text-xs font-medium mt-1">
        <span className={`tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? '▲' : '▼'} {formatBRL(Math.abs(displayProfitLoss))} ({isPositive ? '+' : ''}{displayProfitLossPercent}%)
        </span>
        <span className="text-zinc-400">Resultado total</span>
      </div>

      {/* Linha 4: ▲ R$ X,XX (X,XX%) Proventos no mês (YoC X,XX%) */}
      <div className="flex items-center gap-1.5 text-xs font-medium mt-1">
        <span className="text-emerald-400 tabular-nums">
          ▲ {formatBRL(displayMonthlyIncome)} ({averageYieldOnCostPercent}%)
        </span>
        <span className="text-zinc-400">
          Proventos no mês (YoC {averageYieldOnCostPercent}% a.m.)
        </span>
      </div>

      {/* Linha 5: Divisória horizontal fina */}
      <div className="border-t border-white/[0.08] my-4" />

      {/* Linha 6: Valor aplicado à esquerda e R$ X,XX à direita */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">Valor aplicado</span>
        <span className="text-white font-semibold tabular-nums">
          {formatBRL(displayInvested)}
        </span>
      </div>

      {/* Linha 7: Ações rápidas discretas em pílula estilo XP */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onOpenB3Modal?.();
          }}
          className="rounded-full py-2.5 px-4 text-xs font-semibold bg-[#2b2512] text-[#f5b800] hover:bg-[#3a3218] active:scale-95 transition-all text-center"
        >
          Importar B3
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            if (onNavigateToFixedIncome) {
              onNavigateToFixedIncome();
            } else if (onNavigateToGoals) {
              onNavigateToGoals();
            }
          }}
          className="rounded-full py-2.5 px-4 text-xs font-semibold bg-[#1c1c1e] text-zinc-200 hover:bg-[#28282b] active:scale-95 transition-all text-center"
        >
          {hasFixedIncome ? `Caixinhas (${fixedIncomeCount})` : '+ Caixinha / Meta'}
        </button>
      </div>
    </div>
  );
}
