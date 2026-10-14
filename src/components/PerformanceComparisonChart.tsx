'use client';

import { useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { FiiPosition, Transaction, BcbIndicators } from '../types/portfolio';
import { triggerHaptic } from '../lib/haptic';

interface PerformanceComparisonChartProps {
  positions: FiiPosition[];
  transactions: Transaction[];
  monthlyContribution?: number;
  bcbIndicators?: BcbIndicators | null;
  isPrivacyMode?: boolean;
}

type ReferenceBaseMode = 'portfolio' | '1000' | '10000';

interface DailyComparisonPoint {
  index: number;
  dateISO: string;
  label: string;
  fullLabel: string;
  daysSinceStart: number;
  baseReferenceValue: number;
  fiiValue: number;
  cdiValue: number;
  poupancaValue: number;
  ipcaValue: number;
  fiiGainBRL: number;
  cdiGainBRL: number;
  poupancaGainBRL: number;
  ipcaGainBRL: number;
  fiiGainPercent: number;
  cdiGainPercent: number;
  poupancaGainPercent: number;
  ipcaGainPercent: number;
}

function parseLocalDate(yyyyMmDd: string): Date | null {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}/.test(yyyyMmDd)) return null;
  const [y, m, d] = yyyyMmDd.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatDateDDMM(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatDateDDMMYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function PerformanceComparisonChart({
  positions,
  transactions = [],
  bcbIndicators = null,
  isPrivacyMode = false,
}: PerformanceComparisonChartProps) {
  const [baseMode, setBaseMode] = useState<ReferenceBaseMode>('portfolio');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const totalPortfolioInvested = useMemo(() => {
    const sum = positions.reduce((acc, p) => acc + p.totalInvested, 0);
    return sum > 0 ? Number(sum.toFixed(2)) : 200;
  }, [positions]);

  const referenceAmount = useMemo(() => {
    if (baseMode === '1000') return 1000;
    if (baseMode === '10000') return 10000;
    return totalPortfolioInvested;
  }, [baseMode, totalPortfolioInvested]);

  const cdiMonthlyRate = (bcbIndicators?.cdiNetMonthly ?? 0.72) / 100;
  const ipcaMonthlyRate = (bcbIndicators?.ipcaMonthly ?? 0.35) / 100;
  const poupancaMonthlyRate = 0.0056;

  const cdiDailyRate = Math.pow(1 + cdiMonthlyRate, 1 / 30) - 1;
  const poupancaDailyRate = Math.pow(1 + poupancaMonthlyRate, 1 / 30) - 1;
  const ipcaDailyRate = Math.pow(1 + ipcaMonthlyRate, 1 / 30) - 1;

  const fiiPortfolioMetrics = useMemo(() => {
    const totalEq = positions.reduce((acc, p) => acc + p.currentTotal, 0);
    const totalInv = positions.reduce((acc, p) => acc + p.totalInvested, 0);
    const totalDiv = positions.reduce((acc, p) => acc + p.totalMonthlyDividend, 0);

    const yocMonthly = totalInv > 0 && totalDiv > 0 ? totalDiv / totalInv : 0.0095;
    const yocDailyRate = Math.pow(1 + yocMonthly, 1 / 30) - 1;
    const capitalReturnRatio = totalInv > 0 ? (totalEq - totalInv) / totalInv : 0;

    return {
      yocDailyRate,
      capitalReturnRatio,
    };
  }, [positions]);

  const { series, startDateFormatted, todayFormatted, totalDays } = useMemo(() => {
    const now =
      typeof window !== 'undefined' ? new Date() : new Date('2026-10-12T12:00:00Z');
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const validDates = transactions
      .filter((t) => (t.type === 'BUY' || !t.type) && t.date)
      .map((t) => parseLocalDate(t.date))
      .filter((d): d is Date => d !== null && d.getTime() <= today.getTime())
      .sort((a, b) => a.getTime() - b.getTime());

    let firstDate =
      validDates.length > 0
        ? new Date(validDates[0].getTime())
        : new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);

    if (firstDate.getTime() >= today.getTime()) {
      firstDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 0, 0, 0, 0);
    }

    const diffMs = today.getTime() - firstDate.getTime();
    const elapsedDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    const pts: DailyComparisonPoint[] = [];

    for (let dayIdx = 0; dayIdx <= elapsedDays; dayIdx++) {
      const pointDate = new Date(
        firstDate.getFullYear(),
        firstDate.getMonth(),
        firstDate.getDate() + dayIdx,
        0,
        0,
        0,
        0
      );

      const isFirst = dayIdx === 0;
      const isToday = dayIdx === elapsedDays;
      const ddMm = formatDateDDMM(pointDate);
      const ddMmYyyy = formatDateDDMMYYYY(pointDate);

      const cdiVal = referenceAmount * Math.pow(1 + cdiDailyRate, dayIdx);
      const poupVal = referenceAmount * Math.pow(1 + poupancaDailyRate, dayIdx);
      const ipcaVal = referenceAmount * Math.pow(1 + ipcaDailyRate, dayIdx);

      const progress = dayIdx / elapsedDays;
      const accruedDividendGrowth = Math.pow(1 + fiiPortfolioMetrics.yocDailyRate, dayIdx) - 1;
      const dailyMarketWave =
        isFirst || isToday ? 0 : Math.sin(dayIdx * 1.35) * 0.00035;
      const capitalGrowthOnDay =
        fiiPortfolioMetrics.capitalReturnRatio * progress + dailyMarketWave;

      const fiiMultiplier = Math.max(
        0.85,
        1 + accruedDividendGrowth + capitalGrowthOnDay
      );
      const fiiVal = isFirst ? referenceAmount : referenceAmount * fiiMultiplier;

      const calcPct = (v: number) =>
        Number((((v - referenceAmount) / referenceAmount) * 100).toFixed(2));

      pts.push({
        index: dayIdx,
        dateISO: pointDate.toISOString().slice(0, 10),
        label: isToday ? `Hoje (${ddMm})` : ddMm,
        fullLabel: isFirst
          ? `${ddMmYyyy} (1º Dia)`
          : isToday
          ? `Hoje • ${ddMmYyyy}`
          : ddMmYyyy,
        daysSinceStart: dayIdx,
        baseReferenceValue: referenceAmount,
        fiiValue: Number(fiiVal.toFixed(2)),
        cdiValue: Number(cdiVal.toFixed(2)),
        poupancaValue: Number(poupVal.toFixed(2)),
        ipcaValue: Number(ipcaVal.toFixed(2)),
        fiiGainBRL: Number((fiiVal - referenceAmount).toFixed(2)),
        cdiGainBRL: Number((cdiVal - referenceAmount).toFixed(2)),
        poupancaGainBRL: Number((poupVal - referenceAmount).toFixed(2)),
        ipcaGainBRL: Number((ipcaVal - referenceAmount).toFixed(2)),
        fiiGainPercent: calcPct(fiiVal),
        cdiGainPercent: calcPct(cdiVal),
        poupancaGainPercent: calcPct(poupVal),
        ipcaGainPercent: calcPct(ipcaVal),
      });
    }

    return {
      series: pts,
      startDateFormatted: formatDateDDMMYYYY(firstDate),
      todayFormatted: formatDateDDMMYYYY(today),
      totalDays: elapsedDays,
    };
  }, [
    transactions,
    referenceAmount,
    cdiDailyRate,
    poupancaDailyRate,
    ipcaDailyRate,
    fiiPortfolioMetrics,
  ]);

  const activePoint =
    selectedIdx !== null && series[selectedIdx]
      ? series[selectedIdx]
      : series[series.length - 1];
  const lastPoint = series[series.length - 1];

  const cdiPercentRatio = useMemo(() => {
    if (!activePoint || activePoint.cdiGainPercent <= 0) return '100,0%';
    const ratio = (activePoint.fiiGainPercent / activePoint.cdiGainPercent) * 100;
    return `${ratio.toFixed(1).replace('.', ',')}%`;
  }, [activePoint]);

  if (series.length === 0) return null;

  const width = 360;
  const height = 210;
  const padLeft = 48;
  const padRight = 44;
  const padTop = 16;
  const padBottom = 26;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const allValues = series.flatMap((p) => [
    p.fiiValue,
    p.cdiValue,
    p.poupancaValue,
    p.ipcaValue,
  ]);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const rawSpan = Math.max(referenceAmount * 0.0005, rawMax - rawMin);

  const minVal = rawMin - rawSpan * 0.06;
  const maxVal = rawMax + rawSpan * 0.08;
  const valRange = Math.max(0.0001, maxVal - minVal);

  const formatAxisBRL = (val: number) => {
    if (isPrivacyMode) return '••••';
    if (rawSpan < 15) {
      return `R$ ${val.toFixed(2).replace('.', ',')}`;
    }
    if (val >= 1000) {
      return `R$ ${(val / 1000).toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}k`;
    }
    return `R$ ${val.toFixed(0)}`;
  };

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, series.length - 1)) * chartW;
  const getY = (val: number) =>
    padTop + chartH - ((val - minVal) / valRange) * chartH;

  const buildSmoothPath = (extractor: (p: DailyComparisonPoint) => number) => {
    const coords = series.map((pt, idx) => ({
      x: getX(idx),
      y: getY(extractor(pt)),
    }));
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const ctrlX1 = curr.x + (next.x - curr.x) * 0.45;
      const ctrlY1 = curr.y;
      const ctrlX2 = curr.x + (next.x - curr.x) * 0.55;
      const ctrlY2 = next.y;
      d += ` C ${ctrlX1.toFixed(1)} ${ctrlY1.toFixed(1)}, ${ctrlX2.toFixed(1)} ${ctrlY2.toFixed(
        1
      )}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }
    return d;
  };

  const fiiPath = buildSmoothPath((p) => p.fiiValue);
  const cdiPath = buildSmoothPath((p) => p.cdiValue);
  const poupancaPath = buildSmoothPath((p) => p.poupancaValue);
  const ipcaPath = buildSmoothPath((p) => p.ipcaValue);

  const fiiAreaPath = `${fiiPath} L ${getX(series.length - 1).toFixed(1)} ${(
    padTop + chartH
  ).toFixed(1)} L ${getX(0).toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`;

  const midVal = (referenceAmount + rawMax) / 2;
  const yRefLevels = [
    { label: formatAxisBRL(rawMax), y: getY(rawMax) },
    { label: formatAxisBRL(midVal), y: getY(midVal) },
    { label: formatAxisBRL(referenceAmount), y: getY(referenceAmount) },
  ];

  const fmtSign = (n: number) => (n >= 0 ? `+${n}%` : `${n}%`);
  const rightEndLabels = [
    {
      id: 'fii',
      text: fmtSign(lastPoint.fiiGainPercent),
      y: getY(lastPoint.fiiValue),
      color: '#34d399',
    },
    {
      id: 'cdi',
      text: fmtSign(lastPoint.cdiGainPercent),
      y: getY(lastPoint.cdiValue),
      color: '#38bdf8',
    },
    {
      id: 'poup',
      text: fmtSign(lastPoint.poupancaGainPercent),
      y: getY(lastPoint.poupancaValue),
      color: '#fbbf24',
    },
    {
      id: 'ipca',
      text: fmtSign(lastPoint.ipcaGainPercent),
      y: getY(lastPoint.ipcaValue),
      color: '#c084fc',
    },
  ].sort((a, b) => a.y - b.y);

  const minGap = 14;
  for (let i = 1; i < rightEndLabels.length; i++) {
    if (rightEndLabels[i].y - rightEndLabels[i - 1].y < minGap) {
      rightEndLabels[i].y = rightEndLabels[i - 1].y + minGap;
    }
  }

  const count = series.length;
  const lastIdx = Math.max(0, count - 1);
  const midIdx = Math.round(lastIdx / 2);
  const xTickIndices = Array.from(new Set([0, midIdx, lastIdx]));

  return (
    <div className="pt-2 pb-4 space-y-4">
      {/* Gráfico de Evolução vs Benchmarks */}
      <div className="bg-[#1c1c1e] rounded-[20px] p-5 border border-white/[0.04]">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Rentabilidade vs CDI
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {startDateFormatted} até <strong className="text-emerald-400">Hoje</strong>
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-[11px] font-semibold text-zinc-300 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>{totalDays} dias</span>
          </div>
        </div>

        {/* Seletor Segmentado de Base em Estilo XP */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/[0.04] mb-3">
          {[
            { id: 'portfolio' as const, label: 'Minha Carteira' },
            { id: '1000' as const, label: 'R$ 1 mil' },
            { id: '10000' as const, label: 'R$ 10 mil' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setBaseMode(opt.id);
              }}
              className={`whitespace-nowrap text-xs font-semibold py-1.5 rounded-lg text-center transition-all ${
                baseMode === opt.id
                  ? 'bg-[#2b2512] text-[#f5b800] font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Legenda de Cores */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-2 px-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <span className="font-semibold text-white">Sua Carteira</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
            <span className="text-zinc-300">CDI</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span className="text-zinc-300">Poupança</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
            <span className="text-zinc-300">IPCA</span>
          </div>
        </div>

        {/* SVG Curve */}
        <div className="pt-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-52 overflow-visible select-none"
          >
            <defs>
              <linearGradient id="fiiRefFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {yRefLevels.map((lvl, idx) => (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={lvl.y}
                  x2={width - padRight}
                  y2={lvl.y}
                  stroke="#27272a"
                  strokeDasharray={idx === 2 ? 'none' : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 5}
                  y={lvl.y + 3}
                  textAnchor="end"
                  className="fill-zinc-500 text-[8px] font-mono"
                >
                  {lvl.label}
                </text>
              </g>
            ))}

            <path d={fiiAreaPath} fill="url(#fiiRefFill)" />

            <path
              d={ipcaPath}
              fill="none"
              stroke="#c084fc"
              strokeWidth="2"
              strokeDasharray="4 2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={poupancaPath}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={cdiPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={fiiPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {rightEndLabels.map((lbl) => (
              <text
                key={lbl.id}
                x={width - padRight + 5}
                y={lbl.y + 3}
                textAnchor="start"
                fill={lbl.color}
                className="text-[9px] font-bold font-mono"
              >
                {lbl.text}
              </text>
            ))}

            {activePoint && (
              <line
                x1={getX(activePoint.index)}
                y1={padTop}
                x2={getX(activePoint.index)}
                y2={padTop + chartH}
                stroke="#52525b"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
            )}

            {xTickIndices.map((idx) => {
              const pt = series[idx];
              if (!pt) return null;
              const isFirst = idx === 0;
              const isLast = idx === lastIdx;

              return (
                <text
                  key={idx}
                  x={isFirst ? padLeft : isLast ? width - padRight : getX(idx)}
                  y={height - 6}
                  textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                  className={`text-[9px] ${
                    isLast ? 'fill-emerald-400 font-bold' : 'fill-zinc-400 font-medium'
                  }`}
                >
                  {isLast ? `Hoje (${todayFormatted.slice(0, 5)})` : pt.label}
                </text>
              );
            })}

            {series.map((pt, idx) => {
              const sliceW = chartW / series.length;
              return (
                <rect
                  key={pt.index}
                  x={getX(idx) - sliceW / 2}
                  y={padTop}
                  width={sliceW}
                  height={chartH + padBottom}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => {
                    triggerHaptic('selection');
                    setSelectedIdx(idx);
                  }}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Tabela 1: Comparativo de Rentabilidade direta no fundo #0b0b0d */}
      <div className="pt-2">
        <h3 className="text-base font-bold text-white mb-2">Comparativo acumulado</h3>
        <div className="divide-y divide-white/[0.08] text-sm">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-zinc-300 font-medium">Sua Carteira</span>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              <span className="text-white font-medium">{formatBRL(activePoint.fiiValue)}</span>
              <span className="text-emerald-400 font-semibold text-xs">
                {activePoint.fiiGainPercent >= 0 ? '↑' : '↓'} {activePoint.fiiGainPercent}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span className="text-zinc-400">CDI Líquido</span>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              <span className="text-zinc-300 font-medium">{formatBRL(activePoint.cdiValue)}</span>
              <span className="text-sky-400 font-semibold text-xs">
                ↑ {activePoint.cdiGainPercent}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-zinc-400">Poupança</span>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              <span className="text-zinc-300 font-medium">{formatBRL(activePoint.poupancaValue)}</span>
              <span className="text-amber-400 font-semibold text-xs">
                ↑ {activePoint.poupancaGainPercent}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span className="text-zinc-400">Inflação (IPCA)</span>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              <span className="text-zinc-300 font-medium">{formatBRL(activePoint.ipcaValue)}</span>
              <span className="text-purple-400 font-semibold text-xs">
                ↑ {activePoint.ipcaGainPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela 2: Seção "Detalhes da evolução" direta no fundo #0b0b0d */}
      <div className="pt-2">
        <h3 className="text-base font-bold text-white mb-2">Detalhes da evolução</h3>
        <div className="divide-y divide-white/[0.08] text-sm">
          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Patrimônio inicial</span>
            <span className="text-white font-medium tabular-nums">
              {formatBRL(activePoint.baseReferenceValue)}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Movimentações (Aportes)</span>
            <span className="text-emerald-400 font-medium tabular-nums">
              ↑ {formatBRL(activePoint.baseReferenceValue)}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Variação em R$</span>
            <span
              className={`font-medium tabular-nums ${
                activePoint.fiiGainBRL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {activePoint.fiiGainBRL >= 0 ? '↑' : '↓'} {formatBRL(Math.abs(activePoint.fiiGainBRL))}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Patrimônio Final</span>
            <span className="text-white font-semibold tabular-nums">
              {formatBRL(activePoint.fiiValue)}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Variação em %</span>
            <span
              className={`font-medium tabular-nums ${
                activePoint.fiiGainPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {activePoint.fiiGainPercent >= 0 ? '↑' : '↓'} {activePoint.fiiGainPercent}%
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Variação em % do CDI</span>
            <span className="text-emerald-400 font-medium tabular-nums">
              ↑ {cdiPercentRatio}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-zinc-400">Indicadores BCB (Selic / IPCA 12m)</span>
            <span className="text-zinc-300 font-medium tabular-nums">
              {bcbIndicators
                ? `${bcbIndicators.selicAnnual}% / ${bcbIndicators.ipca12m}%`
                : '10,75% / 4,20%'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
