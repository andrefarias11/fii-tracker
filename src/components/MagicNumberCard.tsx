'use client';

import { Snowflake, Info, CheckCircle2 } from 'lucide-react';
import { FiiPosition } from '../types/portfolio';

interface MagicNumberCardProps {
  positions: FiiPosition[];
  monthlyTarget?: number;
}

export function MagicNumberCard({
  positions,
  monthlyTarget = 200,
}: MagicNumberCardProps) {
  if (positions.length === 0) return null;

  const sortedByMagic = [...positions].sort(
    (a, b) => b.magicProgressPercent - a.magicProgressPercent
  );

  return (
    <div className="rounded-[24px] bg-[#121215] border border-white/[0.06] p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300">
          <Snowflake className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Efeito Bola de Neve</h3>
          <p className="text-[11px] text-zinc-400">O &quot;Número Mágico&quot; da cota infinita</p>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-white/[0.025] mb-4 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-300 leading-relaxed">
          Quando você atinge o <strong>Número Mágico</strong>, os próprios dividendos do FII compram <strong>1 nova cota todo mês</strong> sem sair nada do seu bolso.
        </p>
      </div>

      <div className="space-y-2.5">
        {sortedByMagic.map((pos) => {
          const sharesNeeded = Math.max(0, pos.magicNumber - pos.totalShares);
          const reachedMagicNumber = pos.totalShares >= pos.magicNumber;
          const costNeeded = sharesNeeded * pos.currentPrice;
          const monthlyPower = Math.max(10, monthlyTarget + pos.totalMonthlyDividend);
          const monthsEstimated = Math.max(1, Math.ceil(costNeeded / monthlyPower));

          return (
            <div key={pos.ticker} className="p-3.5 rounded-2xl bg-white/[0.025]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{pos.ticker}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.05] text-zinc-300">
                    Base {pos.base}
                  </span>
                </div>
                <div className="text-xs font-semibold text-zinc-300 tabular-nums">
                  {pos.totalShares}{' '}
                  <span className="text-zinc-500 font-normal">/ {pos.magicNumber} cotas</span>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    reachedMagicNumber ? 'bg-emerald-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, pos.magicProgressPercent)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <div>
                  {reachedMagicNumber ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Bola de Neve ativada!
                    </span>
                  ) : (
                    <span>
                      Faltam <strong className="text-zinc-200 tabular-nums">{sharesNeeded} cotas</strong>{' '}
                      <span className="text-zinc-500 tabular-nums">
                        (~{monthsEstimated} {monthsEstimated === 1 ? 'mês' : 'meses'} focando nele)
                      </span>
                    </span>
                  )}
                </div>

                <span className="tabular-nums text-zinc-300 font-semibold">
                  {pos.magicProgressPercent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


