'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Check,
  ShieldCheck,
  Sparkles,
  Trash2,
  Building2,
  Percent,
  DollarSign,
  PiggyBank,
} from 'lucide-react';
import { FixedIncomeAsset, FixedIncomeType } from '../types/portfolio';
import { triggerHaptic } from '../lib/haptic';

interface AddFixedIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assetData: Omit<FixedIncomeAsset, 'id' | 'updatedAt'>) => Promise<any> | any;
  onUpdate?: (id: string, assetData: Partial<FixedIncomeAsset>) => Promise<any> | any;
  onDelete?: (id: string) => Promise<any> | any;
  editingAsset?: FixedIncomeAsset | null;
}

interface PresetOption {
  id: string;
  label: string;
  name: string;
  institution: string;
  type: FixedIncomeType;
  rateType: 'CDI' | 'IPCA' | 'PREFIXADO';
  ratePercent: number;
  isExempt: boolean;
  iconBg: string;
  badge: string;
}

const PRESETS: PresetOption[] = [
  {
    id: 'nubank',
    label: 'Caixinha Nubank',
    name: 'Caixinha Reserva Nubank',
    institution: 'Nubank',
    type: 'CAIXINHA',
    rateType: 'CDI',
    ratePercent: 100,
    isExempt: false,
    iconBg: 'from-purple-600 to-indigo-600',
    badge: '100% CDI',
  },
  {
    id: 'cdb-100',
    label: 'CDB Liquidez Diária',
    name: 'CDB Liquidez Diária',
    institution: 'XP Investimentos',
    type: 'CDB',
    rateType: 'CDI',
    ratePercent: 102,
    isExempt: false,
    iconBg: 'from-emerald-600 to-teal-600',
    badge: '102% CDI',
  },
  {
    id: 'tesouro-selic',
    label: 'Tesouro Selic',
    name: 'Tesouro Selic 2029',
    institution: 'Tesouro Direto',
    type: 'TESOURO_SELIC',
    rateType: 'CDI',
    ratePercent: 100,
    isExempt: false,
    iconBg: 'from-amber-600 to-orange-600',
    badge: 'Selic + 0.05%',
  },
  {
    id: 'tesouro-ipca',
    label: 'Tesouro IPCA+',
    name: 'Tesouro IPCA+ 2035',
    institution: 'Tesouro Direto',
    type: 'TESOURO_IPCA',
    rateType: 'IPCA',
    ratePercent: 6.2,
    isExempt: false,
    iconBg: 'from-blue-600 to-cyan-600',
    badge: 'IPCA + 6,2%',
  },
  {
    id: 'lci-lca',
    label: 'LCI / LCA',
    name: 'LCA Agronegócio 92% CDI',
    institution: 'Banco Inter',
    type: 'LCI_LCA',
    rateType: 'CDI',
    ratePercent: 92,
    isExempt: true,
    iconBg: 'from-teal-600 to-emerald-500',
    badge: 'Isento de IR',
  },
];

