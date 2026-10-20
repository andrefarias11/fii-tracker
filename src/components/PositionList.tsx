'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronRight,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import type { FiiPosition } from '../types/portfolio';
import { triggerHaptic } from '../lib/haptic';
import { formatCurrency, formatPercent } from '../lib/formatFinancial';
import { Button, Chip } from './ui/Controls';
import { EmptyState } from './ui/Feedback';

interface PositionListProps {
  positions: FiiPosition[];
  isPrivacyMode?: boolean;
  onUpdateDividend: (ticker: string, dividend: number) => void;
  onOpenB3Modal?: () => void;
  onOpenBuyModal?: (ticker: string) => void;
  onOpenMapForTicker?: (ticker: string) => void;
  onOpenAiForTicker?: (ticker: string) => void;
  onOpenAsset: (ticker: string) => void;
}

type SortKey = 'position' | 'result' | 'dividends';
const sortLabels: Record<SortKey, string> = {
  position: 'Posição',
  result: 'Resultado',
  dividends: 'Proventos',
};

export function PositionList({
  positions,
  isPrivacyMode = false,
  onOpenB3Modal,
  onOpenAsset,
}: PositionListProps) {
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'FII' | 'ACAO'>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('position');
  const fiisCount = positions.filter(
    (position) => position.assetClass !== 'ACAO',
  ).length;
  const stocksCount = positions.length - fiisCount;
  const sortedPositions = useMemo(() => {
    const list = positions.filter(
      (position) =>
        assetFilter === 'ALL' ||
        (assetFilter === 'FII'
          ? position.assetClass !== 'ACAO'
          : position.assetClass === 'ACAO'),
    );
    return list.sort((a, b) =>
      sortBy === 'position'
        ? b.currentTotal - a.currentTotal
        : sortBy === 'result'
          ? b.profitLoss - a.profitLoss
          : b.totalMonthlyDividend - a.totalMonthlyDividend,
    );
  }, [positions, assetFilter, sortBy]);

  if (!positions.length)
    return (
      <div className="ui-section">
        <EmptyState
          title="Sua carteira começa aqui"
          description="Importe seu extrato da B3 para acompanhar posições, proventos e conquistas em um só lugar."
          icon={<Layers className="h-5 w-5" />}
          action={
            onOpenB3Modal && (
              <Button variant="primary" onClick={onOpenB3Modal}>
                <FileSpreadsheet className="h-4 w-4" />
                Importar extrato B3
              </Button>
            )
          }
        />
      </div>
    );

  return (
    <section className="space-y-3" aria-label="Meus ativos">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="ui-title">
          Meus ativos{' '}
          <span className="text-sm font-normal text-zinc-500">
            · {positions.length}
          </span>
        </h3>
        <Button
          variant="ghost"
          onClick={() => {
            triggerHaptic('selection');
            setSortBy((previous) =>
              previous === 'position'
                ? 'result'
                : previous === 'result'
                  ? 'dividends'
                  : 'position',
            );
          }}
          aria-label={`Ordenar ativos. Atual: ${sortLabels[sortBy]}`}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortLabels[sortBy]}
        </Button>
      </div>
      {fiisCount > 0 && stocksCount > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
          aria-label="Classe de ativo"
        >
          {(
            [
              { value: 'ALL', label: `Todos · ${positions.length}` },
              { value: 'FII', label: `FIIs · ${fiisCount}` },
              { value: 'ACAO', label: `Ações · ${stocksCount}` },
            ] as const
          ).map((option) => (
            <Chip
              key={option.value}
              selected={assetFilter === option.value}
              onClick={() => {
                triggerHaptic('selection');
                setAssetFilter(option.value);
              }}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[var(--surface-card)] divide-y divide-white/[0.06]">
        {sortedPositions.map((position) => (
          <button
            key={position.ticker}
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onOpenAsset(position.ticker);
            }}
            aria-label={`Abrir ficha de ${position.ticker}`}
            className="block w-full px-4 py-5 text-left transition-colors duration-150 hover:bg-white/[0.025]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="text-base font-semibold tracking-tight text-white">
                  {position.ticker}
                </span>
                <span className="mt-1 block truncate text-xs text-zinc-500">
                  {position.name}
                </span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-600" />
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <span>
                <span className="ui-label block">Posição</span>
                <span className="mt-1 block text-xl font-semibold tracking-tight text-white tabular-nums">
                  {formatCurrency(position.currentTotal, isPrivacyMode)}
                </span>
              </span>
              <span className="text-right">
                <span className="ui-label block">Resultado total</span>
                <span
                  className={`mt-1 block text-xs font-medium tabular-nums ${position.profitLoss >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                >
                  {position.profitLoss >= 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(position.profitLoss), isPrivacyMode)}
                  <span className="mt-0.5 block">
                    {formatPercent(position.profitLossPercent, isPrivacyMode)}
                  </span>
                </span>
              </span>
            </div>
            <span className="ui-label mt-4 flex flex-wrap justify-between gap-2">
              <span>
                Preço atual{' '}
                <span className="ml-1 text-zinc-300 tabular-nums">
                  {formatCurrency(position.currentPrice)}
                </span>
              </span>
              <span>
                Renda estimada{' '}
                <span className="ml-1 text-zinc-300 tabular-nums">
                  {formatCurrency(position.totalMonthlyDividend, isPrivacyMode)}
                  /mês
                </span>
              </span>
            </span>
          </button>
        ))}
        {!sortedPositions.length && (
          <EmptyState
            title="Nenhum ativo nesta classe"
            description="Selecione Todos para voltar à sua carteira completa."
            action={
              <Button onClick={() => setAssetFilter('ALL')}>
                Mostrar todos
              </Button>
            }
          />
        )}
      </div>
    </section>
  );
}
