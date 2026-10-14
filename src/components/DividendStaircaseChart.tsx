'use client';

import { useState, useMemo } from 'react';
import { BarChart3, Coins, Sparkles, TrendingUp, CheckCircle2 } from 'lucide-react';
import { FiiPosition, Transaction } from '../types/portfolio';
import { calculateDividendStaircase } from '../domain/portfolioEngine';

interface DividendStaircaseChartProps {
  positions: FiiPosition[];
  transactions: Transaction[];
  isPrivacyMode?: boolean;
}

export function DividendStaircaseChart({
  positions,
  transactions,
  isPrivacyMode = false,
}: DividendStaircaseChartProps) {
  const staircase = useMemo(
    () => calculateDividendStaircase(positions, transactions),
    [positions, transactions]
  );

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  if (staircase.months.length === 0) {
    return (
      <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-8 text-center">
        <BarChart3 className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
        <h3 className="text-sm font-bold text-white mb-1">Escadinha em construção</h3>
        <p className="text-xs text-zinc-500">
          Importe sua planilha de Negociação ou Movimentação da B3 para visualizar a evolução mês a mês dos seus proventos.
        </p>
      </div>
    );
  }

  const activeIdx =
    selectedIndex !== null && staircase.months[selectedIndex]
      ? selectedIndex
      : staircase.months.length - 1;
  const activeMonth = staircase.months[activeIdx];

  const hasRealB3Dividends = staircase.totalRealB3Dividends > 0;
  const averageMonthlyDividends =
    staircase.months.length > 0
      ? Number((staircase.totalLifetimeDividends / staircase.months.length).toFixed(2))
      : 0;

  const bestMonth = staircase.months.reduce(
    (best, curr) => (curr.totalDividends > best.totalDividends ? curr : best),
    staircase.months[0]
  );

  const cumulativeUntilActive = staircase.months
    .slice(0, activeIdx + 1)
    .reduce((acc, m) => acc + m.totalDividends, 0);

  const maxMonthlyTotal = Math.max(
    ...staircase.months.map((m) => m.totalDividends),
    0.01
  );

  return (
    <div className="space-y-4">
      {/* HERO CARD DA ESCADINHA + PAYBACK DA CARTEIRA */}
      <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-zinc-400 font-medium">
                Total Recebido desde o 1º Aporte
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  hasRealB3Dividends
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06]'
                }`}
              >
                {hasRealB3Dividends ? 'Extrato B3 Oficial' : 'Histórico de Cotas'}
              </span>
            </div>

            <div className="text-[30px] font-bold text-white tracking-tight tabular-nums">
              {formatBRL(staircase.totalLifetimeDividends)}
            </div>
          </div>

          {staircase.growthPercent > 0 && (
            <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right shrink-0">
              <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-emerald-400 tabular-nums">
                <TrendingUp className="w-3.5 h-3.5" />
                +{staircase.growthPercent}%
              </div>
              <span className="text-[11px] text-zinc-400 block">desde o 1º mês</span>
            </div>
          )}
        </div>

        {/* Barra de Payback Global da Carteira */}
        <div className="p-4 rounded-2xl bg-white/[0.025] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              Payback da Carteira (Retorno em Proventos)
            </span>
            <span className="font-bold text-emerald-400 tabular-nums">
              {staircase.portfolioPaybackPercent}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(2, staircase.portfolioPaybackPercent))}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              Média mensal: <strong className="text-zinc-300 tabular-nums">{formatBRL(averageMonthlyDividends)}</strong>
            </span>
            {bestMonth && (
              <span>
                Recorde ({bestMonth.shortLabel}):{' '}
                <strong className="text-emerald-400 tabular-nums">{formatBRL(bestMonth.totalDividends)}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* GRÁFICO DE BARRAS INTERATIVO — ESCADINHA MÊS A MÊS */}
      <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300 shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Escadinha de Dividendos ({staircase.months.length}{' '}
                {staircase.months.length === 1 ? 'mês' : 'meses'})
              </h3>
              <p className="text-[11px] text-zinc-400">
                Toque em qualquer barra para inspecionar os ativos pagadores
              </p>
            </div>
          </div>
        </div>

        {/* Barras Verticais com Scroll Horizontal se houver muitos meses */}
        <div className="pt-4 pb-1 overflow-x-auto scrollbar-none">
          <div
            className="flex items-end gap-2 min-h-[168px] px-1"
            style={{
              minWidth: staircase.months.length > 8 ? `${staircase.months.length * 46}px` : '100%',
            }}
          >
            {staircase.months.map((m, idx) => {
              const isSelected = idx === activeIdx;
              const heightPct = Math.max(10, Math.round((m.totalDividends / maxMonthlyTotal) * 100));

              return (
                <button
                  key={m.yearMonth}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className="flex-1 flex flex-col items-center group focus:outline-none"
                >
                  {/* Valor no topo da barra */}
                  <span
                    className={`text-[11px] font-mono mb-1.5 transition-all tabular-nums ${
                      isSelected
                        ? 'text-emerald-400 font-bold scale-105'
                        : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  >
                    {isPrivacyMode
                      ? '•••'
                      : m.totalDividends >= 100
                      ? `R$${Math.round(m.totalDividends)}`
                      : `R$${m.totalDividends.toFixed(2).replace('.', ',')}`}
                  </span>

                  {/* Coluna da Escadinha */}
                  <div className="w-full h-32 flex items-end justify-center">
                    <div
                      className={`w-full max-w-[34px] rounded-t-xl transition-all duration-300 relative ${
                        isSelected
                          ? 'bg-emerald-400 shadow-md shadow-emerald-500/20'
                          : m.isOfficialB3
                          ? 'bg-emerald-500/40 hover:bg-emerald-500/60'
                          : 'bg-white/[0.08] hover:bg-white/[0.15]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>

                  {/* Rótulo do Mês */}
                  <span
                    className={`text-[11px] mt-2 font-semibold whitespace-nowrap ${
                      isSelected ? 'text-white' : 'text-zinc-500'
                    }`}
                  >
                    {m.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* DETALHAMENTO DO MÊS SELECIONADO */}
        {activeMonth && (
          <div className="pt-3 border-t border-white/[0.06] space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{activeMonth.fullLabel}</span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      activeMonth.isOfficialB3
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06]'
                    }`}
                  >
                    {activeMonth.isOfficialB3
                      ? 'Crédito Oficial B3'
                      : 'Calculado pelas Cotas'}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">
                  Acumulado até este mês: <strong className="text-zinc-300 tabular-nums">{formatBRL(cumulativeUntilActive)}</strong>
                </span>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-zinc-500 block mb-0.5">Total no mês</span>
                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                  +{formatBRL(activeMonth.totalDividends)}
                </span>
              </div>
            </div>

            {activeMonth.breakdown.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                {activeMonth.breakdown.map((item) => (
                  <div
                    key={item.ticker}
                    className="px-3 py-2 rounded-xl bg-white/[0.025] flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-zinc-200">{item.ticker}</span>
                    <span className="font-semibold text-emerald-400 tabular-nums">
                      +{formatBRL(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DICA DE IMPORTAÇÃO DE MOVIMENTAÇÃO B3 */}
      {!hasRealB3Dividends && (
        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5 flex items-start gap-2.5 text-xs text-zinc-300">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-white">Quer ver os centavos exatos pagos na conta?</strong>{' '}
            No portal da B3, acesse <strong>Extratos → Movimentação</strong>, baixe o Excel (.xlsx) e importe no botão <strong>B3</strong> no topo do app. O sistema reconhece automaticamente todos os <em>Rendimentos, Dividendos e JCP</em>!
          </div>
        </div>
      )}

      {hasRealB3Dividends && (
        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3 flex items-center gap-2 text-xs text-zinc-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Escadinha sincronizada com os proventos reais importados da sua planilha de <strong>Movimentação B3</strong>.
          </span>
        </div>
      )}
    </div>
  );
}

