'use client';

import { useState, useMemo } from 'react';
import {
  Sparkles,
  Coins,
  Layers,
  Snowflake,
  TrendingUp,
  Share2,
  X,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Zap,
  Building2,
  Check,
  Calendar,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FiiPosition, Transaction } from '../types/portfolio';
import {
  calculateMonthlyWrapped,
  getAvailableWrappedMonths,
} from '../lib/monthlyWrapped';
import { triggerHaptic } from '../lib/haptic';

interface MonthlyWrappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions: FiiPosition[];
  transactions: Transaction[];
  monthlyTarget: number;
  initialMonthKey?: string;
  isPrivacyMode?: boolean;
}

export function MonthlyWrappedModal({
  isOpen,
  onClose,
  positions,
  transactions,
  monthlyTarget,
  initialMonthKey,
  isPrivacyMode = false,
}: MonthlyWrappedModalProps) {
  const availableMonths = useMemo(
    () => getAvailableWrappedMonths(positions, transactions),
    [positions, transactions]
  );

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    return initialMonthKey || (availableMonths.length > 0 ? availableMonths[0].key : '');
  });

  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  const wrapped = useMemo(() => {
    return calculateMonthlyWrapped(
      positions,
      transactions,
      monthlyTarget,
      selectedMonthKey || undefined
    );
  }, [positions, transactions, monthlyTarget, selectedMonthKey]);

  if (!isOpen || !wrapped) return null;

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const handleMonthChange = (key: string) => {
    triggerHaptic('selection');
    setSelectedMonthKey(key);
  };

  const handleShare = async () => {
    triggerHaptic('success');
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#38bdf8', '#f59e0b'],
    });

    const shareText = `🏢 Meu Mês de ${wrapped.fullLabel} na B3 (FII Tracker):\n\n` +
      `💸 Proventos recebidos: ${formatBRL(wrapped.totalDividends)}\n` +
      `🧱 Aporte no mês: ${formatBRL(wrapped.totalInvested)} (+${wrapped.totalSharesBought} cotas)\n` +
      `❄️ Bola de Neve: ${wrapped.snowballGrowthPercent}% de crescimento\n` +
      (wrapped.magicNumberLeader
        ? `🎯 Líder no Número Mágico: ${wrapped.magicNumberLeader.ticker} (${wrapped.magicNumberLeader.progressPercent}% do objetivo)\n`
        : '') +
      `\nConstruindo renda passiva com constância na B3! 🚀`;

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `Meu Mês de ${wrapped.fullLabel} na B3`,
          text: shareText,
        });
        return;
      } catch {
        // Usuário cancelou ou navegador não completou share nativo
      }
    }

    // Fallback: Copiar para área de transferência
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0d0d10] border border-white/[0.1] rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] max-h-[92vh] overflow-y-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#0d0d10] rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Retrospectiva B3
                </span>
                {wrapped.isCurrentMonth && (
                  <span className="text-[10px] font-semibold text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded-full">
                    Em andamento
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Seu Mês de {wrapped.monthName}
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            aria-label="Fechar"
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor de Meses estilo Carrossel iOS */}
        {availableMonths.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {availableMonths.map((m) => {
              const isSelected = m.key === wrapped.monthKey;
              return (
                <button
                  key={m.key}
                  onClick={() => handleMonthChange(m.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        )}

        {/* CARD PRINCIPAL EM DESTAQUE: FRASE RESUMO */}
        <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-emerald-950/60 via-[#141418] to-[#121215] border border-emerald-500/30 p-5 mb-4 shadow-xl">
          <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              {wrapped.fullLabel}
            </span>
            <p className="text-sm font-medium text-zinc-200 leading-relaxed">
              Você recebeu{' '}
              <strong className="text-emerald-300 font-extrabold text-base">
                {formatBRL(wrapped.totalDividends)}
              </strong>{' '}
              em proventos, aportou em{' '}
              <strong className="text-white font-extrabold text-base">
                {wrapped.totalSharesBought} cotas
              </strong>{' '}
              e sua bola de neve avançou{' '}
              <strong className="text-cyan-300 font-extrabold text-base">
                +{wrapped.snowballGrowthPercent}%
              </strong>
              !
            </p>
          </div>
        </div>

        {/* GRADE DE ESTATÍSTICAS NUBANK / APPLE */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Card 1: Proventos */}
          <div className="rounded-[22px] bg-[#141418] border border-white/[0.06] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <Coins className="w-4 h-4" />
              </div>
              {wrapped.dividendGrowthPercent > 0 && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5" />
                  +{wrapped.dividendGrowthPercent}%
                </span>
              )}
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                Proventos no Mês
              </span>
              <div className="text-lg font-extrabold text-white tracking-tight">
                {formatBRL(wrapped.totalDividends)}
              </div>
              {wrapped.topDividendAsset && (
                <p className="text-[10px] text-zinc-400 mt-1 truncate">
                  Maior pagador:{' '}
                  <span className="font-bold text-emerald-300">
                    {wrapped.topDividendAsset.ticker}
                  </span>{' '}
                  ({formatBRL(wrapped.topDividendAsset.amount)})
                </p>
              )}
            </div>
          </div>

          {/* Card 2: Aportes */}
          <div className="rounded-[22px] bg-[#141418] border border-white/[0.06] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded-full">
                {wrapped.distinctAssetsBoughtCount}{' '}
                {wrapped.distinctAssetsBoughtCount === 1 ? 'ativo' : 'ativos'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                Aportes no Mês
              </span>
              <div className="text-lg font-extrabold text-white tracking-tight">
                {formatBRL(wrapped.totalInvested)}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                +<strong className="text-white">{wrapped.totalSharesBought}</strong> cotas
                adquiridas
              </p>
            </div>
          </div>
        </div>

        {/* CARD BOLA DE NEVE & NÚMERO MÁGICO */}
        {wrapped.magicNumberLeader && (
          <div className="rounded-[24px] bg-[#141418] border border-white/[0.06] p-4.5 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                  <Snowflake className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Efeito Bola de Neve</h4>
                  <p className="text-[10px] text-zinc-400">
                    Líder rumo ao Número Mágico:{' '}
                    <span className="text-cyan-300 font-bold">
                      {wrapped.magicNumberLeader.ticker}
                    </span>
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-cyan-400">
                {wrapped.magicNumberLeader.progressPercent}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${wrapped.magicNumberLeader.progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>
                {wrapped.magicNumberLeader.currentShares} de{' '}
                {wrapped.magicNumberLeader.magicNumber} cotas
              </span>
              <span>
                Faltam {Math.max(0, wrapped.magicNumberLeader.magicNumber - wrapped.magicNumberLeader.currentShares)} cotas
              </span>
            </div>
          </div>
        )}

        {/* EQUIVALÊNCIAS DA VIDA REAL */}
        {wrapped.totalDividends > 0 && (
          <div className="rounded-[22px] bg-white/[0.02] border border-white/[0.05] p-3.5 mb-4 grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-xl bg-white/[0.02]">
              <Coffee className="w-4 h-4 text-amber-400 mx-auto mb-1 opacity-80" />
              <div className="text-xs font-bold text-white">
                ~{wrapped.coffeeCupsPaid} cafés
              </div>
              <div className="text-[9px] text-zinc-500">pagos pelos FIIs</div>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.02]">
              <Zap className="w-4 h-4 text-emerald-400 mx-auto mb-1 opacity-80" />
              <div className="text-xs font-bold text-white">
                {wrapped.energyBillPaidPercent}% da conta
              </div>
              <div className="text-[9px] text-zinc-500">de luz bancada</div>
            </div>
          </div>
        )}

        {/* FRASE DE IMPACTO */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] mb-5 text-center">
          <p className="text-xs italic text-zinc-400 mb-1">
            &ldquo;{wrapped.quote.text}&rdquo;
          </p>
          <span className="text-[10px] font-bold text-zinc-500">
            — {wrapped.quote.author}
          </span>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="space-y-2">
          <button
            onClick={handleShare}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 text-zinc-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Copiado para o WhatsApp!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 stroke-[2.5]" />
                <span>Compartilhar Retrospectiva</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
