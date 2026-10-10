'use client';

import { useState } from 'react';
import { FiiPosition } from '../types/portfolio';
import { TrendingUp, TrendingDown, Plus, Edit2, Check, X } from 'lucide-react';

interface PositionListProps {
  positions: FiiPosition[];
  onOpenAddModalWithTicker: (ticker: string) => void;
  onUpdateDividend: (ticker: string, dividend: number) => void;
}

export function PositionList({
  positions,
  onOpenAddModalWithTicker,
  onUpdateDividend,
}: PositionListProps) {
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [dividendInput, setDividendInput] = useState<string>('');

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const handleStartEdit = (pos: FiiPosition) => {
    setEditingTicker(pos.ticker);
    setDividendInput(pos.monthlyDividendPerShare.toString());
  };

  const handleSaveDividend = (ticker: string) => {
    const val = parseFloat(dividendInput.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      onUpdateDividend(ticker, val);
    }
    setEditingTicker(null);
  };

  if (positions.length === 0) {
    return (
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-8 text-center">
        <p className="text-sm text-zinc-400 mb-2">Nenhum fundo imobiliário na carteira ainda.</p>
        <p className="text-xs text-zinc-500">
          Toque no botão &quot;+ Novo Aporte&quot; para registrar sua primeira compra na XP!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          Meus Fundos Imobiliários
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
            {positions.length}
          </span>
        </h3>
        <span className="text-[11px] text-zinc-400">Tempo real B3</span>
      </div>

      <div className="space-y-3">
        {positions.map((pos) => {
          const isProfitable = pos.profitLoss >= 0;
          const isDailyUp = (pos.dailyChangePercent || 0) >= 0;
          const isEditingThis = editingTicker === pos.ticker;

          return (
            <div
              key={pos.ticker}
              className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-4 shadow-sm hover:border-zinc-700/80 transition-all"
            >
              {/* Cabeçalho do Card */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-base font-extrabold text-white tracking-wide">
                      {pos.ticker}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                      {pos.segment}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        pos.pvp < 1
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : pos.pvp <= 1.03
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      }`}
                      title={`Valor Patrimonial: ${formatBRL(pos.vp)}`}
                    >
                      P/VP {pos.pvp}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 truncate max-w-[210px] mt-0.5">
                    {pos.name}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base font-bold text-white">
                    {formatBRL(pos.currentPrice)}
                  </div>
                  {pos.dailyChangePercent !== undefined && (
                    <div
                      className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${
                        isDailyUp ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isDailyUp ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>
                        {isDailyUp ? '+' : ''}
                        {pos.dailyChangePercent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Informações de Posição */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 mb-3 text-xs">
                <div>
                  <span className="text-zinc-500 block text-[11px]">Cotas / Preço Médio</span>
                  <span className="text-zinc-200 font-semibold">
                    {pos.totalShares} cotas <span className="text-zinc-500">•</span> {formatBRL(pos.averagePrice)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-zinc-500 block text-[11px]">Valor Total Atual</span>
                  <span className="text-white font-bold">{formatBRL(pos.currentTotal)}</span>
                </div>

                <div className="pt-2 border-t border-zinc-800/60">
                  <span className="text-zinc-500 block text-[11px]">Rentabilidade</span>
                  <span
                    className={`font-semibold ${
                      isProfitable ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isProfitable ? '+' : ''}
                    {formatBRL(pos.profitLoss)} ({isProfitable ? '+' : ''}
                    {pos.profitLossPercent}%)
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 text-right">
                  <span className="text-zinc-500 block text-[11px]">Total Investido</span>
                  <span className="text-zinc-300 font-medium">{formatBRL(pos.totalInvested)}</span>
                </div>
              </div>

              {/* Dividendo mensal e ações */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-400">Div/mês:</span>
                  {isEditingThis ? (
                    <div className="flex items-center gap-1">
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
                        onClick={() => handleSaveDividend(pos.ticker)}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingTicker(null)}
                        className="p-1 text-zinc-500 hover:text-zinc-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 flex-wrap">
                      <strong className="text-xs font-semibold text-emerald-400">
                        {formatBRL(pos.totalMonthlyDividend)}
                      </strong>
                      <span className="text-[10px] text-zinc-500">
                        ({formatBRL(pos.monthlyDividendPerShare)} • YoC {pos.yieldOnCostPercent}%)
                      </span>
                      <button
                        onClick={() => handleStartEdit(pos)}
                        aria-label="Editar dividendo"
                        className="p-0.5 text-zinc-500 hover:text-zinc-300 ml-0.5"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onOpenAddModalWithTicker(pos.ticker)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-emerald-600 hover:text-white active:scale-95 transition-all text-xs font-medium shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  Aportar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

