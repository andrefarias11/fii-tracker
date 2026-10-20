'use client';

import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { FiiPosition, Transaction } from '../types/portfolio';
import { calculateDividendStaircase } from '../domain/portfolioEngine';
import { triggerHaptic } from '../lib/haptic';

interface DividendStaircaseChartProps {
  positions: FiiPosition[];
  transactions: Transaction[];
  isPrivacyMode?: boolean;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function DividendStaircaseChart({
  positions,
  transactions,
  isPrivacyMode = false,
}: DividendStaircaseChartProps) {
  const staircase = useMemo(
    () => calculateDividendStaircase(positions, transactions),
    [positions, transactions]
  );

  const availableYears = useMemo(() => {
    const yrs = Array.from(
      new Set(staircase.months.map((m) => Number(m.yearMonth.slice(0, 4))))
    ).sort((a, b) => b - a);
    if (yrs.length === 0) return [2026];
    return yrs;
  }, [staircase.months]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return availableYears[0] || 2026;
  });

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const totalInvested = useMemo(() => {
    const sum = positions.reduce((acc, p) => acc + p.totalInvested, 0);
    return sum > 0 ? sum : staircase.totalInvestedCapital;
  }, [positions, staircase.totalInvestedCapital]);

  const averageMonthlyDividends = useMemo(() => {
    if (staircase.months.length === 0) return 0;
    return Number((staircase.totalLifetimeDividends / staircase.months.length).toFixed(2));
  }, [staircase]);

  const bestMonth = useMemo(() => {
    if (staircase.months.length === 0) return null;
    return staircase.months.reduce(
      (best, curr) => (curr.totalDividends > best.totalDividends ? curr : best),
      staircase.months[0]
    );
  }, [staircase.months]);

  const yearMonthData = useMemo(() => {
    return MONTH_INITIALS.map((initial, idx) => {
      const monthNum = idx + 1;
      const ym = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
      const data = staircase.months.find((m) => m.yearMonth === ym);
      return {
        index: idx,
        monthNum,
        yearMonth: ym,
        initial,
        name: `${MONTH_NAMES[idx]}/${selectedYear}`,
        shortLabel: `${MONTH_NAMES[idx].slice(0, 3)}/${String(selectedYear).slice(2)}`,
        totalDividends: data ? data.totalDividends : 0,
        breakdown: data ? data.breakdown : [],
        isOfficialB3: Boolean(data?.isOfficialB3),
        hasData: Boolean(data && data.totalDividends > 0),
      };
    });
  }, [selectedYear, staircase.months]);

  const maxInYear = useMemo(() => {
    const vals = yearMonthData.map((m) => m.totalDividends);
    return Math.max(...vals, 0.01);
  }, [yearMonthData]);

  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(() => {
    const withData = yearMonthData.filter((m) => m.hasData);
    if (withData.length > 0) {
      return withData[withData.length - 1].index;
    }
    const currentM = typeof window !== 'undefined' ? new Date().getMonth() : 9;
    return Math.min(11, Math.max(0, currentM));
  });

  const selectedMonth = yearMonthData[selectedMonthIdx] || yearMonthData[0];

  const handleCycleYear = () => {
    triggerHaptic('light');
    if (availableYears.length <= 1) return;
    const currIdx = availableYears.indexOf(selectedYear);
    const nextIdx = (currIdx + 1) % availableYears.length;
    setSelectedYear(availableYears[nextIdx]);
  };

