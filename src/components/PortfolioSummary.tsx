'use client';

import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Coins,
  ChevronRight,
  Target,
  FileSpreadsheet,
  ReceiptText,
  PiggyBank,
  Wallet,
} from 'lucide-react';
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
  currentMonthInvested = 0,
  monthlyGoalProgressPercent = 0,
  bcbIndicators = null,
  unifiedSummary = null,
  fixedIncomeCount = 0,
  isPrivacyMode = false,
  onNavigateToProventos,
  onNavigateToGoals,
  onOpenExtrato,
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

  const annualYocPercent = Number((averageYieldOnCostPercent * 12).toFixed(2));
  const realReturnAboveIpca =
    bcbIndicators && annualYocPercent > 0
      ? Number((annualYocPercent - bcbIndicators.ipca12m).toFixed(2))
      : null;

  return (
    <div className="space-y-3">
      {/* HERO CARD ESTILO NUBANK / APPLE WALLET */}
      <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-5 shadow-xl">
        {/* Linha Superior: Escopo e Indicador de Inflação */}
        <div className="flex items-center justify-between mb-2">
          {hasFixedIncome ? (
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.05]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setViewScope('global');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  viewScope === 'global'
                    ? 'bg-white/[0.08] text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Patrimônio Global
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setViewScope('bolsa');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  viewScope === 'bolsa'
                    ? 'bg-white/[0.08] text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Apenas Bolsa (B3)
              </button>
            </div>
          ) : (
            <span className="text-xs font-medium text-zinc-400 tracking-wide">
              Patrimônio em FIIs (Custódia B3)
            </span>
          )}

          {realReturnAboveIpca !== null && realReturnAboveIpca >= 0 && (
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 tabular-nums">
              IPCA +{realReturnAboveIpca}% a.a.
            </span>
          )}
        </div>

        {/* Valor Principal em Destaque Minimalista */}
        <h2 className="text-[32px] sm:text-[34px] font-bold tracking-tight text-white leading-tight mb-2 tabular-nums">
          {formatBRL(displayEquity)}
        </h2>

        {/* Breakdown de Classes quando no modo Global */}
        {isGlobalView && unifiedSummary && (
          <div className="flex items-center gap-2 mb-3 text-[11px] text-zinc-400 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.04] text-zinc-300 font-medium border border-white/[0.06] tabular-nums">
              Bolsa: {formatBRL(unifiedSummary.bolsaEquity)}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.04] text-zinc-300 font-medium border border-white/[0.06] tabular-nums">
              Caixinhas & RF: {formatBRL(unifiedSummary.fixedIncomeEquity)}
            </span>
          </div>
        )}

        {/* Linha Sutil de Rentabilidade + Valor Investido */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold tabular-nums ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {isPositive ? '+' : ''}
            {formatBRL(displayProfitLoss)} ({isPositive ? '+' : ''}
            {displayProfitLossPercent}%)
          </span>

          <span className="text-zinc-500">
            Custo <strong className="text-zinc-300 font-semibold tabular-nums">{formatBRL(displayInvested)}</strong>
          </span>
        </div>

        {/* Fileira de Ações Rápidas Estilo Nubank */}
        <div className="grid grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-white/[0.06]">
          {onOpenB3Modal && (
            <button
              type="button"
              onClick={onOpenB3Modal}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs active:scale-95 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
              Importar Planilha B3
            </button>
          )}

          {onNavigateToFixedIncome ? (
            <button
              type="button"
              onClick={onNavigateToFixedIncome}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 font-semibold text-xs active:scale-95 transition-all border border-white/[0.06]"
            >
              <PiggyBank className="w-4 h-4 text-zinc-400" />
              {hasFixedIncome ? `Caixinhas (${fixedIncomeCount})` : '+ Caixinhas / RF'}
            </button>
          ) : onOpenExtrato ? (
            <button
              type="button"
              onClick={onOpenExtrato}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 font-semibold text-xs active:scale-95 transition-all border border-white/[0.06]"
            >
              <ReceiptText className="w-3.5 h-3.5 text-zinc-400" />
              Extrato B3
            </button>
          ) : null}
        </div>
      </div>

      {/* DOIS MINI-WIDGETS LADO A LADO ESTILO APPLE iOS */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Card 1: Proventos / Renda Mensal Total */}
        <div
          onClick={onNavigateToProventos}
          className={`rounded-[24px] bg-[#121215] border border-white/[0.06] p-4 flex flex-col justify-between transition-all min-w-0 ${
            onNavigateToProventos
              ? 'cursor-pointer hover:border-white/[0.14] active:scale-[0.98]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300 shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
          </div>

          <div className="min-w-0">
            <span className="text-[11px] text-zinc-400 block truncate">
              {isGlobalView ? 'Renda Passiva / mês' : 'Proventos / mês'}
            </span>
            <div className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 truncate tabular-nums">
              {formatBRL(displayMonthlyIncome)}
            </div>
            {isGlobalView && unifiedSummary && unifiedSummary.fixedIncomeMonthlyYield > 0 ? (
              <span className="text-[11px] text-zinc-400 font-medium block truncate tabular-nums">
                +{formatBRL(unifiedSummary.fixedIncomeMonthlyYield)} em RF
              </span>
            ) : (
              <span className="text-[11px] text-emerald-400 font-medium block truncate tabular-nums">
                YoC {averageYieldOnCostPercent}% a.m.
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Meta de Aporte do Mês */}
        <div
          onClick={onNavigateToGoals}
          className={`rounded-[24px] bg-[#121215] border border-white/[0.06] p-4 flex flex-col justify-between transition-all min-w-0 ${
            onNavigateToGoals
              ? 'cursor-pointer hover:border-white/[0.14] active:scale-[0.98]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300 shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 shrink-0 tabular-nums">
              {monthlyGoalProgressPercent}%
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] text-zinc-400 block truncate">Aporte no mês</span>
            <div className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 truncate tabular-nums">
              {formatBRL(currentMonthInvested)}
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(100, monthlyGoalProgressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pílula Discreta de Referência Banco Central */}
      {bcbIndicators && (
        <div className="px-3.5 sm:px-4 py-2 rounded-2xl bg-[#121215] border border-white/[0.05] flex items-center justify-between gap-2 flex-wrap text-[11px] text-zinc-500">
          <span className="shrink-0 font-medium">Banco Central Hoje</span>
          <div className="flex items-center gap-1.5 sm:gap-2.5 text-zinc-400 font-medium flex-wrap tabular-nums">
            <span>Selic {bcbIndicators.selicAnnual}%</span>
            <span>•</span>
            <span>CDI Líq. {bcbIndicators.cdiNetAnnual}%</span>
            <span>•</span>
            <span>IPCA {bcbIndicators.ipca12m}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