export function AddFixedIncomeModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  editingAsset,
}: AddFixedIncomeModalProps) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('Nubank');
  const [type, setType] = useState<FixedIncomeType>('CAIXINHA');
  const [investedAmount, setInvestedAmount] = useState<string>('');
  const [currentBalance, setCurrentBalance] = useState<string>('');
  const [rateType, setRateType] = useState<'CDI' | 'IPCA' | 'PREFIXADO'>('CDI');
  const [ratePercent, setRatePercent] = useState<string>('100');
  const [isExempt, setIsExempt] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingAsset) {
      setName(editingAsset.name);
      setInstitution(editingAsset.institution);
      setType(editingAsset.type);
      setInvestedAmount(editingAsset.investedAmount.toString());
      setCurrentBalance(editingAsset.currentBalance.toString());
      setRateType(editingAsset.rateType);
      setRatePercent(editingAsset.ratePercent.toString());
      setIsExempt(editingAsset.isExempt);
      setNotes(editingAsset.notes || '');
    } else {
      // Default para nova Caixinha Nubank
      const defaultPreset = PRESETS[0];
      setName(defaultPreset.name);
      setInstitution(defaultPreset.institution);
      setType(defaultPreset.type);
      setInvestedAmount('');
      setCurrentBalance('');
      setRateType(defaultPreset.rateType);
      setRatePercent(defaultPreset.ratePercent.toString());
      setIsExempt(defaultPreset.isExempt);
      setNotes('');
    }
  }, [editingAsset, isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: PresetOption) => {
    triggerHaptic('light');
    setName(preset.name);
    setInstitution(preset.institution);
    setType(preset.type);
    setRateType(preset.rateType);
    setRatePercent(preset.ratePercent.toString());
    setIsExempt(preset.isExempt);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const balanceNum = parseFloat(currentBalance.replace(',', '.')) || 0;
    const investedNum = parseFloat(investedAmount.replace(',', '.')) || balanceNum;
    const rateNum = parseFloat(ratePercent.replace(',', '.')) || 100;

    setIsSubmitting(true);
    triggerHaptic('success');

    try {
      if (editingAsset && onUpdate) {
        await onUpdate(editingAsset.id, {
          name: name.trim(),
          institution: institution.trim() || 'Nubank',
          type,
          investedAmount: investedNum,
          currentBalance: balanceNum,
          rateType,
          ratePercent: rateNum,
          isExempt,
          notes: notes.trim() || undefined,
        });
      } else {
        await onSave({
          name: name.trim(),
          institution: institution.trim() || 'Nubank',
          type,
          investedAmount: investedNum,
          currentBalance: balanceNum,
          rateType,
          ratePercent: rateNum,
          isExempt,
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } catch (err) {
      console.error('Erro ao salvar renda fixa:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingAsset || !onDelete) return;
    if (confirm(`Excluir permanentemente "${editingAsset.name}"?`)) {
      triggerHaptic('medium');
      await onDelete(editingAsset.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-[#121215] border border-white/[0.08] rounded-t-[28px] sm:rounded-[28px] p-6 pb-safe-modal shadow-2xl overflow-y-auto max-h-[88dvh] space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 p-0.5 shadow-md shadow-amber-500/20">
              <div className="w-full h-full bg-[#0d0d10] rounded-[14px] flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {editingAsset ? 'Editar Renda Fixa' : 'Nova Caixinha / Renda Fixa'}
              </h2>
              <p className="text-xs text-zinc-400">
                Acompanhe Caixinhas, CDBs e Tesouro no patrimônio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-2 rounded-full bg-white/[0.04] text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets Rápidos de 1 Toque (apenas quando criando novo) */}
        {!editingAsset && (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Sugestões Rápidas (1 Toque)
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {PRESETS.map((p) => {
                const isSelected = type === p.type && name === p.name;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                        : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-tr ${p.iconBg}`} />
                    <span>{p.label}</span>
                    <span className="text-[10px] text-zinc-500 font-normal">({p.badge})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome da Caixinha / Título */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Nome da Aplicação / Caixinha
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Caixinha Reserva Nubank, CDB 110% XP"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-500 text-base sm:text-sm focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Instituição & Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Instituição / Banco
              </label>
              <input
                type="text"
                required
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Ex: Nubank, Inter, XP"
                className="w-full px-3 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white text-base sm:text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Categoria
              </label>
              <select
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as FixedIncomeType;
                  setType(newType);
                  if (newType === 'LCI_LCA') setIsExempt(true);
                  if (newType === 'TESOURO_IPCA') setRateType('IPCA');
                  if (newType === 'TESOURO_PREFIXADO') setRateType('PREFIXADO');
                  if (newType === 'CAIXINHA' || newType === 'CDB' || newType === 'TESOURO_SELIC') {
                    setRateType('CDI');
                  }
                }}
                className="w-full px-3 py-2.5 rounded-2xl bg-[#191920] border border-white/[0.08] text-white text-base sm:text-sm focus:outline-none focus:border-amber-400 transition-colors"
              >
                <option value="CAIXINHA">🟣 Caixinha / Cofrinho</option>
                <option value="CDB">🟢 CDB (Liquidez / Prazo)</option>
                <option value="TESOURO_SELIC">🟡 Tesouro Selic</option>
                <option value="TESOURO_IPCA">🔵 Tesouro IPCA+</option>
                <option value="TESOURO_PREFIXADO">🔴 Tesouro Prefixado</option>
                <option value="LCI_LCA">💎 LCI / LCA (Isento)</option>
                <option value="OUTROS">⚪ Outros</option>
              </select>
            </div>
          </div>

          {/* Valores: Saldo Atual & Valor Investido */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Saldo Atual (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs font-semibold">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={currentBalance}
                  onChange={(e) => setCurrentBalance(e.target.value)}
                  placeholder="500,00"
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white text-base sm:text-sm font-semibold focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                Total Aportado (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs font-semibold">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={investedAmount}
                  onChange={(e) => setInvestedAmount(e.target.value)}
                  placeholder="Opcional"
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white text-base sm:text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Taxa & Indexador */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                Indexador
              </label>
              <select
                value={rateType}
                onChange={(e) => setRateType(e.target.value as any)}
                className="w-full px-2.5 py-2 rounded-xl bg-[#191920] border border-white/[0.08] text-white text-base sm:text-xs focus:outline-none focus:border-amber-400"
              >
                <option value="CDI">% do CDI</option>
                <option value="IPCA">IPCA + taxa anual</option>
                <option value="PREFIXADO">Prefixado anual</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                {rateType === 'CDI'
                  ? 'Percentual (% CDI)'
                  : rateType === 'IPCA'
                  ? 'Taxa anual (+ %)'
                  : 'Taxa anual (% a.a.)'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={ratePercent}
                  onChange={(e) => setRatePercent(e.target.value)}
                  placeholder={rateType === 'CDI' ? '100' : '6.5'}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-base sm:text-xs font-semibold focus:outline-none focus:border-amber-400"
                />
                <span className="absolute right-3 top-2 text-zinc-500 text-xs font-semibold">
                  %
                </span>
              </div>
            </div>

            {/* Isenção de IR */}
            <div className="col-span-2 flex items-center justify-between pt-1 border-t border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Isento de Imposto de Renda (LCI/LCA/CRI/CRA)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsExempt(!isExempt)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  isExempt ? 'bg-emerald-500' : 'bg-white/[0.1]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 left-0.5 ${
                    isExempt ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Notas / Objetivo (opcional) */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
              Objetivo / Notas (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Reserva de emergência de 6 meses"
              className="w-full px-3.5 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-500 text-base sm:text-xs focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 pt-2">
            {editingAsset && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all"
                title="Excluir"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{editingAsset ? 'Salvar Alterações' : 'Adicionar ao Patrimônio'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
