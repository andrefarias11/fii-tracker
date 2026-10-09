'use client';

import { TrendingUp, TrendingDown, Coins, Wallet } from 'lucide-react';

interface SummaryProps {
  currentEquity: number;
  totalInvested: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  totalMonthlyDividends: number;
}

export function PortfolioSummary({
  currentEquity,
  totalInvested,
  totalProfitLoss,
  totalProfitLossPercent,
  totalMonthlyDividends,
}: SummaryProps) {
  const isPositive = totalProfitLoss >= 0;

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800/80 p-5 shadow-xl">
      {/* Glow de fundo */}
      <div className="absolute -top-12 -right-12 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5 text-zinc-400" />
          Patrimônio Atual
        </span>
        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          Carteira FII
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          {formatBRL(currentEquity)}
        </h2>
      </div>

      {/* Rentabilidade e Custo */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold ${
            isPositive
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}
        >
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>
            {isPositive ? '+' : ''}
            {formatBRL(totalProfitLoss)} ({isPositive ? '+' : ''}
            {totalProfitLossPercent}%)
          </span>
        </div>

        <span className="text-xs text-zinc-400">
          Investido: <strong className="text-zinc-200">{formatBRL(totalInvested)}</strong>
        </span>
      </div>

      {/* Dividendo mensal projetado */}
      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400">Renda Mensal Estimada</div>
            <div className="text-sm font-bold text-emerald-300">
              {formatBRL(totalMonthlyDividends)} <span className="text-[11px] font-normal text-zinc-400">/ mês</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-zinc-400">Yield Médio Estimado</div>
          <div className="text-xs font-semibold text-zinc-200">
            {currentEquity > 0
              ? `${((totalMonthlyDividends / currentEquity) * 100).toFixed(2)}% a.m.`
              : '0.00%'}
          </div>
        </div>
      </div>
    </div>
  );
}

