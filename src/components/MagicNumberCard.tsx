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
    <div className="rounded-[20px] bg-[#121215] border border-white/[0.06] p-5">
      <div className="flex items-center gap-3 mb-3.5">
        <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center text-white shrink-0">
          <Snowflake className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white leading-tight">
            Efeito Bola de Neve
          </h3>
          <p className="text-[11px] text-zinc-400 uppercase tracking-wide mt-0.5">
            O &ldquo;NÚMERO MÁGICO&rdquo; DA COTA INFINITA
          </p>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-[#1c1c1f] mb-4 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#f5b800] shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-300 leading-relaxed">
          Quando você atinge o <strong className="text-white">Número Mágico</strong>, os próprios proventos do ativo compram <strong className="text-[#f5b800]">1 nova cota todo mês</strong> sem sair nada do seu bolso.
        </p>
      </div>

      <div className="space-y-3">
        {sortedByMagic.map((pos) => {
          const sharesNeeded = Math.max(0, pos.magicNumber - pos.totalShares);
          const reachedMagicNumber = pos.totalShares >= pos.magicNumber;
          const costNeeded = sharesNeeded * pos.currentPrice;
          const monthlyPower = Math.max(10, monthlyTarget + pos.totalMonthlyDividend);
          const monthsEstimated = Math.max(1, Math.ceil(costNeeded / monthlyPower));

          return (
            <div key={pos.ticker} className="p-4 rounded-2xl bg-[#1c1c1f]">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{pos.ticker}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-transparent border border-white/10 text-zinc-400">
                    Base {pos.base}
                  </span>
                </div>
                <div className="text-[24px] leading-tight font-bold tracking-tight text-white tabular-nums">
                  {pos.totalShares}{' '}
                  <span className="text-zinc-400 font-medium text-base">/ {pos.magicNumber} cotas</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <div>
                  {reachedMagicNumber ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Bola de Neve ativada!
                    </span>
                  ) : (
                    <span className="text-sm font-medium">
                      Faltam <strong className="text-white tabular-nums">{sharesNeeded} cotas</strong>{' '}
                      <span className="text-zinc-500 tabular-nums">
                        · estimativa de {monthsEstimated} {monthsEstimated === 1 ? 'mês' : 'meses'}
                      </span>
                    </span>
                  )}
                </div>

                <span
                  className={`tabular-nums font-bold ${
                    reachedMagicNumber ? 'text-emerald-400' : 'text-[#f5b800]'
                  }`}
                >
                  {pos.magicProgressPercent}%
                </span>
              </div>
              {/* Barra de Progresso */}
              <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    reachedMagicNumber ? 'bg-emerald-400' : 'bg-[#f5b800]'
                  }`}
                  style={{ width: `${Math.min(100, pos.magicProgressPercent)}%` }}
                />
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
