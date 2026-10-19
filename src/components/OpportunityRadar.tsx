'use client';

import { useState } from 'react';
import { QuoteData, FiiPosition, FixedIncomeAsset } from '../types/portfolio';
import {
  evaluateAllFiis,
  generateDailyRecommendation,
  RecommendationStrategy,
} from '../lib/recommendationEngine';
import { triggerHaptic } from '../lib/haptic';

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
  onOpenBuyModal,
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
    if (hideInPrivacy && isPrivacyMode) return 'R$ ••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
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

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-white/[0.06] bg-[#121215] p-5">
        <p className="text-xs text-zinc-400">Saldo disponível</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-white tabular-nums">{formatBRL(remainingBudget, true)}</p>
        <label className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          Estratégia ativa
          <select value={strategyMode} onChange={(event) => setStrategyMode(event.target.value as RecommendationStrategy)} className="min-h-11 rounded-xl border border-white/[0.06] bg-[#1c1c1f] px-3 text-base text-white sm:text-sm">
            <option value="balanced">Equilibrar carteira</option>
            <option value="snowball">Bola de neve</option>
          </select>
        </label>
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <h2 className="text-xs text-zinc-400">Melhor sugestão do mês</h2>
          {bestPick ? <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-lg font-bold text-white">{bestPick.ticker}</p><p className="mt-1 text-xs text-zinc-400">{bestPick.shares} {bestPick.segment.includes('Ações') ? 'ações' : 'cotas'} sugeridas</p></div>
            <p className="text-sm font-semibold text-white tabular-nums">{formatBRL(bestPick.totalCost, true)}</p>
          </div> : <p className="mt-2 text-sm text-zinc-400">Nenhuma sugestão disponível para este saldo.</p>}
        </div>
        <details className="mt-4 border-t border-white/[0.06] pt-3">
          <summary className="cursor-pointer py-2 text-xs font-semibold text-[#f5b800]">Ajustar orçamento e ver cesta</summary>
          <div className="mt-3 space-y-4 text-xs text-zinc-400">
            <p>Aportado no mês: <span className="text-white tabular-nums">{formatBRL(currentMonthInvested, true)} / {formatBRL(monthlyTarget, true)}</span></p>
            {totalMonthlyDividends > 0 && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={reinvestDividends} onChange={(event) => setReinvestDividends(event.target.checked)} className="h-5 w-5 accent-[#f5b800]" />Reinvestir proventos ({formatBRL(totalMonthlyDividends, true)})</label>}
            <p className="leading-relaxed">{recommendation.strategyExplanation}</p>
            {recommendation.items.map((item) => <div key={item.ticker} className="rounded-xl bg-[#1c1c1f] p-3">
              <div className="flex flex-wrap justify-between gap-2"><strong className="text-white">{item.ticker} · {item.shares} unidades</strong><span className="tabular-nums">{formatBRL(item.totalCost, true)}</span></div>
              <p className="mt-1 leading-relaxed">{item.reason}</p><p className="mt-2 tabular-nums">Renda estimada: +{formatBRL(item.estimatedMonthlyIncome, true)}/mês</p>
            </div>)}
            {recommendation.unallocatedCash > 0 && <div><p>Saldo da cesta: <span className="tabular-nums">{formatBRL(recommendation.unallocatedCash, true)}</span> · {targetCaixinhaLabel}</p>{onOpenAddFixedIncome && <button type="button" onClick={onOpenAddFixedIncome} className="min-h-11 font-semibold text-[#f5b800]">Guardar saldo</button>}</div>}
            <p>Total sugerido: <span className="text-white tabular-nums">{formatBRL(recommendation.totalSuggestedCost, true)}</span></p>
            {onOpenB3Modal && <button type="button" onClick={onOpenB3Modal} className="min-h-11 font-semibold text-[#f5b800]">Importar compras da B3</button>}
          </div>
        </details>
      </section>
      <h3 className="px-1 text-base font-bold text-white">Radar de oportunidades</h3>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Filtrar ativos">
        {[
          { id: 'TODOS', label: 'Todos' }, { id: 'OPORTUNIDADES', label: 'Oportunidades' },
          { id: 'HIGH_GRADE', label: 'High Grade' }, { id: 'ACOES', label: 'Ações' },
          { id: 'SO_FIIS', label: 'FIIs' }, { id: 'DATA_COM', label: 'Data-Com próxima' },
          { id: 'BASE_10', label: 'Base 10' }, { id: 'PAPEL', label: 'Papel' },
          { id: 'TIJOLO', label: 'Tijolo' }, { id: 'FIAGRO', label: 'Fiagro' },
        ].map((chip) => <button key={chip.id} type="button" onClick={() => setFilterSegment(chip.id)} aria-pressed={filterSegment === chip.id} className={`min-h-11 shrink-0 rounded-full border px-3.5 text-xs font-semibold ${filterSegment === chip.id ? 'border-white/20 bg-white/10 text-white' : 'border-white/[0.06] bg-[#121215] text-zinc-400'}`}>
          {chip.label} · <span className="tabular-nums">{evaluatedFiis.filter((fii) => matchesFilter(fii, chip.id)).length}</span>
        </button>)}
      </div>
      <div className="space-y-3">
        {filteredFiis.map((fii) => <article key={fii.ticker} className="rounded-[20px] border border-white/[0.06] bg-[#121215] p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold text-white">{fii.ticker}</h3><span className="text-base font-semibold text-white tabular-nums">{formatBRL(fii.currentPrice)}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><span className="text-zinc-500">P/VP</span><strong className="ml-2 font-semibold text-zinc-200 tabular-nums">{fii.pvp.toFixed(2).replace('.', ',')}</strong></div><div><span className="text-zinc-500">DY 12m</span><strong className="ml-2 font-semibold text-zinc-200 tabular-nums">{fii.annualYieldPercent.toFixed(2).replace('.', ',')}%</strong></div></div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">{fii.qualityWarnings.length > 0 ? 'Indicadores exigem atenção; consulte os alertas na análise.' : fii.rebalancesPortfolio ? 'Contribui para o equilíbrio da sua carteira.' : fii.status === 'OPPORTUNITY' ? 'Cotação abaixo do valor patrimonial de referência.' : fii.status === 'EXPENSIVE' ? 'Cotação acima do valor patrimonial de referência.' : 'Cotação próxima do valor patrimonial de referência.'}</p>
          <details className="mt-2 border-t border-white/[0.06]">
            <summary className="cursor-pointer py-3 text-xs font-semibold text-[#f5b800]">Ver análise</summary>
            <div className="space-y-3 text-xs text-zinc-400">
              <p>{fii.name} · {fii.segment}</p><p>{fii.qualityBadgeLabel}</p>
              <dl className="space-y-2">
                {[['Valor patrimonial', formatBRL(fii.vp)], ['Preço-teto', formatBRL(fii.ceilingPrice)], ['Provento estimado', formatBRL(fii.monthlyDividend)], ['Renda mensal estimada', `${fii.monthlyYieldPercent}%`], ['Gestão', fii.management], ['Diversificação', fii.diversification]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="text-right text-zinc-200 tabular-nums">{value}</dd></div>)}
              </dl>
              {fii.isYieldNormalized && <p>Provento normalizado para reduzir o efeito de pagamentos não recorrentes.</p>}
              {fii.isBelowAveragePrice && <p>Cotação abaixo do seu preço médio.</p>}
              {fii.daysUntilExDate <= 5 && <p>Data-Com de referência: {fii.daysUntilExDate === 0 ? 'hoje' : `em ${fii.daysUntilExDate} dias`}.</p>}
              {fii.qualityWarnings.length > 0 && <ul className="space-y-1 rounded-xl border border-amber-300/20 p-3 text-amber-200">{fii.qualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
              <p className="leading-relaxed">{fii.rationale}</p><p className="leading-relaxed">{fii.thesis}</p>
              {onOpenBuyModal && <button type="button" onClick={() => { triggerHaptic('light'); onOpenBuyModal(fii.ticker); }} className="min-h-11 w-full rounded-full bg-[#f5b800] font-semibold text-black">Aportar em {fii.ticker}</button>}
            </div>
          </details>
        </article>)}
        {filteredFiis.length === 0 && <p className="p-5 text-center text-sm text-zinc-500">Nenhum ativo neste filtro.</p>}
      </div>
    </div>
  );
}
