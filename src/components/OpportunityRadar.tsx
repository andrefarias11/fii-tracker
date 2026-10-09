'use client';

import { useState } from 'react';
import {
  Compass,
  Sparkles,
  TrendingUp,
  Percent,
  CheckCircle2,
  Plus,
  Coins,
  ShieldCheck,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { QuoteData, Transaction } from '../types/portfolio';
import {
  evaluateAllFiis,
  generateDailyRecommendation,
  EvaluatedFii,
  RecommendedBasketItem,
} from '../lib/recommendationEngine';
import confetti from 'canvas-confetti';

interface OpportunityRadarProps {
  quotes: Record<string, QuoteData>;
  monthlyTarget: number;
  currentMonthInvested: number;
  onOpenAddModalWithTicker: (ticker: string) => void;
  onImportTransactions: (newTransactions: Transaction[], replaceAll: boolean) => Promise<void>;
}

export function OpportunityRadar({
  quotes,
  monthlyTarget,
  currentMonthInvested,
  onOpenAddModalWithTicker,
  onImportTransactions,
}: OpportunityRadarProps) {
  const [filterSegment, setFilterSegment] = useState<string>('TODOS');
  const [isApplyingRecommendation, setIsApplyingRecommendation] = useState<boolean>(false);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  // Avaliação dos fundos e cálculo da cesta do dia
  const evaluatedFiis = evaluateAllFiis(quotes);
  const remainingBudget = Math.max(0, monthlyTarget - currentMonthInvested);
  const recommendation = generateDailyRecommendation(remainingBudget, evaluatedFiis);

  // Filtragem da lista
  const filteredFiis = evaluatedFiis.filter((fii) => {
    if (filterSegment === 'OPORTUNIDADES') return fii.status === 'OPPORTUNITY';
    if (filterSegment === 'BASE_10') return fii.base === 10;
    if (filterSegment === 'PAPEL') return fii.segment.includes('Papel');
    if (filterSegment === 'TIJOLO') return fii.segment.includes('Tijolo');
    if (filterSegment === 'FIAGRO') return fii.segment.includes('Fiagro');
    return true;
  });

  const handleApplyBasket = async (items: RecommendedBasketItem[]) => {
    if (items.length === 0) return;

    setIsApplyingRecommendation(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const newTransactions: Transaction[] = items.map((item, idx) => ({
        id: `rec-${Date.now()}-${idx}`,
        ticker: item.ticker,
        date: today,
        shares: item.shares,
        price: item.currentPrice,
        total: item.totalCost,
        broker: 'XP Investimentos',
        notes: `Aporte do Radar (${item.reason})`
      }));

      await onImportTransactions(newTransactions, false);

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#059669', '#38bdf8', '#fbbf24'],
      });

      setAppliedMessage('Aporte sugerido registrado com sucesso na sua carteira!');
      setTimeout(() => setAppliedMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao aplicar recomendação:', err);
      alert('Erro ao registrar aporte.');
    } finally {
      setIsApplyingRecommendation(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. CARD DA RECOMENDAÇÃO DO DIA PARA O SALDO RESTANTE */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/40 border border-emerald-500/30 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                Alocação Inteligente do Mês
              </h2>
              <p className="text-[11px] text-zinc-400">
                Onde colocar o saldo restante dos seus R$ {monthlyTarget.toFixed(2)}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            XP Investimentos
          </span>
        </div>

        {/* Resumo do Orçamento */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 mb-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400 block">Saldo Restante Deste Mês</span>
            <span className="text-xl font-extrabold text-white">
              {formatBRL(remainingBudget)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-zinc-400 block">Aportado até agora</span>
            <span className="text-xs font-semibold text-emerald-400">
              {formatBRL(currentMonthInvested)} / {formatBRL(monthlyTarget)}
            </span>
          </div>
        </div>

        {/* Explicação da Estratégia */}
        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          {recommendation.strategyExplanation}
        </p>

        {appliedMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {appliedMessage}
          </div>
        )}

        {/* Cesta de Compras Recomendada */}
        {recommendation.items.length > 0 && (
          <div className="space-y-2 mb-4">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Cesta Sugerida para Comprar Hoje:</span>
              <span className="text-emerald-400 font-semibold font-mono">
                {formatBRL(recommendation.totalSuggestedCost)}
              </span>
            </div>

            {recommendation.items.map((item) => (
              <div
                key={item.ticker}
                className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-extrabold text-sm text-white">{item.ticker}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      Base {item.base}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {item.shares} {item.shares === 1 ? 'cota' : 'cotas'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">{item.reason}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-white">{formatBRL(item.totalCost)}</div>
                  <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-1">
                    <Coins className="w-3 h-3" />
                    +{formatBRL(item.estimatedMonthlyIncome)}/mês
                  </div>
                </div>
              </div>
            ))}

            {/* Troco */}
            {recommendation.unallocatedCash > 0 && (
              <div className="text-[11px] text-zinc-400 text-right pr-1">
                Troco não alocado que fica na conta da XP:{' '}
                <strong className="text-zinc-200">{formatBRL(recommendation.unallocatedCash)}</strong>
              </div>
            )}

            {/* Botão de Registro Rápido */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleApplyBasket(recommendation.items)}
                disabled={isApplyingRecommendation}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-zinc-950 font-extrabold text-xs flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isApplyingRecommendation
                  ? 'Registrando compras...'
                  : 'Registrar Esse Aporte na Minha Carteira'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. RADAR DE TODOS OS FIIS MONITORADOS */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Scanner de FIIs da Bolsa</h3>
          </div>
          <span className="text-[11px] text-zinc-400">P/VP e Yield em tempo real</span>
        </div>

        {/* Filtros em Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'OPORTUNIDADES', label: '🔥 Descontados' },
            { id: 'BASE_10', label: 'Base 10 (R$ ~10)' },
            { id: 'PAPEL', label: 'Papel (CRI)' },
            { id: 'TIJOLO', label: 'Tijolo' },
            { id: 'FIAGRO', label: 'Fiagro' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilterSegment(chip.id)}
              className={`text-xs px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${
                filterSegment === chip.id
                  ? 'bg-emerald-500 text-zinc-950 font-bold'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Lista de FIIs com Análise Completa */}
        <div className="space-y-3">
          {filteredFiis.map((fii) => {
            const isOpportunity = fii.status === 'OPPORTUNITY';
            const isExpensive = fii.status === 'EXPENSIVE';

            return (
              <div
                key={fii.ticker}
                className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-4 shadow-sm hover:border-zinc-700 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-white">{fii.ticker}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                        {fii.segment}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                        Base {fii.base}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 truncate max-w-[200px]">{fii.name}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-bold text-white">{formatBRL(fii.currentPrice)}</div>
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOpportunity
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : isExpensive
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
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

                {/* Métricas Chave */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 mb-3 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">VP por Cota</span>
                    <span className="font-semibold text-zinc-300">{formatBRL(fii.vp)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Dividend Yield</span>
                    <span className="font-bold text-emerald-400">{fii.annualYieldPercent}% a.a.</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Rendimento/mês</span>
                    <span className="font-semibold text-white">{formatBRL(fii.monthlyDividend)}</span>
                  </div>
                </div>

                {/* Caixa do Racional Analítico */}
                <div
                  className={`p-3 rounded-2xl mb-3 text-xs leading-relaxed ${
                    isOpportunity
                      ? 'bg-emerald-950/25 border border-emerald-800/30 text-emerald-200'
                      : isExpensive
                      ? 'bg-rose-950/20 border border-rose-800/30 text-rose-200'
                      : 'bg-zinc-950/70 border border-zinc-800/70 text-zinc-300'
                  }`}
                >
                  <p>{fii.rationale}</p>
                </div>

                {/* Rodapé com Gestão e Ação */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-zinc-500 truncate max-w-[190px]">
                    🛡️ {fii.management}
                  </span>

                  <button
                    type="button"
                    onClick={() => onOpenAddModalWithTicker(fii.ticker)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-emerald-600 hover:text-white text-zinc-200 text-xs font-semibold active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aportar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

