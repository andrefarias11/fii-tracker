'use client';

import { useState } from 'react';
import {
  PiggyBank,
  Plus,
  TrendingUp,
  Percent,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Edit3,
  DollarSign,
  Wallet,
  ArrowUpRight,
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
  const totalInvested = assets.reduce((acc, a) => acc + a.investedAmount, 0);
  const totalProfitLoss = Number((totalBalance - totalInvested).toFixed(2));
  const totalMonthlyYield = assets.reduce(
    (acc, a) => acc + calculateFixedIncomeMonthlyYield(a, bcbIndicators),
    0
  );

  const getInstitutionColor = (institution: string) => {
    const s = institution.toLowerCase();
    if (s.includes('nu') || s.includes('roxo')) return 'from-purple-600 to-indigo-600';
    if (s.includes('inter')) return 'from-orange-500 to-amber-600';
    if (s.includes('xp') || s.includes('rico') || s.includes('clear')) return 'from-zinc-700 to-zinc-900 border border-white/20';
    if (s.includes('tesouro')) return 'from-amber-500 to-yellow-600';
    if (s.includes('btg')) return 'from-blue-700 to-indigo-900';
    if (s.includes('itau') || s.includes('itaú')) return 'from-orange-600 to-blue-900';
    if (s.includes('mercado') || s.includes('picpay')) return 'from-emerald-500 to-teal-600';
    return 'from-amber-600 to-orange-600';
  };

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
      {/* Header Resumo da Renda Fixa */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#15161b] via-[#121215] to-[#16131c] border border-amber-500/20 p-5 shadow-xl">
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <PiggyBank className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-300 block">
                Renda Fixa & Caixinhas
              </span>
              <span className="text-[10px] text-zinc-500">
                {assets.length} {assets.length === 1 ? 'aplicação' : 'aplicações'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onAddNew();
            }}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-semibold text-xs active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Adicionar
          </button>
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
          <div>
            <span className="text-[11px] text-zinc-400 block">Saldo Total em Reserva</span>
            <div className="text-xl font-extrabold text-white tracking-tight mt-0.5">
              {formatBRL(totalBalance)}
            </div>
            {totalProfitLoss > 0 && (
              <span className="text-[10px] text-emerald-400 font-semibold inline-flex items-center gap-0.5 mt-0.5">
                <TrendingUp className="w-3 h-3" />
                +{formatBRL(totalProfitLoss)} rendidos
              </span>
            )}
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block">Rendimento Estimado</span>
            <div className="text-xl font-extrabold text-amber-300 tracking-tight mt-0.5">
              +{formatBRL(totalMonthlyYield)}
              <span className="text-xs font-normal text-zinc-400">/mês</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium block mt-0.5">
              {bcbIndicators ? `CDI ${bcbIndicators.cdiNetMonthly}% a.m. líq.` : 'Rendimento líquido'}
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Ativos de Renda Fixa */}
      {assets.length > 0 ? (
        <div className="space-y-2.5">
          {assets.map((asset) => {
            const monthlyYield = calculateFixedIncomeMonthlyYield(asset, bcbIndicators);
            const profit = Number((asset.currentBalance - asset.investedAmount).toFixed(2));

            return (
              <div
                key={asset.id}
                onClick={() => {
                  triggerHaptic('light');
                  onEdit(asset);
                }}
                className="group relative rounded-[22px] bg-[#121215] border border-white/[0.06] hover:border-amber-500/30 p-4 transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Badge da Instituição + Nome */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${getInstitutionColor(
                        asset.institution
                      )} p-0.5 shadow-md shrink-0 flex items-center justify-center`}
                    >
                      <PiggyBank className="w-5 h-5 text-white" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                          {asset.name}
                        </h4>
                        {asset.isExempt && (
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" /> Isento IR
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                        <span className="font-medium text-zinc-300">{asset.institution}</span>
                        <span>•</span>
                        <span>{getTypeLabel(asset.type)}</span>
                        <span>•</span>
                        <span className="text-amber-400/90 font-medium">
                          {asset.rateType === 'CDI'
                            ? `${asset.ratePercent}% CDI`
                            : asset.rateType === 'IPCA'
                            ? `IPCA + ${asset.ratePercent}%`
                            : `${asset.ratePercent}% a.a.`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Saldo Atual & Rendimento Mensal */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-white">
                      {formatBRL(asset.currentBalance)}
                    </div>
                    <div className="text-[11px] font-semibold text-amber-300/90 flex items-center justify-end gap-0.5">
                      <TrendingUp className="w-3 h-3 text-amber-400" />
                      +{formatBRL(monthlyYield)}/mês
                    </div>
                  </div>
                </div>

                {/* Linha Inferior com Metadados & Botão de Editar */}
                <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-zinc-500">
                  <div className="flex items-center gap-2">
                    {profit > 0 ? (
                      <span className="text-emerald-400/90 font-medium">
                        Rendeu {formatBRL(profit)} desde o aporte
                      </span>
                    ) : (
                      <span>Aporte: {formatBRL(asset.investedAmount)}</span>
                    )}
                    {asset.notes && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[150px]">{asset.notes}</span>
                      </>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-zinc-400 group-hover:text-amber-300 transition-colors font-medium">
                    Ajustar saldo <Edit3 className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State Elegante */
        <div className="rounded-[26px] bg-[#121215] border border-white/[0.06] p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-3xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center">
            <PiggyBank className="w-7 h-7 text-amber-400" />
          </div>

          <div className="space-y-1 max-w-xs mx-auto">
            <h3 className="text-sm font-bold text-white">
              Unifique suas Caixinhas e Reserva
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Guarda dinheiro na Caixinha do Nubank (100% CDI), PicPay, Tesouro Selic ou CDB?
              Cadastre aqui para ver seu patrimônio total e rendimento mensal líquido em um só lugar.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onAddNew();
              }}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Adicionar Caixinha ou Título
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onResetDemo();
              }}
              className="w-full sm:w-auto py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 font-semibold text-xs active:scale-95 transition-all"
            >
              Carregar Exemplo (Nubank)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

