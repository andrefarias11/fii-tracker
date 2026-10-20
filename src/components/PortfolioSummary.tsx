'use client';

import { useState } from 'react';
import { BcbIndicators, UnifiedPortfolioSummary } from '../types/portfolio';
import { triggerHaptic } from '../lib/haptic';
import { formatCurrency, formatPercent } from '../lib/formatFinancial';
import { Button, SegmentedControl } from './ui/Controls';

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
  unifiedSummary = null,
  fixedIncomeCount = 0,
  isPrivacyMode = false,
  onNavigateToGoals,
  onOpenB3Modal,
  onNavigateToFixedIncome,
  onNavigateToProventos,
}: SummaryProps) {
  const hasFixedIncome = Boolean(
    unifiedSummary && unifiedSummary.fixedIncomeEquity > 0,
  );

  const [viewScope, setViewScope] = useState<'global' | 'bolsa'>(
    hasFixedIncome ? 'global' : 'bolsa',
  );

  const isGlobalView = viewScope === 'global' && hasFixedIncome;

  const displayEquity = isGlobalView
    ? (unifiedSummary?.totalGlobalEquity ?? currentEquity)
    : currentEquity;

  const displayInvested = isGlobalView
    ? (unifiedSummary?.totalGlobalInvested ?? totalInvested)
    : totalInvested;

  const displayProfitLoss = isGlobalView
    ? (unifiedSummary?.totalGlobalProfitLoss ?? totalProfitLoss)
    : totalProfitLoss;

  const displayProfitLossPercent = isGlobalView
    ? (unifiedSummary?.totalGlobalProfitLossPercent ?? totalProfitLossPercent)
    : totalProfitLossPercent;

  const displayMonthlyIncome = isGlobalView
    ? (unifiedSummary?.totalGlobalMonthlyIncome ?? totalMonthlyDividends)
    : totalMonthlyDividends;

  const isPositive = displayProfitLoss >= 0;

  const formatBRL = (value: number) => formatCurrency(value, isPrivacyMode);

  return (
    <section
      className="portfolio-summary space-y-5"
      aria-label="Resumo da carteira"
    >
      {hasFixedIncome && (
        <SegmentedControl
          label="Escopo do patrimônio"
          value={viewScope}
          onChange={(value) => {
            triggerHaptic('selection');
            setViewScope(value);
          }}
          options={[
            { value: 'bolsa', label: 'Bolsa' },
            { value: 'global', label: 'Patrimônio global' },
          ]}
        />
      )}
      <div>
        <p className="ui-label">
          {isGlobalView ? 'Patrimônio total' : 'Patrimônio em bolsa'}
        </p>
        <p className="ui-value-xl mt-2">{formatBRL(displayEquity)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className={`font-medium tabular-nums ${isPositive ? 'text-emerald-300' : 'text-rose-300'}`}
          >
            {isPositive ? '+' : '−'}
            {formatBRL(Math.abs(displayProfitLoss))} ·{' '}
            {formatPercent(displayProfitLossPercent, isPrivacyMode)}
          </span>
          <span className="text-zinc-500">Resultado total</span>
        </div>
      </div>
      <div className="border-y border-white/[0.06] py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ui-label">Renda mensal estimada</p>
            <p className="ui-value-lg mt-1">
              {formatBRL(displayMonthlyIncome)}
            </p>
          </div>
          {onNavigateToProventos && (
            <Button variant="ghost" onClick={onNavigateToProventos}>
              Ver proventos
            </Button>
          )}
        </div>
        <p className="ui-label mt-2 tabular-nums">
          YoC da bolsa ·{' '}
          {formatPercent(averageYieldOnCostPercent, isPrivacyMode)} a.m.
        </p>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span className="text-zinc-400">Valor aplicado</span>
        <span className="font-medium text-white tabular-nums">
          {formatBRL(displayInvested)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="primary"
          onClick={() => {
            triggerHaptic('light');
            onOpenB3Modal?.();
          }}
        >
          Importar B3
        </Button>
        <Button
          onClick={() => {
            triggerHaptic('light');
            if (onNavigateToFixedIncome) onNavigateToFixedIncome();
            else onNavigateToGoals?.();
          }}
        >
          {hasFixedIncome
            ? `Renda fixa · ${fixedIncomeCount}`
            : 'Renda fixa'}
        </Button>
      </div>
    </section>
  );
}
