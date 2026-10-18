'use client';

import { useState } from 'react';
import {
  Compass,
  Sparkles,
  FileSpreadsheet,
  Coins,
  Snowflake,
  Scale,
  Zap,
  PiggyBank,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
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
  const filteredFiis = evaluatedFiis.filter((fii) => {
    if (filterSegment === 'HIGH_GRADE') return fii.qualityTier === 'HIGH_GRADE';
    if (filterSegment === 'OPORTUNIDADES') return fii.status === 'OPPORTUNITY';
    if (filterSegment === 'ACOES') return fii.assetClass === 'ACAO';
    if (filterSegment === 'SO_FIIS') return fii.assetClass !== 'ACAO';
    if (filterSegment === 'DATA_COM') return fii.daysUntilExDate <= 5;
    if (filterSegment === 'BASE_10') return fii.assetClass !== 'ACAO' && fii.base === 10;
    if (filterSegment === 'PAPEL') return fii.segment.includes('Papel');
    if (filterSegment === 'TIJOLO') return fii.segment.includes('Tijolo');
    if (filterSegment === 'FIAGRO') return fii.segment.includes('Fiagro');
    return true;
  });

  return (
    <div className="space-y-5">
      {/* 1. CARD DA RECOMENDAÇÃO DO DIA PARA O SALDO RESTANTE */}
      <div className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center text-white shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Alocação Inteligente do Mês
              </h2>
              <p className="text-[11px] text-zinc-400 uppercase tracking-wide mt-0.5">
                SUGESTÃO COM BASE NA SUA CARTEIRA
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Estratégia (Equilibrar vs Bola de Neve) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#141416] border border-white/[0.04] mb-4">
          <button
            type="button"
            onClick={() => setStrategyMode('balanced')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              strategyMode === 'balanced'
                ? 'bg-[#2b2512] text-[#f5b800]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Equilibrar Carteira
          </button>

          <button
            type="button"
            onClick={() => setStrategyMode('snowball')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              strategyMode === 'snowball'
                ? 'bg-[#2b2512] text-[#f5b800]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Snowflake className="w-3.5 h-3.5" />
            Turbo Bola de Neve
          </button>
        </div>

        {/* Resumo do Orçamento + Toggle de Reinvestimento */}
        <div className="p-4 rounded-2xl bg-[#141416] mb-3.5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Poder de compra disponível</span>
            <span className="text-base font-bold text-white tabular-nums">
              {formatBRL(remainingBudget)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Aportado no mês</span>
            <span className="text-white font-medium tabular-nums">
              {formatBRL(currentMonthInvested)}{' '}
              <span className="text-zinc-500">/ {formatBRL(monthlyTarget)}</span>
            </span>
          </div>

          {totalMonthlyDividends > 0 && (
            <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-[#f5b800]" />
                Reinvestir proventos (<span className="tabular-nums text-white">{formatBRL(totalMonthlyDividends)}</span>)
              </span>
              <button
                type="button"
                onClick={() => setReinvestDividends(!reinvestDividends)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                  reinvestDividends
                    ? 'bg-[#f5b800] text-zinc-950'
                    : 'bg-[#2b2512] text-[#f5b800]'
                }`}
              >
                {reinvestDividends ? 'Ativado' : '+ Somar'}
              </button>
            </div>
          )}
        </div>

        {/* Explicação da Estratégia */}
        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          {recommendation.strategyExplanation}
        </p>

        {/* Cesta de Compras Recomendada */}
        {recommendation.items.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Cesta sugerida hoje</span>
              <span className="text-[#f5b800] font-bold tabular-nums">
                {formatBRL(recommendation.totalSuggestedCost)}
              </span>
            </div>

            {recommendation.items.map((item) => {
              const isStockItem = item.segment.includes('Ações');
              return (
                <div
                  key={item.ticker}
                  className="p-3.5 rounded-2xl bg-[#141416] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-sm text-white">{item.ticker}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]">
                        {isStockItem ? 'Ação' : `Base ${item.base}`}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                        {item.qualityBadgeLabel}
                      </span>
                      <span className="text-xs font-bold text-emerald-400 tabular-nums">
                        +{item.shares}{' '}
                        {isStockItem
                          ? item.shares === 1
                            ? 'ação'
                            : 'ações'
                          : item.shares === 1
                          ? 'cota'
                          : 'cotas'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{item.reason}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-white tabular-nums">
                      {formatBRL(item.totalCost)}
                    </div>
                    <div className="text-[11px] text-emerald-400 font-medium tabular-nums">
                      ▲ +{formatBRL(item.estimatedMonthlyIncome)}/mês
                    </div>
                  </div>
                </div>
              );
            })}

            {recommendation.unallocatedCash > 0 && (
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/[0.04] flex items-start gap-3 my-2">
                <div className="w-8 h-8 rounded-lg border border-white/60 flex items-center justify-center shrink-0 mt-0.5 text-white">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                      Troco Inteligente
                    </span>
                    <span className="text-[10px] font-bold text-[#f5b800] bg-[#2b2512] px-2 py-0.5 rounded-full">
                      100% CDI
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Sobrou{' '}
                    <strong className="text-white font-bold tabular-nums">
                      {formatBRL(recommendation.unallocatedCash)}
                    </strong>
                    ? Guarde na{' '}
                    <strong className="text-zinc-100 font-semibold">
                      {targetCaixinhaLabel}
                    </strong>{' '}
                    rendendo juros diários até o próximo aporte.
                  </p>
                  {onOpenAddFixedIncome && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        onOpenAddFixedIncome();
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#f5b800] hover:opacity-80 active:scale-95 transition-all"
                    >
                      Guardar na Caixinha <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {onOpenB3Modal && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenB3Modal}
                  className="w-full py-2.5 px-4 rounded-full bg-[#2b2512] text-[#f5b800] font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Já comprei na corretora → Importar B3
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. RADAR DE TODOS OS FIIS & AÇÕES MONITORADOS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-[#f5b800]" />
            <h3 className="text-base font-bold text-white">
              Scanner B3 ({filteredFiis.length})
            </h3>
          </div>
          <span className="text-xs text-zinc-400">P/VP e Preço-Teto</span>
        </div>

        {/* Filtros em Pílulas Estilo XP */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'HIGH_GRADE', label: 'High Grade 5★' },
            { id: 'OPORTUNIDADES', label: 'Descontados' },
            { id: 'ACOES', label: 'Ações' },
            { id: 'SO_FIIS', label: 'Só FIIs' },
            { id: 'DATA_COM', label: 'Data-Com Próxima' },
            { id: 'BASE_10', label: 'Base 10' },
            { id: 'PAPEL', label: 'Papel (CRI)' },
            { id: 'TIJOLO', label: 'Tijolo' },
            { id: 'FIAGRO', label: 'Fiagro' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilterSegment(chip.id)}
              className={`text-xs px-3.5 py-1.5 rounded-full whitespace-nowrap font-bold transition-all ${
                filterSegment === chip.id
                  ? 'bg-[#f5b800] text-zinc-950'
                  : 'bg-[#1c1c1e] text-zinc-300 hover:text-white'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Lista de Ativos no Molde "Meus ativos" da XP */}
        <div className="space-y-4">
          {filteredFiis.map((fii) => {
            const isStock = fii.assetClass === 'ACAO';
            const isOpportunity = fii.status === 'OPPORTUNITY';
            const isExpensive = fii.status === 'EXPENSIVE';
            const isExDateSoon = fii.daysUntilExDate <= 5;

            return (
              <div
                key={fii.ticker}
                className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] p-5"
              >
                {/* Topo do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center shrink-0 text-white">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-white leading-tight">
                          {fii.ticker}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]">
                          {fii.segment}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            fii.qualityTier === 'HIGH_GRADE'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : fii.qualityTier === 'ALERTA_RISCO'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                              : 'bg-white/[0.06] text-zinc-300'
                          }`}
                        >
                          {fii.qualityBadgeLabel}
                        </span>
                        {fii.isBelowAveragePrice && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                            Abaixo do PM
                          </span>
                        )}
                        {isExDateSoon && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.08] text-white">
                            <Zap className="w-3 h-3 text-[#f5b800]" />
                            {fii.daysUntilExDate === 0
                              ? 'Data-Com hoje!'
                              : `Data-Com em ${fii.daysUntilExDate}d`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 uppercase tracking-wide truncate mt-0.5">
                        {fii.name.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Corpo Key-Value Limpo Estilo XP */}
                <div className="space-y-2.5 mt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Cotação atual</span>
                    <span className="text-white font-bold tabular-nums">
                      {formatBRL(fii.currentPrice)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">P/VP atual</span>
                    <span
                      className={`font-medium tabular-nums ${
                        isOpportunity
                          ? 'text-emerald-400'
                          : isExpensive
                          ? 'text-rose-400'
                          : 'text-white'
                      }`}
                    >
                      {fii.pvp.toFixed(2).replace('.', ',')}{' '}
                      {fii.discountPercent > 0
                        ? `(▼ -${fii.discountPercent}% desc.)`
                        : fii.discountPercent < 0
                        ? `(▲ +${Math.abs(fii.discountPercent)}% ágio)`
                        : '(Justo)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">
                      {isStock ? 'VPA / Ação' : 'Valor patrimonial (VP)'}
                    </span>
                    <span className="text-white font-medium tabular-nums">
                      {formatBRL(fii.vp)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">
                      {isStock ? 'Preço-Teto Barsi (6%)' : 'Preço-Teto (0,9% a.m.)'}
                    </span>
                    <span className="text-[#f5b800] font-semibold tabular-nums">
                      {formatBRL(fii.ceilingPrice)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">
                      {fii.isYieldNormalized ? 'Provento recorrente (travado)' : 'Provento estimado'}
                    </span>
                    <span className="text-emerald-400 font-medium tabular-nums">
                      +{formatBRL(fii.monthlyDividend)} ({fii.monthlyYieldPercent.toFixed(2).replace('.', ',')}% a.m.)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Dividend Yield (12m)</span>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      ▲ {fii.annualYieldPercent.toFixed(2).replace('.', ',')}% a.a.
                    </span>
                  </div>
                </div>

                {/* Alertas de Blindagem Anti-Cilada (se acionados) */}
                {fii.qualityWarnings.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-[#2b2512]/70 border border-[#f5b800]/30 text-[11px] text-[#f5b800] space-y-1">
                    {fii.qualityWarnings.map((w, idx) => (
                      <p key={idx} className="leading-relaxed">
                        • {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Resumo Racional */}
                <div className="mt-3 p-3 rounded-xl bg-[#141416] text-xs text-zinc-300 leading-relaxed">
                  {fii.rationale}
                </div>

                {onOpenBuyModal && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        onOpenBuyModal(fii.ticker);
                      }}
                      className="w-full py-2.5 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold text-center active:scale-95 transition-all"
                    >
                      Aportar em {fii.ticker}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
