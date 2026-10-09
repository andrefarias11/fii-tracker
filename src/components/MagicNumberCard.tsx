'use client';

import { Snowflake, Info, ArrowRight } from 'lucide-react';
import { FiiPosition } from '../types/portfolio';

interface MagicNumberCardProps {
  positions: FiiPosition[];
}

export function MagicNumberCard({ positions }: MagicNumberCardProps) {
  if (positions.length === 0) return null;

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
          <Snowflake className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Efeito Bola de Neve</h3>
          <p className="text-[11px] text-zinc-400">O &quot;Número Mágico&quot; da independência</p>
        </div>
      </div>

      <div className="p-3 rounded-2xl bg-sky-950/20 border border-sky-800/30 mb-4 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-xs text-sky-200/90 leading-relaxed">
          O <strong>Número Mágico</strong> é quando o dividendo mensal do FII paga <strong>1 nova cota dele</strong> automaticamente, sem você gastar R$ 1 do seu bolso.
        </p>
      </div>

      <div className="space-y-3">
        {positions.map((pos) => {
          const sharesNeeded = Math.max(0, pos.magicNumber - pos.totalShares);
          const reachedMagicNumber = pos.totalShares >= pos.magicNumber;

          return (
            <div key={pos.ticker} className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/70">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{pos.ticker}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                    Base {pos.base}
                  </span>
                </div>
                <div className="text-xs font-semibold text-zinc-300 font-mono">
                  {pos.totalShares}{' '}
                  <span className="text-zinc-500 font-normal">/ {pos.magicNumber} cotas</span>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    reachedMagicNumber
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : 'bg-gradient-to-r from-sky-500 to-teal-400'
                  }`}
                  style={{ width: `${Math.min(100, pos.magicProgressPercent)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>
                  {reachedMagicNumber ? (
                    <span className="text-emerald-400 font-semibold">🎉 Bola de Neve ativada!</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      Faltam <strong className="text-zinc-200">{sharesNeeded} cotas</strong>
                      <ArrowRight className="w-3 h-3 text-zinc-500" />
                    </span>
                  )}
                </span>
                <span className="font-mono text-zinc-400">{pos.magicProgressPercent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

