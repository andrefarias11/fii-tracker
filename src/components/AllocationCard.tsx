'use client';

import { ArrowRight } from 'lucide-react';
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
  if (s.includes('ações') || s.includes('acoes')) {
    return { label: 'Ações', colorClass: 'bg-cyan-400', dotClass: 'bg-cyan-400' };
  }
  if (s.includes('papel')) {
    return { label: 'Papel', colorClass: 'bg-emerald-400', dotClass: 'bg-emerald-400' };
  }
  if (s.includes('logística') || s.includes('logistica')) {
    return { label: 'Logística', colorClass: 'bg-sky-400', dotClass: 'bg-sky-400' };
  }
  if (s.includes('shopping')) {
    return { label: 'Shoppings', colorClass: 'bg-violet-400', dotClass: 'bg-violet-400' };
  }
  if (s.includes('fiagro')) {
    return { label: 'Fiagro', colorClass: 'bg-amber-400', dotClass: 'bg-amber-400' };
  }
  if (s.includes('fof')) {
    return { label: 'FOF', colorClass: 'bg-teal-400', dotClass: 'bg-teal-400' };
  }
  if (s.includes('renda urbana') || s.includes('lajes')) {
    return { label: 'Tijolo Urbano', colorClass: 'bg-indigo-400', dotClass: 'bg-indigo-400' };
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
    <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-300">
          Distribuição por Setor
        </span>
        {isConcentrated && onNavigateToRadar ? (
          <button
            type="button"
            onClick={onNavigateToRadar}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
          >
            Diversificar <ArrowRight className="w-3 h-3" />
          </button>
        ) : (
          <span className="text-[11px] text-zinc-500">
            {slices.length} {slices.length === 1 ? 'setor' : 'setores'}
          </span>
        )}
      </div>

      {/* Barra Segmentada Minimalista */}
      <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden flex gap-0.5 mb-2.5">
        {slices.map((s) => (
          <div
            key={s.label}
            className={`h-full ${s.colorClass} first:rounded-l-full last:rounded-r-full transition-all duration-500`}
            style={{ width: `${Math.max(4, s.percent)}%` }}
            title={`${s.label}: ${s.percent}%`}
          />
        ))}
      </div>

      {/* Legenda Limpa */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${s.dotClass}`} />
            <span className="text-zinc-400">{s.label}</span>
            <span className="text-zinc-200 font-semibold">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
