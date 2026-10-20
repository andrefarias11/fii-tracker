'use client';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

import { useState, useMemo } from 'react';
import {
  Sparkles,
  Coins,
  Layers,
  Snowflake,
  Share2,
  Download,
  X,
  Coffee,
  Zap,
  Check,
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
  const [exportedSuccess, setExportedSuccess] = useState<boolean>(false);

  const wrapped = useMemo(() => {
    return calculateMonthlyWrapped(
      positions,
      transactions,
      monthlyTarget,
      selectedMonthKey || undefined
    );
  }, [positions, transactions, monthlyTarget, selectedMonthKey]);

  const dialogRef = useModalAccessibility(isOpen, onClose);
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
      colors: ['#f5b800', '#22c55e', '#ffffff'],
    });

    const shareText = `🏢 Meu Mês de ${wrapped.fullLabel} na B3 (FII Tracker):\n\n` +
      `💸 Proventos recebidos: ${formatBRL(wrapped.totalDividends)}\n` +
      `🧱 Aporte no mês: ${formatBRL(wrapped.totalInvested)}${isPrivacyMode ? '' : ` (+${wrapped.totalSharesBought} cotas)`}\n` +
      `❄️ Bola de Neve: ${wrapped.snowballGrowthPercent}% de crescimento\n` +
      (!isPrivacyMode && wrapped.magicNumberLeader
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
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        // Se o compartilhamento falhar, oferece cópia como alternativa.
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch {
      // ignore
    }
  };

  const handleExportCsv = () => {
    if (isPrivacyMode) return;

    const formatNumber = (value: number) =>
      new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const rows: string[][] = [
      ['Indicador', 'Valor'],
      ['Mês de referência', wrapped.fullLabel],
      ['Situação do mês', wrapped.isCurrentMonth ? 'Em andamento' : 'Fechado'],
      ['Proventos recebidos', formatCurrency(wrapped.totalDividends)],
      ['Variação dos proventos vs. mês anterior', `${formatNumber(wrapped.dividendGrowthPercent)}%`],
      ['Aportes realizados', formatCurrency(wrapped.totalInvested)],
      ['Cotas adquiridas', formatNumber(wrapped.totalSharesBought)],
      ['Ativos comprados', wrapped.boughtAssetsList.join(', ') || 'Nenhum'],
      ['Ativos distintos comprados', formatNumber(wrapped.distinctAssetsBoughtCount)],
      ['Crescimento da bola de neve', `${formatNumber(wrapped.snowballGrowthPercent)}%`],
      ['Cobertura da meta mensal por proventos', `${formatNumber(wrapped.monthlyGoalCoveragePercent)}%`],
      ['Meta mensal de aporte', formatCurrency(monthlyTarget)],
      ['Maior provento por ativo', wrapped.topDividendAsset?.ticker || 'Nenhum'],
      ['Valor do maior provento', formatCurrency(wrapped.topDividendAsset?.amount || 0)],
      ['Cafés equivalentes', formatNumber(wrapped.coffeeCupsPaid)],
      ['Conta de luz coberta', `${formatNumber(wrapped.energyBillPaidPercent)}%`],
      [],
      ['Proventos por ativo', 'Valor recebido'],
      ...wrapped.allDividendsBreakdown.map((item) => [item.ticker, formatCurrency(item.amount)]),
    ];
    const escapeCell = (value: string) => {
      const spreadsheetSafeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
      return `"${spreadsheetSafeValue.replace(/"/g, '""')}"`;
    };
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(';')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fii-tracker-resumo-${wrapped.monthKey}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportedSuccess(true);
    window.setTimeout(() => setExportedSuccess(false), 2500);
  };

  return (
    <div ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--surface-card)] border border-white/[0.08] rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 pb-safe-modal shadow-[0_25px_60px_rgba(0,0,0,0.9)] max-h-[88dvh] overflow-y-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4 text-[#f5b800]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#f5b800] bg-[#2b2512] px-2.5 py-0.5 rounded-full">
                  Retrospectiva B3
                </span>
                {wrapped.isCurrentMonth && (
                  <span className="text-[10px] font-semibold text-zinc-400 bg-[var(--surface-panel)] px-2 py-0.5 rounded-full">
                    Em andamento
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-white tracking-tight mt-0.5">
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
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-[var(--surface-panel)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor de Meses estilo Carrossel XP */}
        {availableMonths.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {availableMonths.map((m) => {
              const isSelected = m.key === wrapped.monthKey;
              return (
                <button
                  key={m.key}
                  onClick={() => handleMonthChange(m.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#f5b800] text-zinc-950'
                      : 'bg-[var(--surface-panel)] text-zinc-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        )}

        {/* CARD PRINCIPAL EM DESTAQUE: FRASE RESUMO */}
        <div className="rounded-2xl bg-[var(--surface-panel)] p-4 mb-4">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-[#f5b800] uppercase tracking-wider">
              {wrapped.fullLabel}
            </span>
            <p className="text-sm font-medium text-zinc-200 leading-relaxed">
              Você recebeu{' '}
              <strong className="text-emerald-400 font-bold text-base tabular-nums">
                {formatBRL(wrapped.totalDividends)}
              </strong>{' '}
              em proventos{isPrivacyMode ? '' : ', aportou em '}
              {!isPrivacyMode && <>
              <strong className="text-white font-bold text-base tabular-nums">
                {wrapped.totalSharesBought} cotas
              </strong>{' '}</>}
              e sua bola de neve avançou{' '}
              <strong className="text-[#f5b800] font-bold text-base tabular-nums">
                +{wrapped.snowballGrowthPercent}%
              </strong>
              !
            </p>
          </div>
        </div>

        {/* GRADE DE ESTATÍSTICAS */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Card 1: Proventos */}
          <div className="rounded-2xl bg-[var(--surface-panel)] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#2b2512] flex items-center justify-center text-[#f5b800]">
                <Coins className="w-4 h-4" />
              </div>
              {wrapped.dividendGrowthPercent > 0 && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full tabular-nums">
                  ▲ +{wrapped.dividendGrowthPercent}%
                </span>
              )}
            </div>
            <div>
              <span className="text-[11px] text-zinc-400 font-semibold uppercase">
                Proventos no Mês
              </span>
              <div className="text-lg font-bold text-white tracking-tight tabular-nums">
                {formatBRL(wrapped.totalDividends)}
              </div>
              {!isPrivacyMode && wrapped.topDividendAsset && (
                <p className="text-[11px] text-zinc-400 mt-1 truncate">
                  Maior:{' '}
                  <span className="font-bold text-emerald-400">
                    {wrapped.topDividendAsset.ticker}
                  </span>{' '}
                  <span className="tabular-nums">({formatBRL(wrapped.topDividendAsset.amount)})</span>
                </p>
              )}
            </div>
          </div>

          {/* Card 2: Aportes */}
          <div className="rounded-2xl bg-[var(--surface-panel)] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#2b2512] flex items-center justify-center text-[#f5b800]">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-zinc-300 bg-white/[0.06] px-2 py-0.5 rounded-full">
                {isPrivacyMode ? '••' : <>{wrapped.distinctAssetsBoughtCount}{' '}
                {wrapped.distinctAssetsBoughtCount === 1 ? 'ativo' : 'ativos'}</>}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-zinc-400 font-semibold uppercase">
                Aportes no Mês
              </span>
              <div className="text-lg font-bold text-white tracking-tight tabular-nums">
                {formatBRL(wrapped.totalInvested)}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                {isPrivacyMode ? 'Quantidade oculta' : <>+<strong className="text-white tabular-nums">{wrapped.totalSharesBought}</strong> cotas adquiridas</>}
              </p>
            </div>
          </div>
        </div>

        {/* CARD BOLA DE NEVE & NÚMERO MÁGICO */}
        {!isPrivacyMode && wrapped.magicNumberLeader && (
          <div className="rounded-2xl bg-[var(--surface-panel)] p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2b2512] flex items-center justify-center text-[#f5b800]">
                  <Snowflake className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Efeito Bola de Neve</h4>
                  <p className="text-[11px] text-zinc-400">
                    Líder rumo ao Número Mágico:{' '}
                    <span className="text-[#f5b800] font-bold">
                      {wrapped.magicNumberLeader.ticker}
                    </span>
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#f5b800] tabular-nums">
                {wrapped.magicNumberLeader.progressPercent}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#f5b800] transition-all duration-500"
                style={{ width: `${wrapped.magicNumberLeader.progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 tabular-nums">
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
        {!isPrivacyMode && wrapped.totalDividends > 0 && (
          <div className="rounded-2xl bg-[var(--surface-panel)] p-3.5 mb-4 grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-[var(--surface-card)]">
              <Coffee className="w-4 h-4 text-[#f5b800] mx-auto mb-1" />
              <div className="text-xs font-bold text-white tabular-nums">
                ~{wrapped.coffeeCupsPaid} cafés
              </div>
              <div className="text-[11px] text-zinc-500">pagos pelos FIIs</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--surface-card)]">
              <Zap className="w-4 h-4 text-[#f5b800] mx-auto mb-1" />
              <div className="text-xs font-bold text-white tabular-nums">
                {wrapped.energyBillPaidPercent}% da conta
              </div>
              <div className="text-[11px] text-zinc-500">de luz bancada</div>
            </div>
          </div>
        )}

        {/* FRASE DE IMPACTO */}
        <div className="p-3.5 rounded-2xl bg-[var(--surface-panel)] mb-5 text-center">
          <p className="text-xs italic text-zinc-300 mb-1">
            &ldquo;{wrapped.quote.text}&rdquo;
          </p>
          <span className="text-[11px] font-bold text-[#f5b800]">
            — {wrapped.quote.author}
          </span>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={isPrivacyMode}
          title={isPrivacyMode ? 'Desative o modo privacidade para exportar os valores da carteira.' : undefined}
          className="w-full mb-3 py-3 rounded-full border border-white/[0.08] bg-[var(--surface-panel)] text-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
        >
          {exportedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4 text-[#f5b800]" />}
          <span aria-live="polite">
            {isPrivacyMode
              ? 'Desative a privacidade para exportar valores'
              : exportedSuccess
                ? 'CSV exportado'
                : 'Exportar resumo do mês (.csv)'}
          </span>
        </button>

        {/* BOTÕES DE AÇÃO EM PÍLULA ESTILO XP */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="py-3 rounded-full bg-[#2b2512] text-[#f5b800] text-xs font-bold text-center active:scale-95 transition-all"
          >
            Fechar
          </button>

          <button
            onClick={handleShare}
            className="py-3 rounded-full bg-[#f5b800] hover:bg-[#ffca28] text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 stroke-[2.5]" />
                <span>Compartilhar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
