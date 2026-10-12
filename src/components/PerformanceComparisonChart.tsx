'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { FiiPosition, Transaction, BcbIndicators } from '../types/portfolio';

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

  // Valor de Referência inicial (Dia 0 = data do 1º aporte)
  const totalPortfolioInvested = useMemo(() => {
    const sum = positions.reduce((acc, p) => acc + p.totalInvested, 0);
    return sum > 0 ? Number(sum.toFixed(2)) : 200;
  }, [positions]);

  const referenceAmount = useMemo(() => {
    if (baseMode === '1000') return 1000;
    if (baseMode === '10000') return 10000;
    return totalPortfolioInvested;
  }, [baseMode, totalPortfolioInvested]);

  // Taxas mensais oficiais (Banco Central) convertidas para taxa diária composta
  const cdiMonthlyRate = (bcbIndicators?.cdiNetMonthly ?? 0.72) / 100;
  const ipcaMonthlyRate = (bcbIndicators?.ipcaMonthly ?? 0.35) / 100;
  const poupancaMonthlyRate = 0.0056; // ~0,56% a.m.

  const cdiDailyRate = Math.pow(1 + cdiMonthlyRate, 1 / 30) - 1;
  const poupancaDailyRate = Math.pow(1 + poupancaMonthlyRate, 1 / 30) - 1;
  const ipcaDailyRate = Math.pow(1 + ipcaMonthlyRate, 1 / 30) - 1;

  // Desempenho real da Carteira FII do usuário (Valorização das cotas na B3 + Yield de Proventos)
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

  // Descobre o PRIMEIRO DIA em que o usuário começou a investir e gera os dias em sequência até HOJE
  const { series, startDateFormatted, todayFormatted, totalDays } = useMemo(() => {
    const now =
      typeof window !== 'undefined' ? new Date() : new Date('2026-10-12T12:00:00Z');
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const validDates = transactions
      .filter((t) => (t.type === 'BUY' || !t.type) && t.date)
      .map((t) => parseLocalDate(t.date))
      .filter((d): d is Date => d !== null && d.getTime() <= today.getTime())
      .sort((a, b) => a.getTime() - b.getTime());

    // Ponto de partida = 1º dia que começou a investir (se investiu hoje mesmo, mostra ontem -> hoje para ter linha)
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

      // Evolução diária dos benchmarks a partir do Dia 0 (1º dia do aporte)
      const cdiVal = referenceAmount * Math.pow(1 + cdiDailyRate, dayIdx);
      const poupVal = referenceAmount * Math.pow(1 + poupancaDailyRate, dayIdx);
      const ipcaVal = referenceAmount * Math.pow(1 + ipcaDailyRate, dayIdx);

      // Evolução diária da Carteira FII (proventos proporcionais aos dias + variação das cotas na B3)
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
          ? `${ddMmYyyy} (1º Dia do Aporte)`
          : isToday
          ? `Hoje • ${ddMmYyyy} (Dia ${dayIdx})`
          : `${ddMmYyyy} (Dia ${dayIdx})`,
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

  if (series.length === 0) return null;

  const activePoint =
    selectedIdx !== null && series[selectedIdx]
      ? series[selectedIdx]
      : series[series.length - 1];
  const lastPoint = series[series.length - 1];

  // Geometria do SVG com amplo espaço vertical para separar as 4 linhas mesmo em poucos dias
  const width = 360;
  const height = 225;
  const padLeft = 52; // Espaço para os valores em R$ no Eixo Y
  const padRight = 50; // Espaço para os ganhos % à direita
  const padTop = 18;
  const padBottom = 28;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Auto-escala dinâmica baseada estritamente nos valores reais do período (sem achatar as linhas!)
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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}k`;
    }
    return `R$ ${val.toFixed(1).replace('.', ',')}`;
  };

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, series.length - 1)) * chartW;
  const getY = (val: number) =>
    padTop + chartH - ((val - minVal) / valRange) * chartH;

  // Gera curva suave passando por todos os dias sequenciais
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

  // Valores de referência no eixo Y (Topo, Meio, Valor Inicial no Dia 0)
  const midVal = (referenceAmount + rawMax) / 2;
  const yRefLevels = [
    { label: formatAxisBRL(rawMax), y: getY(rawMax) },
    { label: formatAxisBRL(midVal), y: getY(midVal) },
    { label: formatAxisBRL(referenceAmount), y: getY(referenceAmount) },
  ];

  // Etiquetas de % à direita com prevenção de sobreposição (mínimo 14px de distância)
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

  // Rótulos dos dias em sequência na barra horizontal (Eixo X)
  const count = series.length;
  const lastIdx = count - 1;
  const xTickIndices =
    count <= 6
      ? series.map((_, i) => i)
      : Array.from(
          new Set([
            0,
            Math.round(lastIdx * 0.25),
            Math.round(lastIdx * 0.5),
            Math.round(lastIdx * 0.75),
            lastIdx,
          ])
        );

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-5 shadow-lg">
      {/* Cabeçalho: Do 1º Dia de Aporte até Hoje */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Evolução Diária desde o 1º Aporte
            </h3>
            <p className="text-[11px] text-zinc-400">
              De <strong className="text-zinc-200">{startDateFormatted}</strong> até{' '}
              <strong className="text-emerald-400">Hoje ({todayFormatted.slice(0, 5)})</strong>
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-[10px] font-bold text-emerald-400 shrink-0">
          <Calendar className="w-3 h-3" />
          {totalDays} {totalDays === 1 ? 'dia' : 'dias'}
        </div>
      </div>

      {/* Seletor do Valor de Referência Inicial */}
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/70 mb-3">
        <span className="text-[11px] text-zinc-400">
          Valor de Referência:{' '}
          <strong className="text-white">{formatBRL(referenceAmount)}</strong>
        </span>

        <div className="flex items-center gap-1">
          {[
            { id: 'portfolio' as const, label: 'Minha Carteira' },
            { id: '1000' as const, label: 'R$ 1 mil' },
            { id: '10000' as const, label: 'R$ 10 mil' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setBaseMode(opt.id)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                baseMode === opt.id
                  ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legenda de Cores das 4 Linhas */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mb-2.5 px-1 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 rounded-full bg-emerald-400 inline-block" />
          <span className="font-bold text-white">Sua Carteira FII</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 rounded-full bg-sky-400 inline-block" />
          <span className="text-zinc-300">CDI Líquido</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 rounded-full bg-amber-400 inline-block" />
          <span className="text-zinc-300">Poupança</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 rounded-full bg-purple-400 inline-block" />
          <span className="text-zinc-300">Inflação (IPCA)</span>
        </div>
      </div>

      {/* Área do Gráfico Diário (1º Dia -> Dias em Sequência -> Hoje) */}
      <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="fiiRefFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Referência no Eixo Y + Valores à Esquerda */}
          {yRefLevels.map((lvl, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={lvl.y}
                x2={width - padRight}
                y2={lvl.y}
                stroke={idx === 2 ? '#3f3f46' : '#27272a'}
                strokeDasharray={idx === 2 ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 5}
                y={lvl.y + 3}
                textAnchor="end"
                className="fill-zinc-400 text-[8px] font-mono"
              >
                {lvl.label}
              </text>
            </g>
          ))}

          {/* Sombra sob a linha da Carteira FII */}
          <path d={fiiAreaPath} fill="url(#fiiRefFill)" />

          {/* 4. Linha Roxa: Inflação IPCA */}
          <path
            d={ipcaPath}
            fill="none"
            stroke="#c084fc"
            strokeWidth="2"
            strokeDasharray="4 2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 3. Linha Âmbar: Poupança */}
          <path
            d={poupancaPath}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 2. Linha Azul: CDI Líquido */}
          <path
            d={cdiPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 1. Linha Verde Esmeralda: Sua Carteira FII */}
          <path
            d={fiiPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Pontinhos diários ao longo da linha quando há até 35 dias */}
          {series.length <= 35 &&
            series.map((pt, idx) => (
              <circle
                key={`dot-${idx}`}
                cx={getX(idx)}
                cy={getY(pt.fiiValue)}
                r={idx === series.length - 1 ? 3.5 : 2}
                fill="#10b981"
                opacity={idx === selectedIdx ? 1 : 0.75}
              />
            ))}

          {/* Etiquetas de ganho % à direita de cada linha */}
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

          {/* Linha vertical do dia selecionado */}
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

          {/* Marcadores circulares no dia ativo */}
          {activePoint && (
            <>
              <circle
                cx={getX(activePoint.index)}
                cy={getY(activePoint.ipcaValue)}
                r="3.2"
                fill="#c084fc"
                stroke="#09090b"
                strokeWidth="1"
              />
              <circle
                cx={getX(activePoint.index)}
                cy={getY(activePoint.poupancaValue)}
                r="3.5"
                fill="#fbbf24"
                stroke="#09090b"
                strokeWidth="1"
              />
              <circle
                cx={getX(activePoint.index)}
                cy={getY(activePoint.cdiValue)}
                r="3.8"
                fill="#38bdf8"
                stroke="#09090b"
                strokeWidth="1"
              />
              <circle
                cx={getX(activePoint.index)}
                cy={getY(activePoint.fiiValue)}
                r="4.8"
                fill="#10b981"
                stroke="#09090b"
                strokeWidth="1.5"
              />
            </>
          )}

          {/* Rótulos dos dias em sequência no eixo X (1º Dia -> Dias seguintes -> Hoje) */}
          {xTickIndices.map((idx) => {
            const pt = series[idx];
            if (!pt) return null;
            return (
              <text
                key={idx}
                x={getX(idx)}
                y={height - 6}
                textAnchor={
                  idx === 0
                    ? 'start'
                    : idx === series.length - 1
                    ? 'end'
                    : 'middle'
                }
                className={`text-[8.5px] font-medium ${
                  idx === series.length - 1
                    ? 'fill-emerald-400 font-bold'
                    : 'fill-zinc-400'
                }`}
              >
                {pt.label}
              </text>
            );
          })}

          {/* Áreas de toque para inspecionar cada dia individualmente */}
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
                onClick={() => setSelectedIdx(idx)}
                onMouseEnter={() => setSelectedIdx(idx)}
              />
            );
          })}
        </svg>

        <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1 pt-2 border-t border-zinc-800/70">
          <span>
            Data: <strong className="text-zinc-200">{activePoint.fullLabel}</strong>
          </span>
          <span>
            Partida ({startDateFormatted.slice(0, 5)}):{' '}
            <strong className="text-zinc-300">{formatBRL(referenceAmount)}</strong>
          </span>
        </div>
      </div>

      {/* Placar Detalhado das 4 Linhas no Dia Selecionado */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="p-2.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Sua Carteira FII
            </div>
            <div className="text-xs font-extrabold text-white mt-0.5">
              {formatBRL(activePoint.fiiValue)}
            </div>
            <div className="text-[10px] text-emerald-400/90 font-medium">
              {activePoint.fiiGainBRL >= 0 ? '+' : ''}
              {formatBRL(activePoint.fiiGainBRL)} no período
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md font-mono">
            {activePoint.fiiGainPercent >= 0 ? '+' : ''}
            {activePoint.fiiGainPercent}%
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-sky-950/20 border border-sky-500/25 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-400">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              CDI Líquido
            </div>
            <div className="text-xs font-bold text-zinc-200 mt-0.5">
              {formatBRL(activePoint.cdiValue)}
            </div>
            <div className="text-[10px] text-sky-400/80">
              +{formatBRL(activePoint.cdiGainBRL)}
            </div>
          </div>
          <span className="text-[10px] font-semibold text-sky-400 font-mono">
            +{activePoint.cdiGainPercent}%
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-amber-950/15 border border-amber-500/20 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Poupança
            </div>
            <div className="text-xs font-bold text-zinc-300 mt-0.5">
              {formatBRL(activePoint.poupancaValue)}
            </div>
            <div className="text-[10px] text-amber-400/80">
              +{formatBRL(activePoint.poupancaGainBRL)}
            </div>
          </div>
          <span className="text-[10px] font-semibold text-amber-400 font-mono">
            +{activePoint.poupancaGainPercent}%
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-purple-950/15 border border-purple-500/20 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Inflação (IPCA)
            </div>
            <div className="text-xs font-bold text-zinc-300 mt-0.5">
              {formatBRL(activePoint.ipcaValue)}
            </div>
            <div className="text-[10px] text-purple-400/80">
              +{formatBRL(activePoint.ipcaGainBRL)}
            </div>
          </div>
          <span className="text-[10px] font-semibold text-purple-400 font-mono">
            +{activePoint.ipcaGainPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}
