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

type ChartMetricMode = 'percent' | 'currency';

interface HistoricalPoint {
  index: number;
  dateISO: string;
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

function parseDateSafe(dateStr: string): Date {
  const clean = (dateStr || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(`${clean}T12:00:00`);
  }
  return new Date();
}

function formatDayMonth(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${mon}`;
}

function formatMonthYear(d: Date): string {
  return `${SHORT_MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

export function PerformanceComparisonChart({
  positions,
  transactions,
  bcbIndicators = null,
  isPrivacyMode = false,
}: PerformanceComparisonChartProps) {
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('percent');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  // Taxas mensais oficiais (Banco Central) convertidas para taxa diária composta
  const cdiMonthlyRate = (bcbIndicators?.cdiNetMonthly ?? 0.72) / 100;
  const ipcaMonthlyRate = (bcbIndicators?.ipcaMonthly ?? 0.36) / 100;
  const poupancaMonthlyRate = 0.0058;

  const cdiDailyRate = Math.pow(1 + cdiMonthlyRate, 1 / 30) - 1;
  const ipcaDailyRate = Math.pow(1 + ipcaMonthlyRate, 1 / 30) - 1;
  const poupancaDailyRate = Math.pow(1 + poupancaMonthlyRate, 1 / 30) - 1;

  //constrói a linha do tempo ESTRITAMENTE do 1º aporte até HOJE (sem projeção futura)
  const { series, firstInvestDateLabel } = useMemo(() => {
    const now = new Date();
    const validTxs = [...transactions]
      .filter((t) => Boolean(t.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (validTxs.length === 0) {
      return { series: [] as HistoricalPoint[], firstInvestDateLabel: '' };
    }

    const firstDate = parseDateSafe(validTxs[0].date);
    // Se a data da transação no banco demo estiver no futuro em relação ao relógio, ajustamos a referência final
    const lastTxDate = parseDateSafe(validTxs[validTxs.length - 1].date);
    const endDate = now >= lastTxDate ? now : lastTxDate;

    const totalSpanMs = Math.max(
      24 * 60 * 60 * 1000,
      endDate.getTime() - firstDate.getTime()
    );
    const totalSpanDays = Math.max(1, Math.round(totalSpanMs / (1000 * 60 * 60 * 24)));

    // Gera os pontos de medição entre o 1º aporte e Hoje
    const checkpoints: Date[] = [];
    const spanMonths =
      (endDate.getFullYear() - firstDate.getFullYear()) * 12 +
      (endDate.getMonth() - firstDate.getMonth());

    if (spanMonths >= 2) {
      // Quando há vários meses de histórico: 1 ponto por mês do primeiro aporte até Hoje
      checkpoints.push(new Date(firstDate.getTime()));
      for (let m = 1; m <= spanMonths; m++) {
        const d = new Date(firstDate.getFullYear(), firstDate.getMonth() + m, 1, 12, 0, 0);
        if (d.getTime() > firstDate.getTime() && d.getTime() < endDate.getTime()) {
          checkpoints.push(d);
        }
      }
      checkpoints.push(new Date(endDate.getTime()));
    } else {
      // Quando o investidor começou há poucos dias/semanas: divide do 1º aporte até Hoje em 6 pontos reais
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const t = firstDate.getTime() + (totalSpanMs * i) / steps;
        checkpoints.push(new Date(t));
      }
    }

    // Mapeia preço atual e dividendo mensal de cada FII da carteira
    const posMap = new Map<string, FiiPosition>();
    for (const p of positions) {
      posMap.set(p.ticker, p);
    }

    const points: HistoricalPoint[] = checkpoints.map((cpDate, idx) => {
      const isLast = idx === checkpoints.length - 1;
      const isFirst = idx === 0;

      // Filtra transações ocorridas até esta data (no 1º ponto, inclui todas do dia do 1º aporte)
      const cpIso = cpDate.toISOString().slice(0, 10);
      const txsUpToHere = validTxs.filter((tx) =>
        isFirst ? tx.date <= validTxs[0].date : tx.date <= cpIso
      );

      let investedPocket = 0;
      let cdiValue = 0;
      let poupancaValue = 0;
      let ipcaValue = 0;
      let fiiMarketAndDividends = 0;

      // Agrupa cotas por ticker até esta data para avaliar a carteira FII
      const tickerHoldings = new Map<
        string,
        { shares: number; avgPrice: number; invested: number; weightedDaysHeld: number }
      >();

      for (const tx of txsUpToHere) {
        const txDate = parseDateSafe(tx.date);
        // Se for tudo no mesmo dia, considera ao menos os dias decorridos proporcionalmente na curva
        const rawDaysHeld = Math.max(
          0,
          (cpDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const effectiveDaysHeld =
          totalSpanDays <= 2 ? (idx / Math.max(1, checkpoints.length - 1)) * 30 : rawDaysHeld;

        const amount = Math.abs(tx.total);
        const isSell = tx.type === 'SELL';

        if (isSell) {
          investedPocket = Math.max(0, investedPocket - amount);
          cdiValue = Math.max(0, cdiValue - amount);
          poupancaValue = Math.max(0, poupancaValue - amount);
          ipcaValue = Math.max(0, ipcaValue - amount);
        } else {
          investedPocket += amount;
          cdiValue += amount * Math.pow(1 + cdiDailyRate, effectiveDaysHeld);
          poupancaValue += amount * Math.pow(1 + poupancaDailyRate, effectiveDaysHeld);
          ipcaValue += amount * Math.pow(1 + ipcaDailyRate, effectiveDaysHeld);
        }

        const holding = tickerHoldings.get(tx.ticker) || {
          shares: 0,
          avgPrice: 0,
          invested: 0,
          weightedDaysHeld: 0,
        };

        if (isSell) {
          const sold = Math.min(holding.shares, Math.abs(tx.shares));
          holding.shares = Math.max(0, holding.shares - sold);
          holding.invested = holding.shares * holding.avgPrice;
        } else {
          const prevCost = holding.invested;
          const newCost = prevCost + amount;
          holding.shares += Math.abs(tx.shares);
          holding.invested = newCost;
          holding.avgPrice = holding.shares > 0 ? newCost / holding.shares : tx.price;
          holding.weightedDaysHeld =
            newCost > 0
              ? (holding.weightedDaysHeld * prevCost + effectiveDaysHeld * amount) / newCost
              : effectiveDaysHeld;
        }
        tickerHoldings.set(tx.ticker, holding);
      }

      // Calcula o valor da carteira FII naquele ponto (interpolando preço de compra -> cotação B3 atual + dividendos proporcionais)
      const progressRatio = idx / Math.max(1, checkpoints.length - 1);
      for (const [ticker, h] of tickerHoldings.entries()) {
        if (h.shares <= 0) continue;
        const pos = posMap.get(ticker);
        const currentPrice = pos ? pos.currentPrice : h.avgPrice;
        const monthlyDivPerShare = pos ? pos.monthlyDividendPerShare : h.avgPrice * 0.0085;

        // Preço da cota evolui do preço médio pago até o preço atual na B3
        const priceAtPoint = h.avgPrice + (currentPrice - h.avgPrice) * progressRatio;
        const equityAtPoint = h.shares * priceAtPoint;

        // Dividendos acumulados no período detido (isento de IR)
        const monthsHeld = h.weightedDaysHeld / 30;
        const accumulatedDividends = h.shares * monthlyDivPerShare * Math.max(0, monthsHeld);

        fiiMarketAndDividends += equityAtPoint + accumulatedDividends;
      }

      const calcPct = (val: number) =>
        investedPocket > 0
          ? Number((((val - investedPocket) / investedPocket) * 100).toFixed(2))
          : 0;

      const label = isLast
        ? 'Hoje'
        : spanMonths >= 2
        ? formatMonthYear(cpDate)
        : formatDayMonth(cpDate);

      const fullLabel = isLast
        ? `Hoje (${formatDayMonth(cpDate)})`
        : isFirst
        ? `1º Aporte (${formatDayMonth(firstDate)}/${firstDate.getFullYear()})`
        : `${formatDayMonth(cpDate)}/${cpDate.getFullYear()}`;

      return {
        index: idx,
        dateISO: cpIso,
        label,
        fullLabel,
        investedPocket: Number(investedPocket.toFixed(2)),
        fiiValue: Number(fiiMarketAndDividends.toFixed(2)),
        cdiValue: Number(cdiValue.toFixed(2)),
        poupancaValue: Number(poupancaValue.toFixed(2)),
        ipcaValue: Number(ipcaValue.toFixed(2)),
        fiiGainPercent: calcPct(fiiMarketAndDividends),
        cdiGainPercent: calcPct(cdiValue),
        poupancaGainPercent: calcPct(poupancaValue),
        ipcaGainPercent: calcPct(ipcaValue),
      };
    });

    const firstLabel = `${formatDayMonth(firstDate)}/${firstDate.getFullYear()}`;
    return { series: points, firstInvestDateLabel: firstLabel };
  }, [
    positions,
    transactions,
    cdiDailyRate,
    poupancaDailyRate,
    ipcaDailyRate,
  ]);

  if (series.length === 0) return null;

  const activePoint =
    selectedIdx !== null && series[selectedIdx]
      ? series[selectedIdx]
      : series[series.length - 1];

  // Geometria do SVG
  const width = 340;
  const height = 165;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 16;
  const padBottom = 24;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getMetric = (pt: HistoricalPoint, line: 'fii' | 'cdi' | 'poupanca' | 'ipca') => {
    if (metricMode === 'percent') {
      if (line === 'fii') return pt.fiiGainPercent;
      if (line === 'cdi') return pt.cdiGainPercent;
      if (line === 'poupanca') return pt.poupancaGainPercent;
      return pt.ipcaGainPercent;
    }
    if (line === 'fii') return pt.fiiValue;
    if (line === 'cdi') return pt.cdiValue;
    if (line === 'poupanca') return pt.poupancaValue;
    return pt.ipcaValue;
  };

  const allValues = series.flatMap((p) => [
    getMetric(p, 'fii'),
    getMetric(p, 'cdi'),
    getMetric(p, 'poupanca'),
    getMetric(p, 'ipca'),
  ]);

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const spread = Math.max(0.5, rawMax - rawMin);
  const minVal = rawMin - spread * 0.12;
  const maxVal = rawMax + spread * 0.12;
  const valRange = Math.max(0.01, maxVal - minVal);

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, series.length - 1)) * chartW;
  const getY = (val: number) =>
    padTop + chartH - ((val - minVal) / valRange) * chartH;

  const buildPath = (line: 'fii' | 'cdi' | 'poupanca' | 'ipca') =>
    series
      .map(
        (pt, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(
            getMetric(pt, line)
          ).toFixed(1)}`
      )
      .join(' ');

  const fiiPath = buildPath('fii');
  const cdiPath = buildPath('cdi');
  const poupancaPath = buildPath('poupanca');
  const ipcaPath = buildPath('ipca');

  const fiiAreaPath = `${fiiPath} L ${getX(series.length - 1).toFixed(1)} ${(
    padTop + chartH
  ).toFixed(1)} L ${getX(0).toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`;

  // Índices espaçados no eixo X
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
      {/* Cabeçalho + Seletor (% vs R$) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Desempenho Desde o 1º Aporte
            </h3>
            <p className="text-[11px] text-zinc-400">
              De {firstInvestDateLabel} até Hoje • Comparativo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setMetricMode('percent')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
              metricMode === 'percent'
                ? 'bg-emerald-500 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            % Rentab.
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('currency')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
              metricMode === 'currency'
                ? 'bg-emerald-500 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            R$ Valor
          </button>
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
          <span className="text-zinc-300">IPCA</span>
        </div>
      </div>

      {/* Gráfico de Linhas Interativo (Do 1º Aporte até Hoje) */}
      <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/70">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-40 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="fiiHistoryFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grade Horizontal */}
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
          <path d={fiiAreaPath} fill="url(#fiiHistoryFill)" />

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

          {/* Linha vertical da data selecionada */}
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

          {/* Pontos no momento selecionado */}
          {activePoint && (
            <>
              <circle
                cx={getX(activePoint.index)}
                cy={getY(getMetric(activePoint, 'ipca'))}
                r="3"
                fill="#c084fc"
              />
              <circle
                cx={getX(activePoint.index)}
                cy={getY(getMetric(activePoint, 'poupanca'))}
                r="3.2"
                fill="#fbbf24"
              />
              <circle
                cx={getX(activePoint.index)}
                cy={getY(getMetric(activePoint, 'cdi'))}
                r="3.5"
                fill="#38bdf8"
              />
              <circle
                cx={getX(activePoint.index)}
                cy={getY(getMetric(activePoint, 'fii'))}
                r="4.5"
                fill="#10b981"
                stroke="#09090b"
                strokeWidth="1.5"
              />
            </>
          )}

          {/* Datas no eixo X (do 1º Aporte até Hoje) */}
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

          {/* Áreas de toque para inspecionar cada data histórica */}
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
            Aportado até a data:{' '}
            <strong className="text-zinc-300">{formatBRL(activePoint.investedPocket)}</strong>
          </span>
        </div>
      </div>

      {/* Placar Comparativo das 4 Linhas na Data Selecionada */}
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
    </div>
  );
}
