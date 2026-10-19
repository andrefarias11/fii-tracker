'use client';

import { Snowflake, CheckCircle2 } from 'lucide-react';
import { FiiPosition } from '../types/portfolio';
import { formatQuantity, formatPercent } from '../lib/formatFinancial';

interface MagicNumberCardProps {
  positions: FiiPosition[];
  monthlyTarget?: number;
  isPrivacyMode?: boolean;
}

export function MagicNumberCard({
  positions,
  monthlyTarget = 200,
  isPrivacyMode = false,
}: MagicNumberCardProps) {
  if (positions.length === 0) return null;

  const sortedByMagic = [...positions].sort(
    (a, b) => b.magicProgressPercent - a.magicProgressPercent
  );

  return (
    <div className="ui-section">
      <div className="flex items-center gap-3 mb-3.5">
        <div className="w-11 h-11 rounded-xl border border-white/[0.08] flex items-center justify-center text-zinc-400 shrink-0">
          <Snowflake className="w-4 h-4" />
        </div>
        <div>
          <h3 className="ui-title">
            Efeito Bola de Neve
          </h3>
          <p className="ui-label mt-0.5">
            Reinvestimento e Número Mágico
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p className="ui-caption">
          O Número Mágico indica quando a renda mensal estimada do ativo pode comprar uma nova unidade. Preços e proventos podem variar.
        </p>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {sortedByMagic.map((pos) => {
          const sharesNeeded = Math.max(0, pos.magicNumber - pos.totalShares);
          const reachedMagicNumber = pos.totalShares >= pos.magicNumber;
          const costNeeded = sharesNeeded * pos.currentPrice;
          const monthlyPower = Math.max(10, monthlyTarget + pos.totalMonthlyDividend);
          const monthsEstimated = Math.max(1, Math.ceil(costNeeded / monthlyPower));

          return (
            <div key={pos.ticker} className="py-5 first:pt-2 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{pos.ticker}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-transparent border border-white/10 text-zinc-400">
                    Base {pos.base}
                  </span>
                </div>
                <div className="ui-value-lg">
                  {formatQuantity(pos.totalShares, isPrivacyMode)}{' '}
                  <span className="text-zinc-400 font-medium text-base">/ {formatQuantity(pos.magicNumber, isPrivacyMode)} {pos.assetClass === 'ACAO' ? 'ações' : 'cotas'}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                <div>
                  {reachedMagicNumber ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Bola de Neve ativada!
                    </span>
                  ) : (
                    <span className="text-sm font-medium">
                      Faltam <strong className="text-white tabular-nums">{formatQuantity(sharesNeeded, isPrivacyMode)} {pos.assetClass === 'ACAO' ? 'ações' : 'cotas'}</strong>{' '}
                      <span className="text-zinc-500 tabular-nums">
                        · estimativa de {isPrivacyMode ? '••••' : monthsEstimated} {monthsEstimated === 1 ? 'mês' : 'meses'}
                      </span>
                    </span>
                  )}
                </div>

                <span
                  className={`tabular-nums font-bold ${
                    reachedMagicNumber ? 'text-emerald-400' : 'text-[#f5b800]'
                  }`}
                >
                    {formatPercent(pos.magicProgressPercent, isPrivacyMode)}
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
