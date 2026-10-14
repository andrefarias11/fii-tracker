'use client';

import { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  parseB3FileBuffer,
  B3ParseResult,
  deduplicateB3Transactions,
  classifyB3Ticker,
} from '../lib/b3Parser';
import { Transaction } from '../types/portfolio';
import confetti from 'canvas-confetti';
import { triggerHaptic } from '../lib/haptic';

interface B3ImportModalProps {
  isOpen: boolean;
  existingTransactions?: Transaction[];
  onClose: () => void;
  onImportTransactions: (newTransactions: Transaction[], replaceAll: boolean) => Promise<void>;
}

export function B3ImportModal({
  isOpen,
  existingTransactions = [],
  onClose,
  onImportTransactions,
}: B3ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<B3ParseResult | null>(null);
  const [filterOnlyFIIs, setFilterOnlyFIIs] = useState<boolean>(false);
  const [replaceAll, setReplaceAll] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File, onlyFiis = filterOnlyFIIs) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setParseResult(null);
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const result = parseB3FileBuffer(buffer, onlyFiis);
      setParseResult(result);
    } catch {
      setParseResult({
        success: false,
        transactions: [],
        summary: {
          totalRows: 0,
          fiiRowsFound: 0,
          nonFiiRowsSkipped: 0,
          intraFileDuplicatesRemoved: 0,
          uniqueTickersFound: [],
          totalAmountInvested: 0,
        },
        error: 'Erro inesperado ao processar arquivo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const dedupInfo =
    parseResult?.success && !replaceAll
      ? deduplicateB3Transactions(parseResult.transactions, existingTransactions)
      : {
          uniqueTransactions: parseResult?.transactions || [],
          skippedTransactions: [] as Transaction[],
          duplicatesCount: 0,
        };

  const transactionsToImport = dedupInfo.uniqueTransactions;
  const existingRealTickers = new Set(
    existingTransactions.filter((t) => !t.id.startsWith('demo-')).map((t) => t.ticker)
  );

  const handleConfirmImport = async () => {
    if (!parseResult || transactionsToImport.length === 0) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onImportTransactions(transactionsToImport, replaceAll);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#059669', '#38bdf8'],
      });
      triggerHaptic('success');
      onClose();
    } catch (err) {
      console.error('Erro ao salvar importação:', err);
      setErrorMessage('Erro ao salvar no banco de dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-[28px] sm:rounded-[28px] p-6 pb-safe-modal shadow-2xl max-h-[88dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Importar Extrato da B3</h2>
              <p className="text-xs text-zinc-400">Com filtro automático anti-duplicidade</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Botão de Tutorial Como Baixar */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowTutorial(!showTutorial)}
            className="w-full p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between text-left text-xs text-zinc-300 hover:border-zinc-700 transition-all"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              Como baixar a planilha no portal da B3?
            </span>
            <span className="text-[11px] font-semibold text-emerald-400">
              {showTutorial ? 'Ocultar' : 'Ver passo a passo'}
            </span>
          </button>

          {showTutorial && (
            <div className="mt-2.5 p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 text-xs text-zinc-300 space-y-2 leading-relaxed animate-in fade-in">
              <p>
                1. Acesse o portal oficial da bolsa:{' '}
                <a
                  href="https://investidor.b3.com.br"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline font-semibold inline-flex items-center gap-1"
                >
                  investidor.b3.com.br <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <p>2. Faça login com seu CPF ou conta <strong>gov.br</strong>.</p>
              <p>
                3. No menu <strong>Extratos</strong>, você pode exportar tanto a planilha de <strong>Negociação</strong> (compras e vendas) quanto a de <strong>Movimentação</strong> (Rendimentos, Dividendos e JCP pagos).
              </p>
              <p>
                4. Escolha o período desejado e clique em <strong>Exportar para Excel (.xlsx)</strong>.
              </p>
              <p className="text-[11px] text-zinc-400 pt-1">
                💡 Você pode subir a planilha do ano inteiro sem medo: o sistema ignora sozinho os lançamentos e proventos que você já importou antes.
              </p>
            </div>
          )}
        </div>

        {/* Área de Upload / Dropzone */}
        {!parseResult?.success ? (
          <div className="mb-4">
            <label className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/80 rounded-3xl p-7 flex flex-col items-center justify-center cursor-pointer bg-zinc-950/40 hover:bg-zinc-950/70 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 flex items-center justify-center mb-3 transition-all text-zinc-400">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-white mb-1">
                {file ? file.name : 'Selecione a planilha da B3'}
              </span>
              <span className="text-xs text-zinc-500">
                Negociação ou Movimentação (.xlsx, .xls ou .csv)
              </span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChange(f);
                }}
                className="hidden"
              />
            </label>

            {isProcessing && (
              <p className="text-xs text-emerald-400 text-center mt-2 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Lendo e processando planilha...
              </p>
            )}

            {parseResult?.error && (
              <div className="mt-3 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{parseResult.error}</span>
              </div>
            )}
          </div>
        ) : (
          /* Prévia das Transações Encontradas */
          <div className="space-y-4 mb-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Arquivo lido com sucesso!
                  </span>
                  <div className="text-sm font-bold text-white">
                    {transactionsToImport.length}{' '}
                    {transactionsToImport.length === 1
                      ? 'novo lançamento para importar'
                      : 'novos lançamentos para importar'}
                  </div>
                  {transactionsToImport.some((t) => t.type === 'BUY' || !t.type) && (
                    <div className="text-xs text-zinc-400">
                      Volume das novas compras:{' '}
                      <strong className="text-emerald-300">
                        {formatBRL(
                          transactionsToImport
                            .filter((t) => t.type === 'BUY' || !t.type)
                            .reduce((acc, t) => acc + t.total, 0)
                        )}
                      </strong>
                    </div>
                  )}
                  {transactionsToImport.some((t) => t.type === 'DIVIDEND') && (
                    <div className="text-xs text-zinc-400">
                      Proventos reais B3 (Movimentação):{' '}
                      <strong className="text-amber-300">
                        +{formatBRL(
                          transactionsToImport
                            .filter((t) => t.type === 'DIVIDEND')
                            .reduce((acc, t) => acc + t.total, 0)
                        )}
                      </strong>{' '}
                      ({transactionsToImport.filter((t) => t.type === 'DIVIDEND').length} pagamentos)
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setParseResult(null);
                    setFile(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline"
                >
                  Trocar arquivo
                </button>
              </div>

              {parseResult.summary.uniqueTickersFound && parseResult.summary.uniqueTickersFound.length > 0 && (
                <div className="pt-2 border-t border-emerald-500/20">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block mb-1.5">
                    Ativos Consolidados ({parseResult.summary.uniqueTickersFound.length} tickers únicos):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {parseResult.summary.uniqueTickersFound.map((ticker) => {
                      const isStock = classifyB3Ticker(ticker) === 'ACAO';
                      return (
                        <span
                          key={ticker}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                            isStock
                              ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          }`}
                        >
                          {ticker}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {((dedupInfo.duplicatesCount > 0 && !replaceAll) ||
                (parseResult.summary.intraFileDuplicatesRemoved || 0) > 0) && (
                <div className="pt-2 border-t border-emerald-500/20 flex items-center gap-1.5 text-[11px] text-sky-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    {dedupInfo.duplicatesCount > 0 && !replaceAll && (
                      <>
                        <strong>{dedupInfo.duplicatesCount}</strong>{' '}
                        {dedupInfo.duplicatesCount === 1
                          ? 'aporte já existente foi ignorado'
                          : 'aportes já existentes foram ignorados'}
                        .{' '}
                      </>
                    )}
                    {(parseResult.summary.intraFileDuplicatesRemoved || 0) > 0 && (
                      <>
                        <strong>{parseResult.summary.intraFileDuplicatesRemoved}</strong>{' '}
                        linhas repetidas na própria planilha foram mescladas/removidas.
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Opções de Importação */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-xs">
              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterOnlyFIIs}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFilterOnlyFIIs(checked);
                    if (file) handleFileChange(file, checked);
                  }}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Ignorar Ações (importar apenas FIIs)</span>
              </label>

              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={(e) => setReplaceAll(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Substituir carteira inteira (apaga todos os dados anteriores)</span>
              </label>
            </div>

            {/* Lista Resumo dos Ativos Encontrados */}
            {transactionsToImport.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">
                    Novos Lançamentos a Importar ({transactionsToImport.length}):
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {transactionsToImport.slice(0, 15).map((t, idx) => {
                      const alreadyInPortfolio = existingRealTickers.has(t.ticker);
                      const isStock = classifyB3Ticker(t.ticker) === 'ACAO';
                      const isDividend = t.type === 'DIVIDEND';
                      return (
                        <div
                          key={`${t.ticker}-${idx}`}
                          className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white">{t.ticker}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isDividend
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  : t.type === 'SELL'
                                  ? 'bg-rose-500/15 text-rose-400'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}
                            >
                              {isDividend
                                ? 'Provento B3'
                                : t.type === 'SELL'
                                ? 'Venda'
                                : 'Compra'}
                            </span>
                            {!isDividend && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300">
                                {alreadyInPortfolio
                                  ? isStock
                                    ? '+ Somar ações'
                                    : '+ Somar cotas'
                                  : isStock
                                  ? 'Nova Ação'
                                  : 'Novo FII'}
                              </span>
                            )}
                            <span className="text-zinc-400">
                              {isDividend
                                ? t.notes?.replace(/^\[PROVENTO B3\]\s*/i, '') || 'Rendimento'
                                : `${t.shares} ${isStock ? 'ações' : 'cotas'} a ${formatBRL(t.price)}`}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`font-semibold block ${
                                isDividend ? 'text-emerald-400' : 'text-zinc-200'
                              }`}
                            >
                              {isDividend ? '+' : ''}
                              {formatBRL(t.total)}
                            </span>
                            <span className="text-[10px] text-zinc-500">{t.date}</span>
                          </div>
                        </div>
                      );
                    })}
                    {transactionsToImport.length > 15 && (
                      <div className="text-center text-[11px] text-zinc-500 py-1">
                        + {transactionsToImport.length - 15} outros lançamentos encontrados
                      </div>
                    )}
                  </div>
                </div>

                {dedupInfo.skippedTransactions.length > 0 && !replaceAll && (
                  <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block mb-1">
                      Ignorados por já estarem no sistema ({dedupInfo.skippedTransactions.length}):
                    </span>
                    <div className="text-[11px] text-zinc-400 space-y-0.5 max-h-24 overflow-y-auto">
                      {dedupInfo.skippedTransactions.slice(0, 8).map((s, i) => (
                        <div key={`${s.ticker}-skip-${i}`} className="flex items-center justify-between">
                          <span>
                            ✓ <strong className="text-zinc-300">{s.ticker}</strong> ({s.shares} cotas a {formatBRL(s.price)})
                          </span>
                          <span className="text-[10px] text-zinc-500">{s.date} (já importado)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-center text-xs text-zinc-400">
                Todos os {parseResult.transactions.length} lançamentos desta planilha já estão cadastrados na sua carteira!
              </div>
            )}

            {/* Botão de Confirmação */}
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isSaving || transactionsToImport.length === 0}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" />
              {isSaving
                ? 'Salvando...'
                : transactionsToImport.length === 0
                ? 'Nenhum Novo Aporte para Importar'
                : `Importar ${transactionsToImport.length} ${
                    transactionsToImport.length === 1 ? 'Novo Lançamento' : 'Novos Lançamentos'
                  }`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