  return (
    <div className="pt-2 pb-4 space-y-4">
      {/* Título Evolução solto no fundo #0b0b0d */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white tracking-tight">Evolução</h2>

        <button
          type="button"
          onClick={handleCycleYear}
          className="bg-[var(--surface-card)] text-zinc-200 text-xs px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 hover:text-white transition-all border border-white/[0.06] active:scale-95"
        >
          <span>No ano ({selectedYear})</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>

      {/* Gráfico de 12 colunas (J F M A M J J A S O N D) estilo XP */}
      <div className="bg-[var(--surface-card)] rounded-[20px] p-5 border border-white/[0.06]">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span>Proventos Mensais</span>
          <span className="text-white font-semibold tabular-nums">
            {formatBRL(selectedMonth.totalDividends)}
          </span>
        </div>

        <div className="grid grid-cols-12 gap-2 items-end h-40 pt-6 pb-2">
          {yearMonthData.map((m) => {
            const isSelected = m.index === selectedMonthIdx;
            const heightPct = m.hasData
              ? Math.max(18, Math.min(100, Math.round((m.totalDividends / maxInYear) * 100)))
              : 0;

            return (
              <button
                key={m.yearMonth}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedMonthIdx(m.index);
                }}
                className="flex flex-col items-center justify-end h-full group focus:outline-none"
                title={`${m.name}: ${formatBRL(m.totalDividends)}`}
              >
                {/* Pílula vertical fina */}
                <div className="w-full flex items-end justify-center h-28">
                  {m.hasData ? (
                    <div
                      className={`w-2.5 mx-auto rounded-full transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-t from-amber-500 to-yellow-300 shadow-[0_0_12px_rgba(245,184,0,0.5)]'
                          : 'bg-gradient-to-t from-zinc-500 to-zinc-100 group-hover:from-zinc-400 group-hover:to-white'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  ) : (
                    <div className="w-2.5 mx-auto rounded-full transition-all h-5 bg-[#27272a]" />
                  )}
                </div>

                {/* Inicial do mês */}
                <span
                  className={`text-[11px] font-bold mt-2.5 transition-colors ${
                    isSelected ? 'text-[#f5b800]' : 'text-zinc-300 group-hover:text-white'
                  }`}
                >
                  {m.initial}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seção "Detalhes da evolução" (Tabela corrida de ponta a ponta sem card ao redor) */}
      <div className="pt-2">
        <h3 className="text-base font-bold text-white mb-2">Detalhes da evolução</h3>

        <div className="divide-y divide-white/[0.08] text-sm">
          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Patrimônio investido</span>
            <span className="text-white font-medium tabular-nums">
              {formatBRL(totalInvested)}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">
              Proventos em {selectedMonth.shortLabel}
            </span>
            <span className="text-emerald-400 font-medium tabular-nums">
              ↑ {formatBRL(selectedMonth.totalDividends)}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Total acumulado em proventos</span>
            <span className="text-emerald-400 font-medium tabular-nums">
              ↑ {formatBRL(staircase.totalLifetimeDividends)}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Payback da carteira</span>
            <span className="text-emerald-400 font-medium tabular-nums">
              ↑ {staircase.portfolioPaybackPercent}%
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Média mensal de proventos</span>
            <span className="text-white font-medium tabular-nums">
              {formatBRL(averageMonthlyDividends)}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">
              Melhor mês histórico {bestMonth ? `(${bestMonth.shortLabel})` : ''}
            </span>
            <span className="text-emerald-400 font-medium tabular-nums">
              ↑ {formatBRL(bestMonth ? bestMonth.totalDividends : 0)}
            </span>
          </div>
        </div>

        {/* Detalhamento dos ativos pagadores do mês selecionado */}
        {selectedMonth.breakdown && selectedMonth.breakdown.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Ativos pagadores em {selectedMonth.name}</span>
              <span className="text-zinc-500">
                {selectedMonth.isOfficialB3 ? 'Extrato B3 Oficial' : 'Estimado'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {selectedMonth.breakdown.map((item) => (
                <div
                  key={item.ticker}
                  className="px-3.5 py-2.5 rounded-xl bg-[var(--surface-card)] border border-white/[0.06] flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-white">{item.ticker}</span>
                  <span className="font-semibold text-emerald-400 tabular-nums">
                    +{formatBRL(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
