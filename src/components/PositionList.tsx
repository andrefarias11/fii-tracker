'use client';

import { useState } from 'react';
import { FiiPosition } from '../types/portfolio';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Edit2,
  Check,
  X,
  ChevronDown,
  FileSpreadsheet,
} from 'lucide-react';

interface PositionListProps {
  positions: FiiPosition[];
  isPrivacyMode?: boolean;
  onOpenAddModalWithTicker: (ticker: string) => void;
  onUpdateDividend: (ticker: string, dividend: number) => void;
  onOpenB3Modal?: () => void;
}

const formatShortSegment = (segment: string): string => {
  const map: Record<string, string> = {
    'Tijolo - Logística': 'Logística',
    'Tijolo - Shopping': 'Shopping',
    'Tijolo - Renda Urbana': 'Renda Urbana',
    'Tijolo - Lajes': 'Lajes',
    'Papel (CRI)': 'Papel',
    'Fundo de Fundos': 'FOF',
  };
  return map[segment] || segment;
};

export function PositionList({
  positions,
  isPrivacyMode = false,
  onOpenAddModalWithTicker,
  onUpdateDividend,
  onOpenB3Modal,
}: PositionListProps) {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [dividendInput, setDividendInput] = useState<string>('');

  const formatBRL = (val: number, allowInPrivacy = false) => {
    if (isPrivacyMode && !allowInPrivacy) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const handleToggleExpand = (ticker: string) => {
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

  if (positions.length === 0) {
    return (
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-7 text-center space-y-4">
        <div>
          <p className="text-sm font-semibold text-zinc-200 mb-1">
            Nenhum fundo imobiliário na carteira ainda
          </p>
          <p className="text-xs text-zinc-400">
            Comece registrando sua primeira compra na XP ou importe seu extrato da B3.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2.5">
          <button
            onClick={() => onOpenAddModalWithTicker('')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-500 text-zinc-950 font-bold text-xs active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Novo Aporte
          </button>
          {onOpenB3Modal && (
            <button
              onClick={onOpenB3Modal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-zinc-800 border border-zinc-700 text-sky-400 font-semibold text-xs active:scale-95 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Importar B3
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          Meus Ativos
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
            {positions.length}
          </span>
        </h3>

        <div className="flex items-center gap-2">
          {onOpenB3Modal && (
            <button
              onClick={onOpenB3Modal}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-xl active:scale-95 transition-all"
            >
              <FileSpreadsheet className="w-3 h-3" />
              Importar B3
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {positions.map((pos) => {
          const isProfitable = pos.profitLoss >= 0;
          const isDailyUp = (pos.dailyChangePercent || 0) >= 0;
          const isExpanded = expandedTicker === pos.ticker;
          const isEditingThis = editingTicker === pos.ticker;
          const isBelowAverage = pos.currentPrice < pos.averagePrice;

          return (
            <div
              key={pos.ticker}
              className={`rounded-3xl bg-zinc-900 border transition-all ${
                isExpanded
                  ? 'border-zinc-700 shadow-lg'
                  : 'border-zinc-800/80 hover:border-zinc-700/80'
              }`}
            >
              {/* Cabeçalho Enxuto (Sempre Visível - Toque para expandir) */}
              <div
                onClick={() => handleToggleExpand(pos.ticker)}
                className="p-4 cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-base font-extrabold text-white tracking-wide">
                      {pos.ticker}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                      {formatShortSegment(pos.segment)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        pos.pvp < 1
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : pos.pvp <= 1.03
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      }`}
                      title={`Valor Patrimonial: ${formatBRL(pos.vp, true)}`}
                    >
                      P/VP {pos.pvp}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-zinc-300">
                      {isPrivacyMode ? '•• cotas' : `${pos.totalShares} ${pos.totalShares === 1 ? 'cota' : 'cotas'}`}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-emerald-400 font-semibold">
                      Div: {formatBRL(pos.totalMonthlyDividend)}/mês
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-white">
                      {formatBRL(pos.currentTotal)}
                    </div>
                    <div
                      className={`text-[11px] font-semibold inline-flex items-center justify-end gap-0.5 ${
                        isProfitable ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isProfitable ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>
                        {isProfitable ? '+' : ''}
                        {pos.profitLossPercent}%
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-7 h-7 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-white bg-zinc-800' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Painel Expandido (Progressive Disclosure) */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                    <span className="truncate">{pos.name}</span>
                    {isBelowAverage && (
                      <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full shrink-0 ml-2">
                        Abaixo do seu PM
                      </span>
                    )}
                  </div>

                  {/* Grade de Detalhes 2x2 */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/60 text-xs">
                    <div>
                      <span className="text-zinc-500 block text-[11px]">Cotação Atual (B3)</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-white font-bold">{formatBRL(pos.currentPrice, true)}</span>
                        {pos.dailyChangePercent !== undefined && (
                          <span
                            className={`text-[10px] font-semibold ${
                              isDailyUp ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            ({isDailyUp ? '+' : ''}
                            {pos.dailyChangePercent}%)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-zinc-500 block text-[11px]">Seu Preço Médio</span>
                      <span className="text-zinc-200 font-semibold block mt-0.5">
                        {formatBRL(pos.averagePrice, true)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/60">
                      <span className="text-zinc-500 block text-[11px]">Lucro / Prejuízo</span>
                      <span
                        className={`font-semibold block mt-0.5 ${
                          isProfitable ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfitable ? '+' : ''}
                        {formatBRL(pos.profitLoss)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/60 text-right">
                      <span className="text-zinc-500 block text-[11px]">Total Investido</span>
                      <span className="text-zinc-300 font-medium block mt-0.5">
                        {formatBRL(pos.totalInvested)}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Ações do Fundo: Editar Dividendo + Botão Aportar */}
                  <div className="flex items-center justify-between pt-0.5 gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-400">Div/cota:</span>
                      {isEditingThis ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-zinc-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={dividendInput}
                            onChange={(e) => setDividendInput(e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded bg-zinc-800 text-white text-xs border border-zinc-700 outline-none"
                            autoFocus
                          />
                          <button
                            onClick={(e) => handleSaveDividend(pos.ticker, e)}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTicker(null);
                            }}
                            className="p-1 text-zinc-500 hover:text-zinc-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap">
                          <strong className="text-xs font-semibold text-emerald-400">
                            {formatBRL(pos.monthlyDividendPerShare, true)}
                          </strong>
                          <span className="text-[10px] text-zinc-500">
                            (YoC {pos.yieldOnCostPercent}%)
                          </span>
                          <button
                            onClick={(e) => handleStartEdit(pos, e)}
                            aria-label="Editar dividendo"
                            className="p-1 text-zinc-500 hover:text-zinc-300"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAddModalWithTicker(pos.ticker);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 active:scale-95 transition-all text-xs font-bold shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Aportar em {pos.ticker}
                    </button>
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

