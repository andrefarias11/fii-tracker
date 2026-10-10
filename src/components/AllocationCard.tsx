'use client';

import { PieChart, ArrowRight } from 'lucide-react';
import { FiiPosition } from '../types/portfolio';

interface AllocationCardProps {
  positions: FiiPosition[];
  onNavigateToRadar?: () => void;
}

interface SectorSlice {
  label: string;
  value: number;
  percent: number;
  colorClass: string;
  dotClass: string;
}

function normalizeSector(segment: string): { label: string; colorClass: string; dotClass: string } {
  const s = segment.toLowerCase();
  if (s.includes('papel')) {
    return { label: 'Papel (CRI)', colorClass: 'bg-emerald-500', dotClass: 'bg-emerald-400' };
  }
  if (s.includes('logística') || s.includes('logistica')) {
    return { label: 'Logística', colorClass: 'bg-sky-500', dotClass: 'bg-sky-400' };
  }
  if (s.includes('shopping')) {
    return { label: 'Shoppings', colorClass: 'bg-violet-500', dotClass: 'bg-violet-400' };
  }
  if (s.includes('fiagro')) {
    return { label: 'Fiagro', colorClass: 'bg-amber-500', dotClass: 'bg-amber-400' };
  }
  if (s.includes('fof')) {
    return { label: 'FOF', colorClass: 'bg-teal-500', dotClass: 'bg-teal-400' };
  }
  if (s.includes('renda urbana') || s.includes('lajes')) {
    return { label: 'Tijolo Urbano', colorClass: 'bg-indigo-500', dotClass: 'bg-indigo-400' };
  }
  return { label: 'Outros', colorClass: 'bg-zinc-500', dotClass: 'bg-zinc-400' };
}

export function AllocationCard({ positions, onNavigateToRadar }: AllocationCardProps) {
  if (positions.length === 0) return null;

  const totalEquity = positions.reduce((acc, p) => acc + p.currentTotal, 0);
  if (totalEquity <= 0) return null;

  const map = new Map<string, { value: number; colorClass: string; dotClass: string }>();

  for (const pos of positions) {
    const { label, colorClass, dotClass } = normalizeSector(pos.segment);
    const current = map.get(label) || { value: 0, colorClass, dotClass };
    current.value += pos.currentTotal;
    map.set(label, current);
  }

  const slices: SectorSlice[] = Array.from(map.entries())
    .map(([label, data]) => ({
      label,
      value: data.value,
      percent: Math.round((data.value / totalEquity) * 100),
      colorClass: data.colorClass,
      dotClass: data.dotClass,
    }))
    .sort((a, b) => b.value - a.value);

  const topSlice = slices[0];
  const isConcentrated = topSlice && topSlice.percent >= 70;

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <PieChart className="w-3.5 h-3.5 text-emerald-400" />
          <h3 className="text-xs font-bold text-white">Diversificação por Setor</h3>
        </div>
        <span className="text-[11px] text-zinc-400">
          {slices.length} {slices.length === 1 ? 'setor' : 'setores'}
        </span>
      </div>

      {/* Barra Segmentada */}
      <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden flex gap-0.5 mb-3">
        {slices.map((s) => (
          <div
            key={s.label}
            className={`h-full ${s.colorClass} first:rounded-l-full last:rounded-r-full transition-all duration-500`}
            style={{ width: `${Math.max(4, s.percent)}%` }}
            title={`${s.label}: ${s.percent}%`}
          />
        ))}
      </div>

      {/* Legenda enxuta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${s.dotClass}`} />
            <span className="text-zinc-300 font-medium">{s.label}</span>
            <span className="text-zinc-500 font-mono">{s.percent}%</span>
          </div>
        ))}
      </div>

      {/* Alerta sutil quando muito concentrado */}
      {isConcentrated && onNavigateToRadar && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">
            Carteira concentrada em <strong className="text-zinc-200">{topSlice.label}</strong>
          </span>
          <button
            type="button"
            onClick={onNavigateToRadar}
            className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
          >
            Equilibrar <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

