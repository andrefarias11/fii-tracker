'use client';

import {
  PiggyBank,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { FixedIncomeAsset, BcbIndicators } from '../types/portfolio';
import { calculateFixedIncomeMonthlyYield } from '../domain/portfolioEngine';
import { triggerHaptic } from '../lib/haptic';

interface FixedIncomeListProps {
  assets: FixedIncomeAsset[];
  bcbIndicators: BcbIndicators | null;
  isPrivacyMode?: boolean;
  onAddNew: () => void;
  onEdit: (asset: FixedIncomeAsset) => void;
  onResetDemo: () => void;
}

export function FixedIncomeList({
  assets,
  bcbIndicators,
  isPrivacyMode = false,
  onAddNew,
  onEdit,
  onResetDemo,
}: FixedIncomeListProps) {
  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const totalBalance = assets.reduce((acc, a) => acc + a.currentBalance, 0);
  const totalMonthlyYield = assets.reduce(
    (acc, a) => acc + calculateFixedIncomeMonthlyYield(a, bcbIndicators),
    0
  );

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'CAIXINHA':
        return 'Caixinha / Reserva';
      case 'CDB':
        return 'CDB';
      case 'TESOURO_SELIC':
        return 'Tesouro Selic';
      case 'TESOURO_IPCA':
        return 'Tesouro IPCA+';
      case 'TESOURO_PREFIXADO':
        return 'Prefixado';
      case 'LCI_LCA':
        return 'LCI / LCA (Isento)';
      default:
        return 'Renda Fixa';
    }
  };

  return (
    <div className="space-y-4">
      {/* Topo da Lista Estilo XP */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">
            Renda Fixa & Caixinhas ({assets.length})
          </h2>
          <p className="text-xs text-zinc-400">
            Saldo: <span className="text-white font-semibold tabular-nums">{formatBRL(totalBalance)}</span>
            {totalMonthlyYield > 0 && (
              <span className="text-emerald-400 font-semibold tabular-nums">
                {' '}• ▲ +{formatBRL(totalMonthlyYield)}/mês
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onAddNew();
          }}
          className="min-h-11 rounded-full py-2 px-4 bg-[#f5b800] hover:bg-[#ffca28] text-zinc-950 font-bold text-xs active:scale-95 transition-all inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b800]"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          Adicionar
        </button>
      </div>

      {/* Lista de Ativos de Renda Fixa no Molde "Meus ativos" da XP */}
      {assets.length > 0 ? (
        <div className="space-y-4">
          {assets.map((asset) => {
            const monthlyYield = calculateFixedIncomeMonthlyYield(asset, bcbIndicators);
            const profit = Number((asset.currentBalance - asset.investedAmount).toFixed(2));
            const profitPct =
              asset.investedAmount > 0
                ? Number(((profit / asset.investedAmount) * 100).toFixed(2))
                : 0;

            return (
              <div
                key={asset.id}
                className="rounded-[20px] bg-[#121215] border border-white/[0.06] p-5 transition-all"
              >
                {/* Topo do Card */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center shrink-0 text-white">
                      <PiggyBank className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-white leading-tight">
                          {asset.name}
                        </span>
                        {asset.isExempt && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" /> Isento IR
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 uppercase tracking-wide truncate mt-0.5">
                        {asset.institution.toUpperCase()} • {getTypeLabel(asset.type).toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Corpo do Card (Tabela Key-Value Limpa estilo XP) */}
                <div className="space-y-2.5 mt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Taxa contratada</span>
                    <span className="text-white font-medium tabular-nums">
                      {asset.rateType === 'CDI'
                        ? `${asset.ratePercent}% do CDI`
                        : asset.rateType === 'IPCA'
                        ? `IPCA + ${asset.ratePercent}% a.a.`
                        : `${asset.ratePercent}% a.a.`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Valor aplicado</span>
                    <span className="text-white font-medium tabular-nums">
                      {formatBRL(asset.investedAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Posição atual</span>
                    <span className="text-white font-bold tabular-nums">
                      {formatBRL(asset.currentBalance)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Rendimento mensal</span>
                    <span className="text-emerald-400 font-medium tabular-nums">
                      ▲ +{formatBRL(monthlyYield)}/mês
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Resultado total</span>
                    <span
                      className={`font-medium tabular-nums ${
                        profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {profit >= 0 ? '▲' : '▼'} {formatBRL(Math.abs(profit))} ({profitPct.toFixed(2).replace('.', ',')}%)
                    </span>
                  </div>
                </div>

                {/* Base do Card (Botões Pílula estilo XP) */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    type="button"
                    aria-label={`Editar ou atualizar saldo de ${asset.name}`}
                    onClick={() => {
                      triggerHaptic('light');
                      onEdit(asset);
                    }}
                    className="min-h-11 px-2 py-2.5 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold text-center active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b800]"
                  >
                    Editar / Saldo
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      onAddNew();
                    }}
                    className="min-h-11 px-2 py-2.5 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold text-center active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b800]"
                  >
                    Nova Aplicação
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State Estilo XP */
        <div className="rounded-[20px] bg-[#121215] border border-white/[0.06] p-6 text-center space-y-4">
          <div className="w-11 h-11 rounded-lg border border-white/80 mx-auto flex items-center justify-center text-white">
            <PiggyBank className="w-5 h-5" />
          </div>

          <div className="space-y-1 max-w-xs mx-auto">
            <h3 className="text-sm font-bold text-white">
              Unifique suas Caixinhas e Renda Fixa
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Guarda dinheiro na Caixinha do Nubank (100% CDI), CDB da XP ou Tesouro Selic?
              Cadastre aqui para acompanhar seu patrimônio global.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onResetDemo();
              }}
              className="min-h-11 px-2 py-2.5 rounded-full bg-[#2b2512] text-[#f5b800] font-bold text-xs active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b800]"
            >
              Carregar Exemplo
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onAddNew();
              }}
              className="min-h-11 px-2 py-2.5 rounded-full bg-[#f5b800] text-zinc-950 font-bold text-xs active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b800]"
            >
              + Nova Caixinha
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
