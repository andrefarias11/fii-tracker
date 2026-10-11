'use client';

import {
  TrendingUp,
  TrendingDown,
  Coins,
  ChevronRight,
  Target,
  Plus,
  FileSpreadsheet,
  ReceiptText,
} from 'lucide-react';
import { BcbIndicators } from '../types/portfolio';

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
  isPrivacyMode?: boolean;
  onNavigateToProventos?: () => void;
  onNavigateToGoals?: () => void;
  onOpenAddModal?: () => void;
  onOpenExtrato?: () => void;
  onOpenB3Modal?: () => void;
}

export function PortfolioSummary({
  currentEquity,
  totalInvested,
  totalProfitLoss,
  totalProfitLossPercent,
  totalMonthlyDividends,
  averageYieldOnCostPercent = 0,
  currentMonthInvested = 0,
  monthlyTarget = 0,
  monthlyGoalProgressPercent = 0,
  bcbIndicators = null,
  isPrivacyMode = false,
  onNavigateToProventos,
  onNavigateToGoals,
  onOpenAddModal,
  onOpenExtrato,
  onOpenB3Modal,
}: SummaryProps) {
  const isPositive = totalProfitLoss >= 0;

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
      <div className="relative overflow-hidden rounded-[28px] bg-[#121215] border border-white/[0.07] p-6 shadow-2xl">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/[0.07] rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-zinc-400 tracking-wide">
            Patrimônio em FIIs
          </span>
          {realReturnAboveIpca !== null && realReturnAboveIpca >= 0 && (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
              IPCA +{realReturnAboveIpca}% a.a.
            </span>
          )}
        </div>

        {/* Valor Principal em Destaque Minimalista */}
        <h2 className="text-[34px] font-extrabold tracking-tight text-white leading-tight mb-2.5">
          {formatBRL(currentEquity)}
        </h2>

        {/* Linha Sutil de Rentabilidade + Valor Investido */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold ${
              isPositive
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-rose-500/15 text-rose-400'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {isPositive ? '+' : ''}
            {formatBRL(totalProfitLoss)} ({isPositive ? '+' : ''}
            {totalProfitLossPercent}%)
          </span>

          <span className="text-zinc-500">
            Custo <strong className="text-zinc-300 font-semibold">{formatBRL(totalInvested)}</strong>
          </span>
        </div>

        {/* Fileira de Ações Rápidas Estilo Nubank */}
        {(onOpenAddModal || onOpenExtrato || onOpenB3Modal) && (
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/[0.06]">
            {onOpenAddModal && (
              <button
                type="button"
                onClick={onOpenAddModal}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                Aportar
              </button>
            )}

            {onOpenExtrato && (
              <button
                type="button"
                onClick={onOpenExtrato}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 font-semibold text-xs active:scale-95 transition-all"
              >
                <ReceiptText className="w-3.5 h-3.5 text-zinc-400" />
                Extrato
              </button>
            )}

            {onOpenB3Modal && (
              <button
                type="button"
                onClick={onOpenB3Modal}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 font-semibold text-xs active:scale-95 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
                Planilha B3
              </button>
            )}
          </div>
        )}
      </div>

      {/* DOIS MINI-WIDGETS LADO A LADO ESTILO APPLE iOS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Proventos Mensais */}
        <div
          onClick={onNavigateToProventos}
          className={`rounded-[24px] bg-[#121215] border border-white/[0.06] p-4 flex flex-col justify-between transition-all ${
            onNavigateToProventos
              ? 'cursor-pointer hover:border-white/[0.14] active:scale-[0.98]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block">Proventos / mês</span>
            <div className="text-lg font-extrabold text-white tracking-tight mt-0.5">
              {formatBRL(totalMonthlyDividends)}
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">
              YoC {averageYieldOnCostPercent}% a.m. isento
            </span>
          </div>
        </div>

        {/* Card 2: Meta de Aporte do Mês */}
        <div
          onClick={onNavigateToGoals}
          className={`rounded-[24px] bg-[#121215] border border-white/[0.06] p-4 flex flex-col justify-between transition-all ${
            onNavigateToGoals
              ? 'cursor-pointer hover:border-white/[0.14] active:scale-[0.98]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-full bg-teal-500/15 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <span className="text-[11px] font-bold text-emerald-400">
              {monthlyGoalProgressPercent}%
            </span>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block">Aporte no mês</span>
            <div className="text-lg font-extrabold text-white tracking-tight mt-0.5">
              {formatBRL(currentMonthInvested)}
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
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
        <div className="px-4 py-2 rounded-2xl bg-[#121215]/70 border border-white/[0.04] flex items-center justify-between text-[10px] text-zinc-500">
          <span>Banco Central Hoje</span>
          <div className="flex items-center gap-2.5 text-zinc-400 font-medium">
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
