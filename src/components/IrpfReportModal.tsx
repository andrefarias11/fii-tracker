'use client';

import { useMemo, useState } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  Coins,
  Building2,
  Scale,
  Download,
} from 'lucide-react';
import { FixedIncomeAsset, Transaction } from '../types/portfolio';
import { generateIrpfAnnualReport } from '../lib/irpfEngine';
import { downloadCsvFile } from '../lib/csvExport';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { triggerHaptic } from '../lib/haptic';

interface IrpfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  fixedIncomeAssets?: FixedIncomeAsset[];
  isPrivacyMode?: boolean;
}

type IrpfSectionTab = 'BENS' | 'RENDIMENTOS' | 'VENDAS';

export function IrpfReportModal({
  isOpen,
  onClose,
  transactions,
  fixedIncomeAssets = [],
  isPrivacyMode = false,
}: IrpfReportModalProps) {
  const baseReport = useMemo(
    () => generateIrpfAnnualReport(transactions, fixedIncomeAssets),
    [transactions, fixedIncomeAssets]
  );

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const activeYear = selectedYear ?? baseReport.calendarYear;

  const report = useMemo(
    () => generateIrpfAnnualReport(transactions, fixedIncomeAssets, activeYear),
    [transactions, fixedIncomeAssets, activeYear]
  );

  const [section, setSection] = useState<IrpfSectionTab>('BENS');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const dialogRef = useModalAccessibility(isOpen, onClose);
  if (!isOpen) return null;

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const handleCopyText = async (key: string, text: string) => {
    if (isPrivacyMode) return;
    triggerHaptic('selection');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // Silencioso caso clipboard não esteja disponível
    }
  };

  const handleExportIrpfCsv = () => {
    if (isPrivacyMode) return;
    triggerHaptic('light');
    const escapeCell = (v: string | number) => {
      const s = String(v);
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const fmt = (n: number) => n.toFixed(2).replace('.', ',');

    const rows: string[][] = [
      ['RELATÓRIO AUXILIAR IRPF - FII TRACKER', `Ano-Calendário ${report.calendarYear} (Exercício ${report.declarationYear})`],
      [],
      ['FICHA: BENS E DIREITOS (CUSTO HISTÓRICO DE AQUISIÇÃO)'],
      ['Ticker', 'Ficha / Código', 'Corretora Principal', `Qtd em 31/12/${report.calendarYear - 1}`, `Situação em 31/12/${report.calendarYear - 1} (R$)`, `Qtd em 31/12/${report.calendarYear}`, `Situação em 31/12/${report.calendarYear} (R$)`, 'Discriminação Sugerida'],
      ...report.bensEDireitos.map((item) => [
        item.ticker,
        item.codeLabel,
        item.broker,
        String(item.sharesPrevYear).replace('.', ','),
        fmt(item.costBasisPrevYear),
        String(item.sharesEndOfYear).replace('.', ','),
        fmt(item.costBasisEndOfYear),
        item.discriminacao,
      ]),
      [],
      ['FICHA: RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS'],
      ['Ticker', 'Nome', 'Código IRPF', 'Pagamentos no Ano', 'Total Recebido (R$)'],
      ...report.rendimentosIsentos.map((inc) => [
        inc.ticker,
        inc.name,
        inc.codeLabel,
        String(inc.paymentsCount),
        fmt(inc.totalAmount),
      ]),
      [],
      ['FICHA: RENDIMENTOS SUJEITOS À TRIBUTAÇÃO EXCLUSIVA (JCP)'],
      ['Ticker', 'Nome', 'Código IRPF', 'Pagamentos no Ano', 'Total Líquido (R$)'],
      ...report.rendimentosExclusivosJcp.map((inc) => [
        inc.ticker,
        inc.name,
        inc.codeLabel,
        String(inc.paymentsCount),
        fmt(inc.totalAmount),
      ]),
    ];

    const csv = `\uFEFF${rows.map((r) => r.map(escapeCell).join(';')).join('\r\n')}`;
    downloadCsvFile(`irpf-auxiliar-${report.calendarYear}-fii-tracker.csv`, csv);
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--surface-card)] border border-white/[0.08] rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 pb-safe-modal shadow-2xl max-h-[88dvh] overflow-y-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg border border-white/80 flex items-center justify-center text-white shrink-0">
              <FileText className="w-4 h-4 text-[#f5b800]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#f5b800] bg-[#2b2512] px-2.5 py-0.5 rounded-full">
                  Auxiliar IRPF {report.declarationYear}
                </span>
                <span className="text-[11px] text-zinc-400">
                  Ano-base {report.calendarYear}
                </span>
              </div>
              <h2 className="text-base font-bold text-white truncate mt-0.5">
                Relatório Anual para Imposto de Renda
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-[var(--surface-panel)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor de Ano-Calendário + Exportar CSV */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {report.availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedYear(yr);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold tabular-nums transition-all ${
                  yr === report.calendarYear
                    ? 'bg-[#f5b800] text-zinc-950'
                    : 'bg-[var(--surface-panel)] text-zinc-400 hover:text-white'
                }`}
              >
                Ano {yr}
              </button>
            ))}
          </div>

          {!isPrivacyMode && (
            <button
              type="button"
              onClick={handleExportIrpfCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-panel)] border border-white/[0.08] text-xs font-semibold text-zinc-200 hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#f5b800]" />
              Exportar CSV
            </button>
          )}
        </div>

        {/* Cards Resumo do Ano */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="p-3.5 rounded-2xl bg-[var(--surface-panel)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
              Custo em 31/12/{report.calendarYear}
            </span>
            <span className="text-base font-bold text-white tabular-nums mt-0.5 block">
              {formatBRL(report.totals.costBasisEndOfYear)}
            </span>
            <span className="text-[10px] text-zinc-500 tabular-nums">
              31/12/{report.calendarYear - 1}: {formatBRL(report.totals.costBasisPrevYear)}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[var(--surface-panel)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
              Proventos Isentos ({report.calendarYear})
            </span>
            <span className="text-base font-bold text-emerald-400 tabular-nums mt-0.5 block">
              {formatBRL(report.totals.totalExemptIncome)}
            </span>
            <span className="text-[10px] text-zinc-500 tabular-nums">
              JCP Exclusivo: {formatBRL(report.totals.totalExclusiveJcp)}
            </span>
          </div>
        </div>

        {/* Abas Internas: Bens e Direitos | Rendimentos | Vendas */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[var(--surface-panel)] border border-white/[0.04] mb-4">
          <button
            type="button"
            onClick={() => setSection('BENS')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              section === 'BENS'
                ? 'bg-[#2b2512] text-[#f5b800]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            Bens ({report.bensEDireitos.length})
          </button>
          <button
            type="button"
            onClick={() => setSection('RENDIMENTOS')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              section === 'RENDIMENTOS'
                ? 'bg-[#2b2512] text-[#f5b800]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5 shrink-0" />
            Proventos ({report.rendimentosIsentos.length + report.rendimentosExclusivosJcp.length})
          </button>
          <button
            type="button"
            onClick={() => setSection('VENDAS')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              section === 'VENDAS'
                ? 'bg-[#2b2512] text-[#f5b800]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5 shrink-0" />
            Vendas ({report.realizedSales.length})
          </button>
        </div>

        {/* Conteúdo da Aba Selecionada */}
        {section === 'BENS' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Pela regra da Receita Federal, FIIs e Ações são declarados sempre pelo{' '}
              <strong className="text-white">custo histórico de aquisição</strong> (nunca pela cotação de mercado).
            </p>

            {report.bensEDireitos.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[var(--surface-panel)] text-center text-xs text-zinc-400">
                Nenhuma posição de Bolsa em 31/12/{report.calendarYear - 1} ou 31/12/{report.calendarYear}.
              </div>
            ) : (
              report.bensEDireitos.map((item) => {
                const copyId = `bens-${item.ticker}`;
                const isCopied = copiedKey === copyId;
                return (
                  <div
                    key={item.ticker}
                    className="p-4 rounded-2xl bg-[var(--surface-panel)] border border-white/[0.06] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{item.ticker}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]">
                            {item.codeLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {item.name} • Custódia: {item.broker}
                        </p>
                      </div>

                      {!isPrivacyMode && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(copyId, item.discriminacao)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[var(--surface-card)] border border-white/[0.08] text-[11px] font-semibold text-zinc-200 hover:text-[#f5b800] shrink-0 transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar texto</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                      <div className="p-2.5 rounded-xl bg-[var(--surface-card)]">
                        <span className="text-[10px] text-zinc-400 block">
                          Situação em 31/12/{report.calendarYear - 1}
                        </span>
                        <span className="font-bold text-zinc-200 tabular-nums">
                          {formatBRL(item.costBasisPrevYear)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[var(--surface-card)]">
                        <span className="text-[10px] text-zinc-400 block">
                          Situação em 31/12/{report.calendarYear}
                        </span>
                        <span className="font-bold text-white tabular-nums">
                          {formatBRL(item.costBasisEndOfYear)}
                        </span>
                      </div>
                    </div>

                    {!isPrivacyMode && (
                      <p className="text-[11px] text-zinc-400 bg-[var(--surface-card)] p-2.5 rounded-xl leading-relaxed font-mono">
                        {item.discriminacao}
                      </p>
                    )}
                  </div>
                );
              })
            )}

            {report.rendaFixaItems.length > 0 && (
              <div className="pt-2 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Referência de Renda Fixa & Caixinhas Cadastradas
                </h3>
                {report.rendaFixaItems.map((fi) => (
                  <div
                    key={fi.id}
                    className="p-3.5 rounded-2xl bg-[var(--surface-panel)] border border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{fi.name}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300">
                          {fi.codeLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                        {fi.institution} • Aplicado: {formatBRL(fi.investedAmount)} (confira informe do banco)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === 'RENDIMENTOS' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Ficha: Rendimentos Isentos e Não Tributáveis
              </h3>
              {report.rendimentosIsentos.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[var(--surface-panel)] text-xs text-zinc-400">
                  Nenhum rendimento isento registrado no extrato em {report.calendarYear}. Importe a planilha de Movimentação da B3 daquele ano para consolidar automaticamente.
                </div>
              ) : (
                <div className="rounded-2xl bg-[var(--surface-panel)] border border-white/[0.06] divide-y divide-white/[0.06]">
                  {report.rendimentosIsentos.map((inc) => (
                    <div
                      key={`${inc.ticker}-${inc.itemCode}`}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{inc.ticker}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
                            Cód. {inc.itemCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {inc.name} • {inc.paymentsCount}{' '}
                          {inc.paymentsCount === 1 ? 'pagamento' : 'pagamentos'}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-400 tabular-nums shrink-0">
                        {formatBRL(inc.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {report.rendimentosExclusivosJcp.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#f5b800]">
                  Ficha: Tributação Exclusiva / Definitiva (JCP - Cód. 10)
                </h3>
                <div className="rounded-2xl bg-[var(--surface-panel)] border border-white/[0.06] divide-y divide-white/[0.06]">
                  {report.rendimentosExclusivosJcp.map((inc) => (
                    <div
                      key={`${inc.ticker}-jcp`}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-white">{inc.ticker}</span>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {inc.name} • {inc.paymentsCount}{' '}
                          {inc.paymentsCount === 1 ? 'crédito JCP' : 'créditos JCP'}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[#f5b800] tabular-nums shrink-0">
                        {formatBRL(inc.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {section === 'VENDAS' && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Vendas de FIIs/Fiagros não possuem isenção de R$ 20 mil mensais (alíquota de 20% sobre lucro líquido, compensável com prejuízos anteriores da mesma classe).
            </p>
            {report.realizedSales.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[var(--surface-panel)] text-center text-xs text-zinc-400">
                Nenhuma venda registrada em {report.calendarYear}.
              </div>
            ) : (
              <div className="rounded-2xl bg-[var(--surface-panel)] border border-white/[0.06] divide-y divide-white/[0.06]">
                {report.realizedSales.map((sale, idx) => (
                  <div
                    key={`${sale.month}-${sale.ticker}-${idx}`}
                    className="p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{sale.ticker}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 tabular-nums">
                          {sale.month.split('-').reverse().join('/')}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 tabular-nums mt-0.5">
                        Venda: {formatBRL(sale.saleTotal)} • Custo baixa: {formatBRL(sale.costBasisSold)}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums shrink-0 ${
                        sale.realizedResult >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {sale.realizedResult >= 0 ? '+' : ''}
                      {formatBRL(sale.realizedResult)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-[10px] text-zinc-500 leading-relaxed">
           Demonstrativo auxiliar calculado a partir das suas transações registradas. Confira sempre com os Informes de Rendimentos oficiais enviados pelos escrituradores e corretoras.
        </p>
      </div>
    </div>
  );
}
