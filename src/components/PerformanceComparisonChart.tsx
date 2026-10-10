'use client';

import { useState, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { FiiPosition, Transaction, BcbIndicators } from '../types/portfolio';

interface PerformanceComparisonChartProps {
  positions: FiiPosition[];
  transactions: Transaction[];
  monthlyContribution?: number;
  bcbIndicators?: BcbIndicators | null;
  isPrivacyMode?: boolean;
}

type HorizonMonths = 6 | 12 | 24;

interface DataPoint {
  index: number;
  label: string;
  fullLabel: string;
  investedPocket: number;
  fiiValue: number;
  cdiValue: number;
  poupancaValue: number;
  ipcaValue: number;
  fiiGainPercent: number;
  cdiGainPercent: number;
  poupancaGainPercent: number;
  ipcaGainPercent: number;
}

const SHORT_MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function PerformanceComparisonChart({
  positions,
  transactions,
  monthlyContribution = 200,
  bcbIndicators = null,
  isPrivacyMode = false,
}: PerformanceComparisonChartProps) {
  const [horizon, setHorizon] = useState<HorizonMonths>(12);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  // Taxas mensais reais (vindas do Banco Central ou fallback realista)
  const cdiMonthlyRate = (bcbIndicators?.cdiNetMonthly ?? 0.72) / 100;
  const ipcaMonthlyRate = (bcbIndicators?.ipcaMonthly ?? 0.36) / 100;
  const poupancaMonthlyRate = 0.0058; // ~0,58% a.m. (TR + 0,5%)

  // Yield médio mensal da carteira de FIIs do usuário (isento de IR)
  const portfolioYieldMonthlyRate = useMemo(() => {
    const totalEq = positions.reduce((acc, p) => acc + p.currentTotal, 0);
    const totalDiv = positions.reduce((acc, p) => acc + p.totalMonthlyDividend, 0);
    if (totalEq > 0 && totalDiv > 0) {
      const rate = totalDiv / totalEq;
      return Math.max(0.006, Math.min(0.015, rate));
    }
    return 0.0092; // 0,92% a.m. padrão FII
  }, [positions]);

  // Construção da série comparativa mês a mês ("como se eu tivesse investido o mesmo dinheiro em cada aplicação")
  const series: DataPoint[] = useMemo(() => {
    const totalInvestedNow = positions.reduce((acc, p) => acc + p.totalInvested, 0);
    const currentEquityNow = positions.reduce((acc, p) => acc + p.currentTotal, 0);
    const currentMonthlyDiv = positions.reduce((acc, p) => acc + p.totalMonthlyDividend, 0);

    const baseInitial = totalInvestedNow > 0 ? totalInvestedNow : monthlyContribution;
    const fiiInitial =
      currentEquityNow > 0 ? currentEquityNow + currentMonthlyDiv : monthlyContribution;

    // Calcula quantos meses históricos médios as transações já renderam até hoje
    const now = new Date();
    let weightedMonthsHeld = 1;
    if (transactions.length > 0 && totalInvestedNow > 0) {
      let sumWeighted = 0;
      let sumTotal = 0;
      for (const tx of transactions) {
        if (tx.type === 'SELL') continue;
        const txDate = new Date(`${tx.date}T12:00:00`);
        const diffDays = Math.max(15, (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        const months = diffDays / 30;
        sumWeighted += months * tx.total;
        sumTotal += tx.total;
      }
      if (sumTotal > 0) {
        weightedMonthsHeld = Math.max(0.5, Math.min(24, sumWeighted / sumTotal));
      }
    }

    const cdiInitial = baseInitial * Math.pow(1 + cdiMonthlyRate, weightedMonthsHeld);
    const poupancaInitial = baseInitial * Math.pow(1 + poupancaMonthlyRate, weightedMonthsHeld);
    const ipcaInitial = baseInitial * Math.pow(1 + ipcaMonthlyRate, weightedMonthsHeld);

    const points: DataPoint[] = [];
    let accPocket = baseInitial;
    let accFii = fiiInitial;
    let accCdi = cdiInitial;
    let accPoupanca = poupancaInitial;
    let accIpca = ipcaInitial;

    const contrib = Math.max(50, monthlyContribution);

    for (let m = 0; m <= horizon; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const shortMonth = SHORT_MONTHS[d.getMonth()];
      const yearShort = String(d.getFullYear()).slice(2);

      if (m > 0) {
        accPocket += contrib;
        accFii = (accFii + contrib) * (1 + portfolioYieldMonthlyRate);
        accCdi = (accCdi + contrib) * (1 + cdiMonthlyRate);
        accPoupanca = (accPoupanca + contrib) * (1 + poupancaMonthlyRate);
        accIpca = (accIpca + contrib) * (1 + ipcaMonthlyRate);
      }

      const calcPct = (val: number) =>
        accPocket > 0 ? Number((((val - accPocket) / accPocket) * 100).toFixed(1)) : 0;

      points.push({
        index: m,
        label: m === 0 ? 'Hoje' : `${shortMonth}/${yearShort}`,
        fullLabel: m === 0 ? 'Posição Hoje' : `${shortMonth}/20${yearShort} (+${m}m)`,
        investedPocket: Number(accPocket.toFixed(2)),
        fiiValue: Number(accFii.toFixed(2)),
        cdiValue: Number(accCdi.toFixed(2)),
        poupancaValue: Number(accPoupanca.toFixed(2)),
        ipcaValue: Number(accIpca.toFixed(2)),
        fiiGainPercent: calcPct(accFii),
        cdiGainPercent: calcPct(accCdi),
        poupancaGainPercent: calcPct(accPoupanca),
        ipcaGainPercent: calcPct(accIpca),
      });
    }

    return points;
  }, [
    positions,
    transactions,
    monthlyContribution,
    horizon,
    portfolioYieldMonthlyRate,
    cdiMonthlyRate,
    poupancaMonthlyRate,
    ipcaMonthlyRate,
  ]);

  const activePoint =
    selectedIdx !== null && series[selectedIdx]
      ? series[selectedIdx]
      : series[series.length - 1];

  // Geometria do SVG
  const width = 340;
  const height = 165;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 24;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const allValues = series.flatMap((p) => [
    p.fiiValue,
    p.cdiValue,
    p.poupancaValue,
    p.ipcaValue,
  ]);
  const minVal = Math.min(...allValues) * 0.985;
  const maxVal = Math.max(...allValues) * 1.015;
  const valRange = Math.max(1, maxVal - minVal);

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, series.length - 1)) * chartW;
  const getY = (val: number) =>
    padTop + chartH - ((val - minVal) / valRange) * chartH;

  const buildPath = (extractor: (p: DataPoint) => number) =>
    series
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(extractor(pt)).toFixed(1)}`)
      .join(' ');

  const fiiPath = buildPath((p) => p.fiiValue);
  const cdiPath = buildPath((p) => p.cdiValue);
  const poupancaPath = buildPath((p) => p.poupancaValue);
  const ipcaPath = buildPath((p) => p.ipcaValue);

  const fiiAreaPath = `${fiiPath} L ${getX(series.length - 1).toFixed(1)} ${(padTop + chartH).toFixed(
    1
  )} L ${getX(0).toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`;

  // Rótulos do eixo X (mostra ~5 pontos espaçados para ficar limpo)
  const stepX = Math.max(1, Math.floor((series.length - 1) / 4));
  const xTickIndices = Array.from(
    new Set([0, stepX, stepX * 2, stepX * 3, series.length - 1].filter((i) => i < series.length))
  );

  const fiiAdvantageOverCdi = Number(
    (activePoint.fiiValue - activePoint.cdiValue).toFixed(2)
  );

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-5 shadow-lg">
      {/* Cabeçalho + Seletor de Período */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Carteira FII vs. Benchmarks
            </h3>
            <p className="text-[11px] text-zinc-400">
              Se você investisse os mesmos aportes em cada aplicação
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          {([6, 12, 24] as HorizonMonths[]).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                setHorizon(h);
                setSelectedIdx(null);
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                horizon === h
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {h}M
            </button>
          ))}
        </div>
      </div>

      {/* Legenda de Cores das 4 Linhas */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mb-3 px-1 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-emerald-400 inline-block" />
          <span className="font-bold text-white">Sua Carteira FII</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-sky-400 inline-block" />
          <span className="text-zinc-300">CDI Líquido</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-amber-400 inline-block" />
          <span className="text-zinc-300">Poupança</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-purple-400 inline-block" />
          <span className="text-zinc-300">Inflação (IPCA)</span>
        </div>
      </div>

      {/* Área do Gráfico de Linhas Interativo (SVG) */}
      <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/70">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-40 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="fiiLineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas horizontais de grade sutis */}
          {[0.2, 0.5, 0.8].map((ratio) => {
            const y = padTop + chartH * ratio;
            return (
              <line
                key={ratio}
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#27272a"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            );
          })}

          {/* Sombra sob a linha da Carteira FII */}
          <path d={fiiAreaPath} fill="url(#fiiLineFill)" />

          {/* 4. Linha Roxo: Inflação IPCA */}
          <path
            d={ipcaPath}
            fill="none"
            stroke="#c084fc"
            strokeWidth="1.75"
            strokeDasharray="3 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 3. Linha Âmbar: Poupança */}
          <path
            d={poupancaPath}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 2. Linha Azul: CDI Líquido */}
          <path
            d={cdiPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 1. Linha Verde Esmeralda: Sua Carteira FII */}
          <path
            d={fiiPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Linha vertical do mês selecionado */}
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

          {/* Pontos no mês ativo */}
          {activePoint && (
            <>
              <circle
                cx={getX(activePoint.index)}
                cy={getY(activePoint.ipcaValue)}
                r="3"
                fill="#c084fc"
              />
              <circle
                cx={getX(activePoint.index)}
                cy={getY(activePoint.poupancaValue)}
                r="3.2"
                fill="#fbbf24"
              />
              <circle
                cx={getX(activePoint.index)}
                cy={getY(activePoint.cdiValue)}
                r="3.5"
                fill="#38bdf8"
              />
              <circle
                cx={getX(activePoint.index)}
                cy={getY(activePoint.fiiValue)}
                r="4.5"
                fill="#10b981"
                stroke="#09090b"
                strokeWidth="1.5"
              />
            </>
          )}

          {/* Rótulos dos meses no eixo X */}
          {xTickIndices.map((idx) => {
            const pt = series[idx];
            if (!pt) return null;
            return (
              <text
                key={idx}
                x={getX(idx)}
                y={height - 5}
                textAnchor={
                  idx === 0
                    ? 'start'
                    : idx === series.length - 1
                    ? 'end'
                    : 'middle'
                }
                className="fill-zinc-400 text-[9px] font-medium"
              >
                {pt.label}
              </text>
            );
          })}

          {/* Áreas de toque invisíveis para selecionar cada mês no celular */}
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
            Período: <strong className="text-zinc-200">{activePoint.fullLabel}</strong>
          </span>
          <span>
            Do bolso: <strong className="text-zinc-300">{formatBRL(activePoint.investedPocket)}</strong>
          </span>
        </div>
      </div>

      {/* Placar Comparativo das 4 Aplicações no Mês Selecionado */}
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
          </div>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md font-mono">
            +{activePoint.fiiGainPercent}%
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
          </div>
          <span className="text-[10px] font-semibold text-purple-400 font-mono">
            +{activePoint.ipcaGainPercent}%
          </span>
        </div>
      </div>

      {/* Resumo de Vantagem da Carteira */}
      {fiiAdvantageOverCdi > 0 && (
        <div className="mt-2.5 text-[11px] text-zinc-400 text-center">
          Sua carteira FII entrega{' '}
          <strong className="text-emerald-400">+{formatBRL(fiiAdvantageOverCdi)}</strong> a mais
          que o CDI líquido no período (graças à isenção de IR e reinvestimento).
        </div>
      )}
    </div>
  );
}

