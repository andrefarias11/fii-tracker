'use client';

import { useState } from 'react';
import { FiiPosition } from '../types/portfolio';
import {
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
      <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-8 text-center space-y-4">
        <div>
          <p className="text-sm font-semibold text-zinc-200 mb-1">
            Sua carteira está vazia
          </p>
          <p className="text-xs text-zinc-500">
            Registre seu primeiro aporte ou importe a planilha da B3.
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
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/[0.06] text-zinc-200 font-semibold text-xs active:scale-95 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-sky-400" />
              Importar B3
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {positions.map((pos) => {
        const isProfitable = pos.profitLoss >= 0;
        const isDailyUp = (pos.dailyChangePercent || 0) >= 0;
        const isExpanded = expandedTicker === pos.ticker;
        const isEditingThis = editingTicker === pos.ticker;
        const isBelowAverage = pos.currentPrice < pos.averagePrice;

        return (
          <div
            key={pos.ticker}
            className={`rounded-[24px] bg-[#121215] border transition-all ${
              isExpanded
                ? 'border-white/[0.15] shadow-xl'
                : 'border-white/[0.06] hover:border-white/[0.1]'
            }`}
          >
            {/* Linha Principal Limpa Estilo Apple Stocks / Nubank */}
            <div
              onClick={() => handleToggleExpand(pos.ticker)}
              className="p-4 cursor-pointer flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Ícone de Ticker Minimalista */}
                <div className="w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/[0.06] flex flex-col items-center justify-center shrink-0">
                  <span className="text-[11px] font-extrabold text-white tracking-tight leading-none">
                    {pos.ticker.slice(0, 4)}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400 mt-0.5 leading-none">
                    {pos.ticker.slice(4)}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-white tracking-tight">
                      {pos.ticker}
                    </span>
                    <span className="text-[10px] font-medium text-zinc-500 truncate">
                      {formatShortSegment(pos.segment)}
                    </span>
                    {pos.pvp < 1 && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400">
                        P/VP {pos.pvp}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                    <span>
                      {isPrivacyMode
                        ? '•• cotas'
                        : `${pos.totalShares} ${pos.totalShares === 1 ? 'cota' : 'cotas'}`}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-emerald-400/90 font-medium">
                      +{formatBRL(pos.totalMonthlyDividend)}/mês
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right">
                  <div className="text-[15px] font-bold text-white tracking-tight">
                    {formatBRL(pos.currentTotal)}
                  </div>
                  <div
                    className={`text-[11px] font-semibold ${
                      isProfitable ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isProfitable ? '+' : ''}
                    {pos.profitLossPercent}%
                  </div>
                </div>

                <ChevronDown
                  className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180 text-white' : ''
                  }`}
                />
              </div>
            </div>

            {/* Detalhes Sob Demanda (Progressive Disclosure) */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-white/[0.05] space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="truncate">{pos.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-300">
                      P/VP {pos.pvp}
                    </span>
                    {isBelowAverage && (
                      <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                        Abaixo do PM
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-black/40 border border-white/[0.04] text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Cotação B3</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-white font-bold">
                        {formatBRL(pos.currentPrice, true)}
                      </span>
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
                    <span className="text-zinc-500 block text-[10px]">Preço Médio</span>
                    <span className="text-zinc-200 font-semibold block mt-0.5">
                      {formatBRL(pos.averagePrice, true)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/[0.05]">
                    <span className="text-zinc-500 block text-[10px]">Resultado</span>
                    <span
                      className={`font-semibold block mt-0.5 ${
                        isProfitable ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isProfitable ? '+' : ''}
                      {formatBRL(pos.profitLoss)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/[0.05] text-right">
                    <span className="text-zinc-500 block text-[10px]">Valor Investido</span>
                    <span className="text-zinc-300 font-medium block mt-0.5">
                      {formatBRL(pos.totalInvested)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-500">Div/cota:</span>
                    {isEditingThis ? (
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          step="0.01"
                          value={dividendInput}
                          onChange={(e) => setDividendInput(e.target.value)}
                          className="w-16 px-2 py-0.5 rounded-lg bg-zinc-800 text-white text-xs border border-zinc-700 outline-none"
                          autoFocus
                        />
                        <button
                          onClick={(e) => handleSaveDividend(pos.ticker, e)}
                          className="p-1 text-emerald-400"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTicker(null);
                          }}
                          className="p-1 text-zinc-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
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
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 active:scale-95 transition-all text-xs font-bold shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aportar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
