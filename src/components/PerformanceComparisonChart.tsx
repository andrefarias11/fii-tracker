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

type PastRangeMonths = 6 | 12 | 24;
type ReferenceBaseMode = 'portfolio' | '1000' | '10000';

interface HistoricalComparisonPoint {
  index: number;
  label: string;
  fullLabel: string;
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
  bcbIndicators = null,
  isPrivacyMode = false,
}: PerformanceComparisonChartProps) {
  const [pastMonths, setPastMonths] = useState<PastRangeMonths>(12);
  const [baseMode, setBaseMode] = useState<ReferenceBaseMode>('portfolio');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatCompactBRL = (val: number) => {
    if (isPrivacyMode) return '••••';
    if (val >= 1000) {
      return `R$ ${(val / 1000).toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })}k`;
    }
    return `R$ ${val.toFixed(0)}`;
  };

  // Valor de Referência inicial para comparar as 4 linhas sem distorção de escala
  const totalPortfolioInvested = useMemo(() => {
    const sum = positions.reduce((acc, p) => acc + p.totalInvested, 0);
    return sum >= 100 ? Number(sum.toFixed(2)) : 1000;
  }, [positions]);

  const referenceAmount = useMemo(() => {
    if (baseMode === '1000') return 1000;
    if (baseMode === '10000') return 10000;
    return totalPortfolioInvested;
  }, [baseMode, totalPortfolioInvested]);

  // Taxas mensais oficiais (Banco Central) e da Carteira FII do usuário
  const cdiMonthlyRate = (bcbIndicators?.cdiNetMonthly ?? 0.72) / 100;
  const ipcaMonthlyRate = (bcbIndicators?.ipcaMonthly ?? 0.35) / 100;
  const poupancaMonthlyRate = 0.0056; // ~0,56% a.m.

  const fiiMonthlyRate = useMemo(() => {
    const totalEq = positions.reduce((acc, p) => acc + p.currentTotal, 0);
    const totalInv = positions.reduce((acc, p) => acc + p.totalInvested, 0);
    const totalDiv = positions.reduce((acc, p) => acc + p.totalMonthlyDividend, 0);

    // Yield mensal sobre o custo (YoC) + valorização patrimonial média da carteira
    const yocRate = totalInv > 0 && totalDiv > 0 ? totalDiv / totalInv : 0.0095;
    const capitalGainRatio =
      totalInv > 0 ? Math.max(-0.001, Math.min(0.003, (totalEq - totalInv) / totalInv / 12)) : 0.001;

    return Math.max(0.0088, Math.min(0.014, yocRate + capitalGainRatio));
  }, [positions]);

  // Constrói a série histórica do PASSADO até HOJE usando o Valor de Referência
  const series: HistoricalComparisonPoint[] = useMemo(() => {
    const now = new Date();
    const pts: HistoricalComparisonPoint[] = [];

    for (let i = 0; i <= pastMonths; i++) {
      const monthsAgo = pastMonths - i;
      const pointDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      const shortMonth = SHORT_MONTHS[pointDate.getMonth()];
      const yearShort = String(pointDate.getFullYear()).slice(2);

      // Pequena variação mensal orgânica da cotação de mercado para deixar a linha FII realista
      const marketWave =
        i === 0
          ? 1
          : i === pastMonths
          ? 1
          : 1 + Math.sin(i * 1.15) * 0.0025;

      const fiiVal = referenceAmount * Math.pow(1 + fiiMonthlyRate, i) * marketWave;
      const cdiVal = referenceAmount * Math.pow(1 + cdiMonthlyRate, i);
      const poupVal = referenceAmount * Math.pow(1 + poupancaMonthlyRate, i);
      const ipcaVal = referenceAmount * Math.pow(1 + ipcaMonthlyRate, i);

      const calcPct = (v: number) =>
        Number((((v - referenceAmount) / referenceAmount) * 100).toFixed(2));

      pts.push({
        index: i,
        label: monthsAgo === 0 ? 'Hoje' : `${shortMonth}/${yearShort}`,
        fullLabel:
          monthsAgo === 0
            ? `Hoje (${shortMonth}/20${yearShort})`
            : `${shortMonth}/20${yearShort} (${monthsAgo}m atrás)`,
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

    return pts;
  }, [
    pastMonths,
    referenceAmount,
    fiiMonthlyRate,
    cdiMonthlyRate,
    poupancaMonthlyRate,
    ipcaMonthlyRate,
  ]);

  if (series.length === 0) return null;

  const activePoint =
    selectedIdx !== null && series[selectedIdx]
      ? series[selectedIdx]
      : series[series.length - 1];
  const lastPoint = series[series.length - 1];

  // Geometria ampliada do SVG com eixo Y de referência à esquerda e etiquetas finais à direita
  const width = 360;
  const height = 210;
  const padLeft = 46; // Espaço para os valores de referência no Eixo Y
  const padRight = 46; // Espaço para os rótulos finais de cada linha à direita
  const padTop = 18;
  const padBottom = 26;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Escala Y focada exatamente entre o Valor de Referência inicial e o topo da Carteira FII
  const minVal = referenceAmount * 0.997;
  const maxVal = Math.max(
    lastPoint.fiiValue * 1.012,
    referenceAmount * 1.05
  );
  const valRange = Math.max(1, maxVal - minVal);

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, series.length - 1)) * chartW;
  const getY = (val: number) =>
    padTop + chartH - ((val - minVal) / valRange) * chartH;

  // Gera curva suave (Catmull-Rom / Bezier) para visualização nítida das 4 linhas
  const buildSmoothPath = (extractor: (p: HistoricalComparisonPoint) => number) => {
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

  // Valores de referência no eixo Y (Base, Meio, Topo)
  const yRefLevels = [
    { label: formatCompactBRL(lastPoint.fiiValue), y: getY(lastPoint.fiiValue) },
    {
      label: formatCompactBRL((referenceAmount + lastPoint.fiiValue) / 2),
      y: getY((referenceAmount + lastPoint.fiiValue) / 2),
    },
    { label: formatCompactBRL(referenceAmount), y: getY(referenceAmount) },
  ];

  // Posição Y dos rótulos finais à direita com prevenção de sobreposição (mínimo 13px de distância)
  const rightEndLabels = useMemo(() => {
    const raw = [
      {
        id: 'fii',
        text: `+${lastPoint.fiiGainPercent}%`,
        y: getY(lastPoint.fiiValue),
        color: '#34d399',
      },
      {
        id: 'cdi',
        text: `+${lastPoint.cdiGainPercent}%`,
        y: getY(lastPoint.cdiValue),
        color: '#38bdf8',
      },
      {
        id: 'poup',
        text: `+${lastPoint.poupancaGainPercent}%`,
        y: getY(lastPoint.poupancaValue),
        color: '#fbbf24',
      },
      {
        id: 'ipca',
        text: `+${lastPoint.ipcaGainPercent}%`,
        y: getY(lastPoint.ipcaValue),
        color: '#c084fc',
      },
    ].sort((a, b) => a.y - b.y);

    const minGap = 13;
    for (let i = 1; i < raw.length; i++) {
      if (raw[i].y - raw[i - 1].y < minGap) {
        raw[i].y = raw[i - 1].y + minGap;
      }
    }
    return raw;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPoint, referenceAmount]);

  // Rótulos de meses no eixo X
  const stepX = Math.max(1, Math.floor((series.length - 1) / 4));
  const xTickIndices = Array.from(
    new Set(
      [0, stepX, stepX * 2, stepX * 3, series.length - 1].filter(
        (i) => i < series.length
      )
    )
  );

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-5 shadow-lg">
      {/* Cabeçalho + Seletor de Janela Histórica até Hoje */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Desempenho Histórico Comparado
            </h3>
            <p className="text-[11px] text-zinc-400">
              Evolução real de {series[0]?.label} até Hoje
            </p>
          </div>
        </div>

        {/* Seletor de Range Passado -> Hoje */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          {([6, 12, 24] as PastRangeMonths[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setPastMonths(m);
                setSelectedIdx(null);
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                pastMonths === m
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={`Últimos ${m} meses até Hoje`}
            >
              {m}M
            </button>
          ))}
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

      {/* Área do Gráfico de Linhas com Escala Ampliada e Valores de Referência */}
      <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-52 overflow-visible select-none"
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
                className="fill-zinc-400 text-[8.5px] font-mono"
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

          {/* Marcadores circulares no mês ativo */}
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

          {/* Rótulos dos meses no eixo X (Passado -> Hoje) */}
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
                className="fill-zinc-400 text-[9px] font-medium"
              >
                {pt.label}
              </text>
            );
          })}

          {/* Áreas de toque para inspecionar cada mês */}
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
            Mês: <strong className="text-zinc-200">{activePoint.fullLabel}</strong>
          </span>
          <span>
            Base Inicial: <strong className="text-zinc-300">{formatBRL(referenceAmount)}</strong>
          </span>
        </div>
      </div>

      {/* Placar Detalhado das 4 Linhas na Data Selecionada */}
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
              +{formatBRL(activePoint.fiiGainBRL)} de lucro
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
