'use client';

import { useState, useMemo } from 'react';
import { FiiPosition } from '../types/portfolio';
import {
  Edit2,
  Check,
  X,
  ArrowUpDown,
  LineChart,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { triggerHaptic } from '../lib/haptic';

interface PositionListProps {
  positions: FiiPosition[];
  isPrivacyMode?: boolean;
  onUpdateDividend: (ticker: string, dividend: number) => void;
  onOpenB3Modal?: () => void;
  onOpenBuyModal?: (ticker: string) => void;
}

const formatShortSegment = (segment: string): string => {
  const map: Record<string, string> = {
    'Tijolo - Logística': 'Logística',
    'Tijolo - Shopping': 'Shopping',
    'Tijolo - Renda Urbana': 'Renda Urbana',
    'Tijolo - Lajes': 'Lajes',
    'Papel (CRI)': 'Papel',
    'Fundo de Fundos': 'FOF',
    'Ações - Bancos': 'Bancos',
    'Ações - Energia': 'Energia',
    'Ações - Saneamento': 'Saneamento',
    'Ações - Seguros': 'Seguros',
    'Ações - Commodities': 'Commodities',
    'Ações - Telecom & Indústria': 'Telecom/Ind.',
    'Ações - Outros': 'Ação B3',
  };
  return map[segment] || segment;
};

type SortKey = 'position' | 'result' | 'dividends';

export function PositionList({
  positions,
  isPrivacyMode = false,
  onUpdateDividend,
  onOpenB3Modal,
  onOpenBuyModal,
}: PositionListProps) {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [dividendInput, setDividendInput] = useState<string>('');
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'FII' | 'ACAO'>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('position');

  const formatBRL = (val: number, allowInPrivacy = false) => {
    if (isPrivacyMode && !allowInPrivacy) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const handleToggleExpand = (ticker: string) => {
    triggerHaptic('light');
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
    if (editingTicker && editingTicker !== ticker) {
      setEditingTicker(null);
    }
  };

  const handleStartEdit = (pos: FiiPosition, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTicker(pos.ticker);
    setDividendInput(pos.monthlyDividendPerShare.toString());
  };

  const handleSaveDividend = (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const val = parseFloat(dividendInput.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      onUpdateDividend(ticker, val);
    }
    setEditingTicker(null);
  };

  const handleCycleSort = () => {
    triggerHaptic('light');
    setSortBy((prev) => {
      if (prev === 'position') return 'result';
      if (prev === 'result') return 'dividends';
      return 'position';
    });
  };

  const fiisCount = positions.filter((p) => p.assetClass !== 'ACAO').length;
  const stocksCount = positions.filter((p) => p.assetClass === 'ACAO').length;
  const hasBothClasses = fiisCount > 0 && stocksCount > 0;

  const visiblePositions = useMemo(() => {
    return positions.filter((p) => {
      if (assetFilter === 'FII') return p.assetClass !== 'ACAO';
      if (assetFilter === 'ACAO') return p.assetClass === 'ACAO';
      return true;
    });
  }, [positions, assetFilter]);

  const sortedPositions = useMemo(() => {
    const list = [...visiblePositions];
    if (sortBy === 'position') {
      list.sort((a, b) => b.currentTotal - a.currentTotal);
    } else if (sortBy === 'result') {
      list.sort((a, b) => b.profitLoss - a.profitLoss);
    } else if (sortBy === 'dividends') {
      list.sort((a, b) => b.totalMonthlyDividend - a.totalMonthlyDividend);
    }
    return list;
  }, [visiblePositions, sortBy]);

  if (positions.length === 0) {
    return (
      <div className="bg-[#1c1c1e] rounded-[20px] p-8 text-center space-y-4 border border-white/[0.04]">
        <div>
          <p className="text-sm font-semibold text-zinc-200 mb-1">
            Sua carteira B3 está vazia
          </p>
          <p className="text-xs text-zinc-500">
            Importe seu extrato oficial da B3 (.xlsx) para consolidar seus FIIs e Ações e desbloquear as conquistas da Platina.
          </p>
        </div>
        {onOpenB3Modal && (
          <div className="flex items-center justify-center">
            <button
              onClick={onOpenB3Modal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#f5b800] text-zinc-950 font-bold text-xs active:scale-95 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
              Importar Planilha B3
            </button>
          </div>
        )}
      </div>
    );
  }

  const getSortLabel = () => {
    if (sortBy === 'position') return 'Posição';
    if (sortBy === 'result') return 'Resultado';
    return 'Proventos';
  };

  return (
    <div className="space-y-3">
      {/* Barra Superior: Meus ativos (N) à esquerda + Ordenar à direita */}
      <div className="flex items-center justify-between pt-1">
        <h3 className="text-base font-bold text-white tracking-tight">
          Meus ativos ({positions.length})
        </h3>

        <button
          type="button"
          onClick={handleCycleSort}
          className="flex items-center gap-1.5 text-sm font-medium text-white hover:text-zinc-200 active:scale-95 transition-all"
          title={`Ordenando por: ${getSortLabel()}`}
        >
          <span>Ordenar</span>
          <span className="text-xs font-semibold text-[#f5b800]">
            {getSortLabel()}
          </span>
          <ArrowUpDown className="w-4 h-4 text-[#f5b800]" />
        </button>
      </div>

      {/* Pílulas de filtro de classe (quando há FIIs e Ações) */}
      {hasBothClasses && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'ALL', label: `Todos (${positions.length})` },
            { id: 'FII', label: `FIIs (${fiisCount})` },
            { id: 'ACAO', label: `Ações (${stocksCount})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setAssetFilter(pill.id as 'ALL' | 'FII' | 'ACAO');
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                assetFilter === pill.id
                  ? 'bg-[#2b2512] text-[#f5b800] border border-[#f5b800]/40'
                  : 'bg-[#1c1c1e] text-zinc-400 hover:text-zinc-200 border border-white/[0.04]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}

      {/* Lista de Ativos no Molde Idêntico aos Cards Meus Ativos da XP */}
      <div className="space-y-4">
        {sortedPositions.map((pos) => {
          const isStock = pos.assetClass === 'ACAO';
          const isProfitable = pos.profitLoss >= 0;
          const isExpanded = expandedTicker === pos.ticker;
          const isEditingThis = editingTicker === pos.ticker;
          const unitLabel = isStock
            ? pos.totalShares === 1
              ? 'ação'
              : 'ações'
            : pos.totalShares === 1
            ? 'cota'
            : 'cotas';

          return (
            <div
              key={pos.ticker}
              className="bg-[#1c1c1e] rounded-[20px] p-5 border border-white/[0.04] transition-all"
            >
              {/* Topo do Card: Ícone gráfico em caixa contornada branca + Ticker e Nome em maiúsculas */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center shrink-0">
                    <LineChart className="w-4 h-4 text-white stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-bold text-white tracking-tight leading-tight">
                      {pos.ticker}
                    </div>
                    <div className="text-[11px] text-zinc-400 uppercase tracking-wide truncate mt-0.5">
                      {pos.name.toUpperCase()}
                    </div>
                  </div>
                </div>

                {pos.dailyChangePercent !== undefined && (
                  <div
                    className={`text-xs font-semibold tabular-nums shrink-0 ${
                      pos.dailyChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {pos.dailyChangePercent >= 0 ? '▲' : '▼'} {Math.abs(pos.dailyChangePercent)}%
                  </div>
                )}
              </div>

              {/* Corpo do Card: Tabela Key-Value limpa (6 linhas) */}
              <div className="space-y-2.5 mt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Quantidade</span>
                  <span className="text-white font-medium tabular-nums">
                    {isPrivacyMode ? '•••' : `${pos.totalShares} ${unitLabel}`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Preço médio</span>
                  <span className="text-white font-medium tabular-nums">
                    {formatBRL(pos.averagePrice, true)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Preço atual</span>
                  <span className="text-white font-medium tabular-nums">
                    {formatBRL(pos.currentPrice, true)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Posição</span>
                  <span className="text-white font-medium tabular-nums">
                    {formatBRL(pos.currentTotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Provento mensal</span>
                  <span className="text-emerald-400 font-medium tabular-nums">
                    +{formatBRL(pos.totalMonthlyDividend)} ({pos.yieldOnCostPercent}% a.m.)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Resultado total</span>
                  <span
                    className={`font-medium tabular-nums ${
                      isProfitable ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isProfitable ? '▲' : '▼'} {formatBRL(Math.abs(pos.profitLoss))} ({isProfitable ? '+' : ''}
                    {pos.profitLossPercent}%)
                  </span>
                </div>
              </div>

              {/* Base do Card: 2 Botões Pílula estilo XP */}
              <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => handleToggleExpand(pos.ticker)}
                  className="py-2.5 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold text-center active:scale-95 transition-all hover:bg-[#3d3318]"
                >
                  {isExpanded ? 'Ocultar' : 'Detalhes'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    if (onOpenBuyModal) {
                      onOpenBuyModal(pos.ticker);
                    } else if (onOpenB3Modal) {
                      onOpenB3Modal();
                    }
                  }}
                  className="py-2.5 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold text-center active:scale-95 transition-all hover:bg-[#e5ac00]"
                >
                  Aportar
                </button>
              </div>

              {/* Detalhes expandidos: Indicadores extras FII Tracker */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3 animate-in fade-in duration-150">
                  {/* Badges de Indicadores */}
                  <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.04] text-zinc-300 border border-white/[0.06] tabular-nums">
                        P/VP {pos.pvp}
                      </span>
                      {pos.ceilingPrice > 0 && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.04] text-zinc-300 border border-white/[0.06] tabular-nums">
                          Teto {formatBRL(pos.ceilingPrice, true)}
                        </span>
                      )}
                      {pos.currentPrice < pos.averagePrice && (
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          Abaixo do PM
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                      {formatShortSegment(pos.segment)}
                    </span>
                  </div>

                  {/* Progresso do Número Mágico */}
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Número Mágico (Bola de Neve)
                      </span>
                      <span className="font-semibold text-emerald-400 tabular-nums">
                        {pos.magicProgressPercent}% ({pos.totalShares}/{pos.magicNumber} cotas)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, pos.magicProgressPercent)}%` }}
                      />
                    </div>
                  </div>

                  {/* Payback em Proventos (se houver) */}
                  {pos.paybackReceived !== undefined && pos.paybackReceived > 0 && (
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04] space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium">Payback em proventos</span>
                        <span className="font-semibold text-emerald-400 tabular-nums">
                          +{formatBRL(pos.paybackReceived)} ({pos.paybackPercent || 0}% do custo)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(2, pos.paybackPercent || 0))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Edição de Dividendo por Cota */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04] text-xs">
                    <span className="text-zinc-400">
                      {isStock ? 'Dividendo médio / ação:' : 'Rendimento por cota:'}
                    </span>
                    {isEditingThis ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={dividendInput}
                          onChange={(e) => setDividendInput(e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg bg-zinc-900 text-white text-xs border border-white/20 focus:border-[#f5b800] outline-none tabular-nums"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={(e) => handleSaveDividend(pos.ticker, e)}
                          className="p-1 rounded bg-[#f5b800] text-zinc-950 hover:bg-[#e5ac00]"
                          title="Salvar dividendo"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTicker(null);
                          }}
                          className="p-1 rounded bg-white/[0.06] text-zinc-400 hover:text-white"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-400 tabular-nums">
                          {formatBRL(pos.monthlyDividendPerShare, true)}
                        </span>
                        <span className="text-zinc-500 tabular-nums">
                          (YoC {pos.yieldOnCostPercent}%)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(pos, e)}
                          className="p-1 text-zinc-400 hover:text-[#f5b800] transition-colors"
                          title="Editar dividendo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
