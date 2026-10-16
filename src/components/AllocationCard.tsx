'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { FiiPosition, FixedIncomeAsset } from '../types/portfolio';
import { triggerHaptic } from '../lib/haptic';

interface AllocationCardProps {
  positions: FiiPosition[];
  fixedIncomeAssets?: FixedIncomeAsset[];
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
    return { label: 'Ações', colorClass: 'bg-zinc-200', dotClass: 'bg-zinc-200' };
  }
  if (s.includes('papel')) {
    return { label: 'Papel', colorClass: 'bg-[#f5b800]', dotClass: 'bg-[#f5b800]' };
  }
  if (s.includes('logística') || s.includes('logistica')) {
    return { label: 'Logística', colorClass: 'bg-emerald-400', dotClass: 'bg-emerald-400' };
  }
  if (s.includes('shopping')) {
    return { label: 'Shoppings', colorClass: 'bg-amber-300', dotClass: 'bg-amber-300' };
  }
  if (s.includes('fiagro')) {
    return { label: 'Fiagro', colorClass: 'bg-teal-400', dotClass: 'bg-teal-400' };
  }
  if (s.includes('fof')) {
    return { label: 'FOF', colorClass: 'bg-sky-400', dotClass: 'bg-sky-400' };
  }
  if (s.includes('renda urbana') || s.includes('lajes')) {
    return { label: 'Tijolo Urbano', colorClass: 'bg-zinc-400', dotClass: 'bg-zinc-400' };
  }
  return { label: 'Outros', colorClass: 'bg-zinc-600', dotClass: 'bg-zinc-500' };
}

export function AllocationCard({
  positions,
  fixedIncomeAssets = [],
  onNavigateToRadar,
}: AllocationCardProps) {
  const hasFixedIncome = fixedIncomeAssets.length > 0;
  const [allocationMode, setAllocationMode] = useState<'macro' | 'sectors'>(
    hasFixedIncome ? 'macro' : 'sectors'
  );

  const totalBolsaEquity = positions.reduce((acc, p) => acc + p.currentTotal, 0);
  const totalFixedIncomeEquity = fixedIncomeAssets.reduce((acc, a) => acc + a.currentBalance, 0);
  const totalGlobalEquity = totalBolsaEquity + totalFixedIncomeEquity;

  if (totalGlobalEquity <= 0) return null;

  // 1. Fatias do Macro Alocação (FIIs vs Ações vs Renda Fixa)
  const fiiEquity = positions
    .filter((p) => p.assetClass !== 'ACAO')
    .reduce((acc, p) => acc + p.currentTotal, 0);
  const acaoEquity = positions
    .filter((p) => p.assetClass === 'ACAO')
    .reduce((acc, p) => acc + p.currentTotal, 0);

  const fiiPercent = Math.round((fiiEquity / totalGlobalEquity) * 100);
  const acaoPercent = Math.round((acaoEquity / totalGlobalEquity) * 100);
  const fixedIncomePercent = Math.max(0, 100 - fiiPercent - acaoPercent);

  const macroSlices: SectorSlice[] = [
    {
      label: 'FIIs (Imobiliário)',
      value: fiiEquity,
      percent: fiiPercent,
      colorClass: 'bg-[#f5b800]',
      dotClass: 'bg-[#f5b800]',
    },
    {
      label: 'Ações (Empresas)',
      value: acaoEquity,
      percent: acaoPercent,
      colorClass: 'bg-zinc-200',
      dotClass: 'bg-zinc-200',
    },
    {
      label: 'Renda Fixa & Caixinhas',
      value: totalFixedIncomeEquity,
      percent: fixedIncomePercent,
      colorClass: 'bg-emerald-400',
      dotClass: 'bg-emerald-400',
    },
  ].filter((s) => s.value > 0);

  // 2. Fatias de Setores da Bolsa
  const map = new Map<string, { value: number; colorClass: string; dotClass: string }>();
  for (const pos of positions) {
    const { label, colorClass, dotClass } = normalizeSector(pos.segment);
    const current = map.get(label) || { value: 0, colorClass, dotClass };
    current.value += pos.currentTotal;
    map.set(label, current);
  }

  const sectorSlices: SectorSlice[] = Array.from(map.entries())
    .map(([label, data]) => ({
      label,
      value: data.value,
      percent: totalBolsaEquity > 0 ? Math.round((data.value / totalBolsaEquity) * 100) : 0,
      colorClass: data.colorClass,
      dotClass: data.dotClass,
    }))
    .sort((a, b) => b.value - a.value);

  const activeSlices = allocationMode === 'macro' && hasFixedIncome ? macroSlices : sectorSlices;
  const topSlice = activeSlices[0];
  const isConcentrated = topSlice && topSlice.percent >= 70;

  return (
    <div className="rounded-[20px] bg-[#1c1c1e] border border-white/[0.04] p-5">
      {/* Título & Alternador de Modo */}
      <div className="flex items-center justify-between mb-3">
        {hasFixedIncome ? (
          <div className="flex items-center gap-1 p-0.5 rounded-full bg-[#141416] border border-white/[0.04]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setAllocationMode('macro');
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                allocationMode === 'macro'
                  ? 'bg-[#2b2512] text-[#f5b800]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Patrimônio Unificado
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setAllocationMode('sectors');
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                allocationMode === 'sectors'
                  ? 'bg-[#2b2512] text-[#f5b800]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Setores da Bolsa
            </button>
          </div>
        ) : (
          <span className="text-xs font-bold text-white">Alocação por Setor</span>
        )}

        {isConcentrated && onNavigateToRadar ? (
          <button
            type="button"
            onClick={onNavigateToRadar}
            className="text-[11px] text-[#f5b800] hover:opacity-80 font-bold inline-flex items-center gap-1"
          >
            Diversificar <ArrowRight className="w-3 h-3" />
          </button>
        ) : (
          <span className="text-[11px] text-zinc-400">
            {activeSlices.length} {activeSlices.length === 1 ? 'classe' : 'classes'}
          </span>
        )}
      </div>

      {/* Barra Segmentada Minimalista */}
      <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden flex gap-0.5 mb-3">
        {activeSlices.map((s) => (
          <div
            key={s.label}
            className={`h-full ${s.colorClass} first:rounded-l-full last:rounded-r-full transition-all duration-500`}
            style={{ width: `${Math.max(4, s.percent)}%` }}
            title={`${s.label}: ${s.percent}%`}
          />
        ))}
      </div>

      {/* Legenda Limpa */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {activeSlices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${s.dotClass}`} />
            <span className="text-zinc-400">{s.label}</span>
            <span className="text-white font-bold tabular-nums">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
