'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { FiiPosition, Transaction, BcbIndicators } from '../types/portfolio';
import { formatCurrency, formatPercent } from '../lib/formatFinancial';

interface Props {
  positions: FiiPosition[];
  transactions: Transaction[];
  monthlyContribution?: number;
  bcbIndicators?: BcbIndicators | null;
  isPrivacyMode?: boolean;
}

const CHART_WIDTH = 360;
const PLOT_LEFT = 20;
const PLOT_RIGHT = 340;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 150;
const X_FOR_MONTH = (month: number) => PLOT_LEFT + (month / 12) * (PLOT_RIGHT - PLOT_LEFT);

export function PerformanceComparisonChart({ positions, bcbIndicators, isPrivacyMode = false }: Props) {
  const [base, setBase] = useState('portfolio');
  const [selectedMonth, setSelectedMonth] = useState(12);
  const equity = positions.reduce((sum, position) => sum + position.currentTotal, 0);
  const income = positions.reduce((sum, position) => sum + position.totalMonthlyDividend, 0);
  const initial = base === 'portfolio' ? equity : Number(base);
  const monthly = equity > 0 ? income / equity : 0;
  const scenarios = [
    { name: 'Carteira', detail: 'Renda da carteira reinvestida', rate: monthly, color: '#F5B800', primary: true },
    ...(bcbIndicators ? [
      { name: 'CDI', detail: 'CDI líquido estimado', rate: bcbIndicators.cdiNetMonthly / 100, color: '#38BDF8', primary: false },
      { name: 'IPCA', detail: 'Inflação (cenário constante)', rate: bcbIndicators.ipcaMonthly / 100, color: '#A78BFA', primary: false },
    ] : []),
  ];
  const curves = scenarios.map((scenario) => ({
    ...scenario,
    points: Array.from({ length: 13 }, (_, month) => initial * Math.pow(1 + scenario.rate, month)),
  }));
  const all = curves.flatMap((curve) => curve.points);
  const min = Math.min(...all, initial) * 0.98;
  const max = Math.max(...all, initial) * 1.02 || 1;
  const yForValue = (value: number) => PLOT_BOTTOM - ((value - min) / (max - min || 1)) * (PLOT_BOTTOM - PLOT_TOP);
  const format = (value: number) => formatCurrency(value, isPrivacyMode);
  const monthLabel = selectedMonth === 0 ? 'Hoje' : `${selectedMonth} ${selectedMonth === 1 ? 'mês' : 'meses'}`;

  const updateSelectedMonth = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!bounds) return;
    const viewX = ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH;
    const normalized = (viewX - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT);
    setSelectedMonth(Math.max(0, Math.min(12, Math.round(normalized * 12))));
  };

  const handleMonthKeyDown = (event: KeyboardEvent<SVGRectElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      setSelectedMonth((month) => Math.max(0, Math.min(12, month + direction)));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSelectedMonth(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setSelectedMonth(12);
    }
  };

  return (
    <section className="ui-section space-y-4">
      <header>
        <h3 className="ui-title">Projeção · 12 meses</h3>
        <p className="mt-1 text-xs text-zinc-400">Taxas atuais constantes; sem novos aportes</p>
      </header>

      <p className="text-xs text-zinc-300">Simulação indicativa com reinvestimento da renda estimada.</p>
      <details className="border-t border-white/[0.06] pt-1 text-xs text-zinc-400">
        <summary className="cursor-pointer font-medium text-zinc-300">Como calculamos</summary>
        <p className="mt-2 leading-relaxed">
          A Carteira parte do patrimônio atual (ou do capital selecionado) e cresce pela renda mensal estimada da carteira, reinvestida e composta por 12 meses. CDI e IPCA usam as taxas mensais informadas pelos indicadores disponíveis, mantidas constantes durante todo o período. A simulação não inclui novos aportes, variação no preço das cotas, impostos futuros ou garantia de rentabilidade. O CDI líquido usa uma hipótese simplificada de tributação.
        </p>
      </details>

      <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
        <span>Capital inicial</span>
        <select
          aria-label="Capital inicial da simulação"
          className="min-h-11 rounded-xl border border-white/[0.06] bg-[var(--surface-panel)] px-3 text-sm text-white"
          value={base}
          onChange={(event) => setBase(event.target.value)}
        >
          <option value="portfolio">Patrimônio atual</option>
          <option value="1000">R$ 1 mil</option>
          <option value="10000">R$ 10 mil</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4 border-y border-white/[0.06] py-4 text-xs">
        <div>
          <span className="block text-zinc-500">Capital inicial</span>
          <strong className="mt-1 block font-semibold text-white tabular-nums">{format(initial)}</strong>
        </div>
        <div>
          <span className="block text-zinc-500">Renda atual estimada</span>
          <strong className="mt-1 block font-semibold text-white tabular-nums">{formatPercent(monthly * 100)} a.m.</strong>
        </div>
      </div>

      <div className="space-y-2" role="status" aria-live="polite" aria-atomic="true" aria-label="Valores para o período selecionado">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-zinc-400">Mês selecionado</span>
          <span className="text-xs font-semibold text-white tabular-nums">{monthLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-white/[0.06] pb-4">
          {curves.map((curve) => (
            <div key={curve.name} className="min-w-0">
              <span className="block truncate text-[10px] text-zinc-400">{curve.name}</span>
              <strong className="mt-0.5 block truncate text-xs font-semibold tabular-nums" style={{ color: curve.color }}>
                {format(curve.points[selectedMonth])}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain">
        <svg
          viewBox="0 0 360 190"
          role="group"
          aria-label="Gráfico interativo da projeção patrimonial. Toque, passe o cursor ou use as setas para selecionar um mês."
          className="h-auto w-full min-w-[360px] touch-pan-x"
        >
          {[0, 1, 2, 3].map((line) => {
            const y = PLOT_TOP + (line / 3) * (PLOT_BOTTOM - PLOT_TOP);
            return <line key={line} x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />;
          })}

          <line x1={X_FOR_MONTH(selectedMonth)} x2={X_FOR_MONTH(selectedMonth)} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 4" />

          {curves.map((curve) => {
            const points = curve.points.map((value, month) => `${X_FOR_MONTH(month)},${yForValue(value)}`).join(' ');
            return (
              <g key={curve.name}>
                <polyline
                  fill="none"
                  stroke={curve.color}
                  strokeWidth={curve.primary ? 3 : 1.5}
                  strokeOpacity={curve.primary ? 1 : 0.62}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
                <circle cx={X_FOR_MONTH(selectedMonth)} cy={yForValue(curve.points[selectedMonth])} r={curve.primary ? 4 : 3} fill={curve.color} stroke="#121215" strokeWidth="1.5" />
              </g>
            );
          })}

          {Array.from({ length: 13 }, (_, month) => {
            const monthX = X_FOR_MONTH(month);
            const dateValue = curves.map((curve) => `${curve.name}: ${format(curve.points[month])}`).join('; ');
            return (
              <rect
                key={month}
                x={monthX - 22}
                y={PLOT_TOP}
                width="44"
                height={PLOT_BOTTOM - PLOT_TOP}
                fill="transparent"
                pointerEvents="all"
                role="button"
                tabIndex={0}
                aria-label={`${month === 0 ? 'Hoje' : `Mês ${month}`}. ${dateValue}`}
                onPointerDown={updateSelectedMonth}
                onPointerMove={(event) => { if (event.pointerType === 'mouse') updateSelectedMonth(event); }}
                onFocus={() => setSelectedMonth(month)}
                onKeyDown={handleMonthKeyDown}
              />
            );
          })}

          <text x={PLOT_LEFT} y="178" fill="#A1A1AA" fontSize="11" textAnchor="start">Hoje</text>
          <text x={X_FOR_MONTH(6)} y="178" fill="#A1A1AA" fontSize="11" textAnchor="middle">6m</text>
          <text x={PLOT_RIGHT} y="178" fill="#A1A1AA" fontSize="11" textAnchor="end">12m</text>
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
        {curves.map((curve) => (
          <span key={curve.name} className="inline-flex items-center gap-1.5 text-zinc-300">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: curve.color, opacity: curve.primary ? 1 : 0.62 }} />
            {curve.name}
          </span>
        ))}
      </div>

      <table className="w-full text-sm">
        <caption className="pb-2 text-left text-xs text-zinc-400">Valores projetados em 12 meses</caption>
        <tbody>
          {curves.map((curve) => (
            <tr key={curve.name} className="border-t border-white/[0.04]">
              <th className="py-2 text-left text-xs font-normal text-zinc-300">{curve.detail}</th>
              <td className="py-2 text-right text-xs font-semibold tabular-nums" style={{ color: curve.color }}>{format(curve.points[12])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[10px] leading-relaxed text-zinc-500">
        {bcbIndicators
          ? `Indicadores: ${bcbIndicators.source === 'FALLBACK' ? 'referência estimada (fonte indisponível)' : 'Banco Central'} · ${bcbIndicators.updatedAt}.`
          : 'Comparadores indisponíveis: atualize os indicadores.'}
      </p>
    </section>
  );
}
