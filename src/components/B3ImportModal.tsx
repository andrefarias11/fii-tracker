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
} from 'lucide-react';
import { parseB3FileBuffer, B3ParseResult } from '../lib/b3Parser';
import { Transaction } from '../types/portfolio';
import confetti from 'canvas-confetti';

interface B3ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTransactions: (newTransactions: Transaction[], replaceAll: boolean) => Promise<void>;
}

export function B3ImportModal({
  isOpen,
  onClose,
  onImportTransactions,
}: B3ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<B3ParseResult | null>(null);
  const [filterOnlyFIIs, setFilterOnlyFIIs] = useState<boolean>(true);
  const [replaceAll, setReplaceAll] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setParseResult(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const result = parseB3FileBuffer(buffer, filterOnlyFIIs);
      setParseResult(result);
    } catch {
      setParseResult({
        success: false,
        transactions: [],
        summary: { totalRows: 0, fiiRowsFound: 0, nonFiiRowsSkipped: 0, totalAmountInvested: 0 },
        error: 'Erro inesperado ao processar arquivo.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.transactions.length === 0) return;

    setIsSaving(true);
    try {
      await onImportTransactions(parseResult.transactions, replaceAll);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#059669', '#38bdf8'],
      });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar importação:', err);
      alert('Erro ao salvar no banco de dados. Tente novamente.');
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
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Importar Extrato da B3</h2>
              <p className="text-xs text-zinc-400">Puxe seu histórico real de FIIs da XP</p>
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
                3. No menu, clique em <strong>Extratos</strong> → <strong>Negociação</strong>.
              </p>
              <p>
                4. Escolha o período desejado e clique no botão <strong>Exportar para Excel (.xlsx)</strong>.
              </p>
              <p className="text-[11px] text-zinc-400 pt-1">
                💡 O arquivo baixado é 100% processado no seu próprio navegador, mantendo seus dados financeiros totalmente privados.
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
                Arquivos suportados: .xlsx, .xls ou .csv
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
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Arquivo lido com sucesso!
                </span>
                <div className="text-sm font-bold text-white">
                  {parseResult.transactions.length} compras de FIIs identificadas
                </div>
                <div className="text-xs text-zinc-400">
                  Total investido: <strong className="text-emerald-300">{formatBRL(parseResult.summary.totalAmountInvested)}</strong>
                </div>
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

            {/* Opções de Importação */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-xs">
              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterOnlyFIIs}
                  onChange={(e) => {
                    setFilterOnlyFIIs(e.target.checked);
                    if (file) handleFileChange(file);
                  }}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Importar apenas FIIs (código terminando em 11)</span>
              </label>

              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={(e) => setReplaceAll(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Substituir carteira atual (apaga os dados demo anteriores)</span>
              </label>
            </div>

            {/* Lista Resumo dos Fundos Encontrados */}
            <div>
              <span className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">
                Prévia dos Aportes:
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {parseResult.transactions.slice(0, 15).map((t, idx) => (
                  <div
                    key={`${t.ticker}-${idx}`}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white mr-2">{t.ticker}</span>
                      <span className="text-zinc-400">
                        {t.shares} cotas a {formatBRL(t.price)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-zinc-200 block">{formatBRL(t.total)}</span>
                      <span className="text-[10px] text-zinc-500">{t.date}</span>
                    </div>
                  </div>
                ))}
                {parseResult.transactions.length > 15 && (
                  <div className="text-center text-[11px] text-zinc-500 py-1">
                    + {parseResult.transactions.length - 15} outros aportes encontrados
                  </div>
                )}
              </div>
            </div>

            {/* Botão de Confirmação */}
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isSaving}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isSaving
                ? 'Salvando no Supabase...'
                : `Confirmar e Importar ${parseResult.transactions.length} Aportes`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
