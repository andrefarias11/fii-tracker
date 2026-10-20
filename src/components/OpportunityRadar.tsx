'use client';

import { useState } from 'react';
import { QuoteData, FiiPosition, FixedIncomeAsset } from '../types/portfolio';
import {
  evaluateAllFiis,
  generateDailyRecommendation,
  RecommendationStrategy,
} from '../lib/recommendationEngine';
import { formatCurrency, formatDecimal, formatPercent } from '../lib/formatFinancial';
import { Button, Chip } from './ui/Controls';
import { EmptyState, SectionSkeleton } from './ui/Feedback';

interface OpportunityRadarProps {
  quotes: Record<string, QuoteData>;
  positions: FiiPosition[];
  monthlyTarget: number;
  currentMonthInvested: number;
  totalMonthlyDividends: number;
  fixedIncomeAssets?: FixedIncomeAsset[];
  isPrivacyMode?: boolean;
  onOpenB3Modal?: () => void;
  onOpenAddFixedIncome?: () => void;
  onOpenBuyModal?: (ticker: string) => void;
  onOpenAsset: (ticker: string) => void;
  isLoading?: boolean;
}

export function OpportunityRadar({
  quotes,
  positions,
  monthlyTarget,
  currentMonthInvested,
  totalMonthlyDividends,
  fixedIncomeAssets = [],
  isPrivacyMode = false,
  onOpenB3Modal,
  onOpenAddFixedIncome,
  onOpenAsset,
  isLoading = false,
}: OpportunityRadarProps) {
  const [filterSegment, setFilterSegment] = useState<string>('TODOS');
  const [strategyMode, setStrategyMode] = useState<RecommendationStrategy>('balanced');
  const [reinvestDividends, setReinvestDividends] = useState<boolean>(false);

  const userCaixinha = fixedIncomeAssets.find(
    (a) => a.type === 'CAIXINHA' || a.rateType === 'CDI'
  );
  const targetCaixinhaLabel = userCaixinha
    ? userCaixinha.name
    : 'Caixinha Nubank (100% CDI)';

  const formatBRL = (val: number, hideInPrivacy = false) => {
    return formatCurrency(val, hideInPrivacy && isPrivacyMode);
  };

  // Avaliação dos fundos considerando a carteira atual
  const evaluatedFiis = evaluateAllFiis(quotes, positions);
  const pocketRemaining = Math.max(0, monthlyTarget - currentMonthInvested);
  const remainingBudget = Number(
    (pocketRemaining + (reinvestDividends ? totalMonthlyDividends : 0)).toFixed(2)
  );
  const recommendation = generateDailyRecommendation(
    remainingBudget,
    evaluatedFiis,
    positions,
    strategyMode
  );

  // Filtragem da lista
  const matchesFilter = (fii: (typeof evaluatedFiis)[number], segment: string) => {
    if (segment === 'HIGH_GRADE') return fii.qualityTier === 'HIGH_GRADE';
    if (segment === 'OPORTUNIDADES') return fii.status === 'OPPORTUNITY';
    if (segment === 'ACOES') return fii.assetClass === 'ACAO';
    if (segment === 'SO_FIIS') return fii.assetClass !== 'ACAO';
    if (segment === 'DATA_COM') return fii.daysUntilExDate <= 5;
    if (segment === 'BASE_10') return fii.assetClass !== 'ACAO' && fii.base === 10;
    if (segment === 'PAPEL') return fii.segment.includes('Papel');
    if (segment === 'TIJOLO') return fii.segment.includes('Tijolo');
    if (segment === 'FIAGRO') return fii.segment.includes('Fiagro');
    return true;
  };
  const filteredFiis = evaluatedFiis.filter((fii) => matchesFilter(fii, filterSegment));
  const bestPick = recommendation.items[0];
  if (isLoading) return <SectionSkeleton label="Consultando ativos do Radar" />;

  return (
    <div className="space-y-4">
      <section className="ui-section">
        <p className="ui-label">Saldo disponível</p>
        <p className="ui-value-lg mt-1">{formatBRL(remainingBudget, true)}</p>
        <label className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          Estratégia ativa
          <select value={strategyMode} onChange={(event) => setStrategyMode(event.target.value as RecommendationStrategy)} className="min-h-11 rounded-xl border border-white/[0.06] bg-[var(--surface-panel)] px-3 text-base text-white sm:text-sm">
            <option value="balanced">Equilibrar carteira</option>
            <option value="snowball">Bola de neve</option>
          </select>
        </label>
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <h2 className="text-xs text-zinc-400">Melhor sugestão do mês</h2>
          {bestPick ? <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0"><button type="button" className="ui-asset-trigger text-lg" onClick={() => onOpenAsset(bestPick.ticker)} aria-label={`Abrir ficha de ${bestPick.ticker}`}>{bestPick.ticker}</button><p className="mt-1 text-xs text-zinc-400">{isPrivacyMode ? '••••' : bestPick.shares} {bestPick.segment.includes('Ações') ? 'ações' : 'cotas'} sugeridas</p></div>
            <p className="text-sm font-semibold text-white tabular-nums">{formatBRL(bestPick.totalCost, true)}</p>
          </div> : <p className="mt-2 text-sm text-zinc-400">Nenhuma sugestão disponível para este saldo.</p>}
        </div>
        <details className="mt-4 border-t border-white/[0.06] pt-3">
          <summary className="cursor-pointer py-2 text-xs font-semibold text-zinc-300">Ajustar orçamento e ver cesta</summary>
          <div className="mt-3 space-y-4 text-xs text-zinc-400">
            <p>Aportado no mês: <span className="text-white tabular-nums">{formatBRL(currentMonthInvested, true)} / {formatBRL(monthlyTarget, true)}</span></p>
            {totalMonthlyDividends > 0 && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={reinvestDividends} onChange={(event) => setReinvestDividends(event.target.checked)} className="h-5 w-5 accent-[#f5b800]" />Reinvestir proventos ({formatBRL(totalMonthlyDividends, true)})</label>}
            <p className="leading-relaxed">{isPrivacyMode ? 'Detalhes financeiros da estratégia ocultos no modo privacidade.' : recommendation.strategyExplanation}</p>
            {recommendation.items.map((item) => <div key={item.ticker} className="border-t border-white/[0.06] pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" className="ui-asset-trigger text-sm" onClick={() => onOpenAsset(item.ticker)}>{item.ticker} · {isPrivacyMode ? '••••' : item.shares} unidades</button><span className="tabular-nums">{formatBRL(item.totalCost, true)}</span></div>
              <p className="mt-1 leading-relaxed">{isPrivacyMode ? 'Justificativa financeira oculta no modo privacidade.' : item.reason}</p><p className="mt-2 tabular-nums">Renda estimada: +{formatBRL(item.estimatedMonthlyIncome, true)}/mês</p>
            </div>)}
            {recommendation.unallocatedCash > 0 && <div><p>Saldo da cesta: <span className="tabular-nums">{formatBRL(recommendation.unallocatedCash, true)}</span> · {targetCaixinhaLabel}</p>{onOpenAddFixedIncome && <button type="button" onClick={onOpenAddFixedIncome} className="min-h-11 font-semibold text-[#f5b800]">Guardar saldo</button>}</div>}
            <p>Total sugerido: <span className="text-white tabular-nums">{formatBRL(recommendation.totalSuggestedCost, true)}</span></p>
            {onOpenB3Modal && <button type="button" onClick={onOpenB3Modal} className="min-h-11 font-semibold text-[#f5b800]">Importar compras da B3</button>}
          </div>
        </details>
      </section>
      <h3 className="ui-title px-1">Radar de oportunidades</h3>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Filtrar ativos">
        {[
          { id: 'TODOS', label: 'Todos' }, { id: 'OPORTUNIDADES', label: 'Oportunidades' },
          { id: 'HIGH_GRADE', label: 'High Grade' }, { id: 'ACOES', label: 'Ações' },
          { id: 'SO_FIIS', label: 'FIIs' }, { id: 'DATA_COM', label: 'Data-Com próxima' },
          { id: 'BASE_10', label: 'Base 10' }, { id: 'PAPEL', label: 'Papel' },
          { id: 'TIJOLO', label: 'Tijolo' }, { id: 'FIAGRO', label: 'Fiagro' },
        ].map((chip) => <Chip key={chip.id} onClick={() => setFilterSegment(chip.id)} selected={filterSegment === chip.id}>
          {chip.label} · <span className="tabular-nums">{evaluatedFiis.filter((fii) => matchesFilter(fii, chip.id)).length}</span>
        </Chip>)}
      </div>
      <div className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[var(--surface-card)] divide-y divide-white/[0.06]">
        {filteredFiis.map((fii) => <article key={fii.ticker} className="px-5 py-4">
          <div className="flex items-center justify-between gap-3"><h3><button type="button" className="ui-asset-trigger text-base" onClick={() => onOpenAsset(fii.ticker)} aria-label={`Abrir ficha de ${fii.ticker}`}>{fii.ticker}</button></h3><span className="text-base font-semibold text-white tabular-nums">{formatBRL(fii.currentPrice)}</span></div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs"><div><span className="text-zinc-500">P/VP</span><strong className="ml-2 font-medium text-zinc-200 tabular-nums">{formatDecimal(fii.pvp)}</strong></div><div><span className="text-zinc-500">DY anual estimado</span><strong className="ml-2 font-medium text-zinc-200 tabular-nums">{formatPercent(fii.annualYieldPercent)}</strong></div></div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">{fii.qualityWarnings.length > 0 ? 'Indicadores exigem atenção; consulte os alertas na análise.' : fii.rebalancesPortfolio ? 'Contribui para o equilíbrio da sua carteira.' : fii.status === 'OPPORTUNITY' ? 'Cotação abaixo do valor patrimonial de referência.' : fii.status === 'EXPENSIVE' ? 'Cotação acima do valor patrimonial de referência.' : 'Cotação próxima do valor patrimonial de referência.'}</p>
          <Button className="mt-3 w-full" onClick={() => onOpenAsset(fii.ticker)}>Ver análise</Button>
        </article>)}
        {filteredFiis.length === 0 && <EmptyState title="Nenhum ativo neste filtro" description="Amplie a seleção para explorar os demais ativos do catálogo." action={<Button onClick={() => setFilterSegment('TODOS')}>Mostrar todos</Button>} />}
      </div>
    </div>
  );
}
