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
    <div className="space-y-4">
      {/* 1. CARD DA RECOMENDAÇÃO DO DIA PARA O SALDO RESTANTE */}
      <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                Alocação Inteligente do Mês
              </h2>
              <p className="text-[11px] text-zinc-400">
                Sugestão calculada com base na sua carteira
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Estratégia (Equilibrar vs Bola de Neve) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-white/[0.025] mb-3">
          <button
            type="button"
            onClick={() => setStrategyMode('balanced')}
            className={`py-1.5 px-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
              strategyMode === 'balanced'
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Equilibrar Carteira
          </button>

          <button
            type="button"
            onClick={() => setStrategyMode('snowball')}
            className={`py-1.5 px-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
              strategyMode === 'snowball'
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Snowflake className="w-3.5 h-3.5" />
            Turbo Bola de Neve
          </button>
        </div>

        {/* Resumo do Orçamento + Toggle de Reinvestimento */}
        <div className="p-4 rounded-2xl bg-white/[0.025] mb-3.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 block mb-0.5">Poder de Compra Disponível</span>
              <span className="text-xl font-bold text-white tabular-nums">
                {formatBRL(remainingBudget)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-zinc-400 block mb-0.5">Aportado no mês</span>
              <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                {formatBRL(currentMonthInvested)} / {formatBRL(monthlyTarget)}
              </span>
            </div>
          </div>

          {totalMonthlyDividends > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                Reinvestir proventos do mês (<span className="tabular-nums">{formatBRL(totalMonthlyDividends)}</span>)
              </span>
              <button
                type="button"
                onClick={() => setReinvestDividends(!reinvestDividends)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                  reinvestDividends
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]'
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
          <div className="space-y-2 mb-2">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Cesta Sugerida Hoje:</span>
              <span className="text-emerald-400 font-semibold tabular-nums">
                {formatBRL(recommendation.totalSuggestedCost)}
              </span>
            </div>

            {recommendation.items.map((item) => {
              const isStockItem = item.segment.includes('Ações');
              return (
                <div
                  key={item.ticker}
                  className="p-3.5 rounded-2xl bg-white/[0.025] flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-white">{item.ticker}</span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.06]">
                        {isStockItem ? 'Ação' : `Base ${item.base}`}
                      </span>
                      <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                        {item.shares}{' '}
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
                    <div className="text-xs font-bold text-white tabular-nums">{formatBRL(item.totalCost)}</div>
                    <div className="text-[11px] text-emerald-400 flex items-center justify-end gap-1 tabular-nums">
                      <Coins className="w-3 h-3" />
                      +{formatBRL(item.estimatedMonthlyIncome)}/mês
                    </div>
                  </div>
                </div>
              );
            })}

            {recommendation.unallocatedCash > 0 && (
              <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex items-start gap-3 my-2.5 animate-in fade-in duration-200">
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5 text-zinc-300">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      Sugestão de Troco Inteligente
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
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
                    rendendo juros diários até o próximo aporte!
                  </p>
                  {onOpenAddFixedIncome && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        onOpenAddFixedIncome();
                      }}
                      className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 active:scale-95 transition-all"
                    >
                      Guardar na Caixinha agora <ArrowRight className="w-3 h-3" />
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
                  className="w-full py-3 px-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Já comprei na corretora → Importar Planilha B3
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. RADAR DE TODOS OS FIIS & AÇÕES MONITORADOS */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Scanner B3</h3>
              <p className="text-[11px] text-zinc-400">P/VP e Preço-Teto em tempo real</p>
            </div>
          </div>
        </div>

        {/* Filtros em Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'TODOS', label: 'Todos' },
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
              className={`text-xs px-3.5 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${
                filterSegment === chip.id
                  ? 'bg-emerald-500 text-zinc-950 font-bold'
                  : 'bg-[#121215] border border-white/[0.06] text-zinc-400 hover:text-white'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Lista de Ativos com Análise Enxuta e Intuitiva */}
        <div className="space-y-2.5">
          {filteredFiis.map((fii) => {
            const isStock = fii.assetClass === 'ACAO';
            const isOpportunity = fii.status === 'OPPORTUNITY';
            const isExpensive = fii.status === 'EXPENSIVE';
            const isExDateSoon = fii.daysUntilExDate <= 5;

            return (
              <div
                key={fii.ticker}
                className="rounded-[22px] bg-[#121215] border border-white/[0.06] p-4 shadow-sm hover:border-white/[0.12] transition-all"
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base font-bold text-white">{fii.ticker}</span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-300 border border-white/[0.06]">
                        {fii.segment}
                      </span>
                      {fii.isBelowAveragePrice && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Abaixo do PM
                        </span>
                      )}
                      {isExDateSoon && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300">
                          <Zap className="w-3 h-3 text-emerald-400" />
                          {fii.daysUntilExDate === 0
                            ? `Data-Com hoje! (dia ${fii.announcementDay})`
                            : `Data-Com em ${fii.daysUntilExDate}d (dia ${fii.announcementDay})`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 truncate flex-1 min-w-0 mt-0.5">
                      {fii.name}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-bold text-white tabular-nums">{formatBRL(fii.currentPrice)}</div>
                    <span
                      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                        isOpportunity
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isExpensive
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06]'
                      }`}
                    >
                      P/VP {fii.pvp}{' '}
                      {fii.discountPercent > 0
                        ? `(-${fii.discountPercent}%)`
                        : fii.discountPercent < 0
                        ? `(+${Math.abs(fii.discountPercent)}%)`
                        : ''}
                    </span>
                  </div>
                </div>

                {/* Métricas Chave (VP/VPA, Yield e Preço Teto) */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.025] mb-2.5 text-center text-xs">
                  <div className="min-w-0">
                    <span className="text-[11px] text-zinc-500 block truncate mb-0.5">
                      {isStock ? 'VPA / Ação' : 'VP / Cota'}
                    </span>
                    <span className="font-semibold text-zinc-300 block truncate tabular-nums">{formatBRL(fii.vp)}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] text-zinc-500 block truncate mb-0.5">Yield Anual</span>
                    <span className="font-bold text-emerald-400 block truncate tabular-nums">{fii.annualYieldPercent}% a.a.</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] text-zinc-500 block truncate mb-0.5">
                      {isStock ? 'Teto Barsi (6%)' : 'Preço Teto (0,9%)'}
                    </span>
                    <span className="font-semibold text-zinc-200 block truncate tabular-nums">{formatBRL(fii.ceilingPrice)}</span>
                  </div>
                </div>

                {/* Resumo direto + Ação */}
                <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                  {fii.rationale}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05] gap-2">
                  <span className="text-[11px] text-zinc-500 truncate flex-1 min-w-0">
                    {fii.management} • <span className="tabular-nums">{formatBRL(fii.monthlyDividend)}</span>/{isStock ? 'mês eq.' : 'cota'}
                  </span>

                  <span className="text-[11px] font-semibold text-emerald-400 shrink-0 tabular-nums">
                    Yield {fii.monthlyYieldPercent}% a.m.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


