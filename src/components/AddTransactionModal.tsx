'use client';

import { useState, useEffect } from 'react';
import { X, Search, Check, Sparkles, ArrowDownLeft, ArrowUpRight, AlertCircle } from 'lucide-react';
import { findFiiInfo } from '../data/fiiDatabase';
import { Transaction } from '../types/portfolio';

interface AddTransactionModalProps {
  isOpen: boolean;
  initialTicker?: string;
  editingTransaction?: Transaction | null;
  monthlyTarget?: number;
  currentMonthInvested?: number;
  onClose: () => void;
  onAddTransaction: (data: {
    ticker: string;
    type?: 'BUY' | 'SELL';
    date: string;
    shares: number;
    price: number;
    broker?: string;
    notes?: string;
  }) => void;
  onUpdateTransaction?: (
    id: string,
    data: {
      ticker: string;
      type?: 'BUY' | 'SELL';
      date: string;
      shares: number;
      price: number;
      broker?: string;
      notes?: string;
    }
  ) => void;
}

const POPULAR_SUGGESTIONS = ['MXRF11', 'VGIR11', 'CPTS11', 'KISU11', 'XPML11', 'HGLG11', 'KNCR11'];

export function AddTransactionModal({
  isOpen,
  initialTicker = '',
  editingTransaction = null,
  monthlyTarget = 200,
  currentMonthInvested = 0,
  onClose,
  onAddTransaction,
  onUpdateTransaction,
}: AddTransactionModalProps) {
  const [txType, setTxType] = useState<'BUY' | 'SELL'>(
    editingTransaction?.type === 'SELL' ? 'SELL' : 'BUY'
  );
  const [ticker, setTicker] = useState(
    editingTransaction ? editingTransaction.ticker : initialTicker
  );
  const [shares, setShares] = useState<number | string>(
    editingTransaction ? editingTransaction.shares : 1
  );
  const [price, setPrice] = useState<number | string>(
    editingTransaction ? editingTransaction.price : ''
  );
  const [date, setDate] = useState<string>(
    editingTransaction ? editingTransaction.date : new Date().toISOString().slice(0, 10)
  );
  const [broker, setBroker] = useState<string>(
    editingTransaction ? editingTransaction.broker : 'XP Investimentos'
  );
  const [notes, setNotes] = useState<string>(editingTransaction?.notes || '');
  const [isFetchingPrice, setIsFetchingPrice] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadPriceForTicker = async (targetTicker: string) => {
    const clean = targetTicker.toUpperCase().trim();
    if (!clean) return;

    setIsFetchingPrice(true);
    try {
      const res = await fetch(`/api/quote?tickers=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        const quote = data.quotes?.[clean];
        if (quote?.price) {
          setPrice(quote.price);
          return;
        }
      }
    } catch {
      // Falha silenciosa
    } finally {
      setIsFetchingPrice(false);
    }

    const info = findFiiInfo(clean);
    setPrice(info.base === 10 ? 9.5 : 100.0);
  };

  useEffect(() => {
    if (!isOpen || editingTransaction || !initialTicker) return;
    let active = true;
    const clean = initialTicker.toUpperCase().trim();
    if (!clean) return;

    fetch(`/api/quote?tickers=${encodeURIComponent(clean)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const quote = data?.quotes?.[clean];
        if (quote?.price) {
          setPrice(quote.price);
        } else {
          const info = findFiiInfo(clean);
          setPrice(info.base === 10 ? 9.5 : 100.0);
        }
      })
      .catch(() => {
        if (!active) return;
        const info = findFiiInfo(clean);
        setPrice(info.base === 10 ? 9.5 : 100.0);
      });

    return () => {
      active = false;
    };
  }, [isOpen, initialTicker, editingTransaction]);

  const handleSelectSuggestion = (suggested: string) => {
    setTicker(suggested);
    loadPriceForTicker(suggested);
  };

  const parsedPrice =
    typeof price === 'number' ? price : parseFloat(price.toString().replace(',', '.') || '0');
  const validPrice = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0;

  const remainingGoal = Math.max(0, monthlyTarget - currentMonthInvested);

  const handleQuickFillByBudget = (budgetAmount: number) => {
    if (validPrice <= 0) return;
    const maxShares = Math.max(1, Math.floor(budgetAmount / validPrice));
    setShares(maxShares);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanTicker = ticker.toUpperCase().trim();
    const numShares = Number(shares);
    const numPrice =
      typeof price === 'number' ? price : parseFloat(price.toString().replace(',', '.'));

    if (!cleanTicker || isNaN(numShares) || numShares <= 0 || isNaN(numPrice) || numPrice <= 0) {
      setErrorMsg('Informe o código do FII, quantidade de cotas e o preço unitário.');
      return;
    }

    const payload = {
      ticker: cleanTicker,
      type: txType,
      shares: numShares,
      price: numPrice,
      date: date || new Date().toISOString().slice(0, 10),
      broker: broker || 'XP Investimentos',
      notes: notes.trim() || undefined,
    };

    if (editingTransaction && onUpdateTransaction) {
      onUpdateTransaction(editingTransaction.id, payload);
    } else {
      onAddTransaction(payload);
    }

    onClose();
  };

  if (!isOpen) return null;

  const currentTotal = Number(shares || 0) * validPrice;

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(isNaN(val) ? 0 : val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {editingTransaction ? 'Editar Lançamento' : 'Registrar Operação'}
              </h2>
              <p className="text-xs text-zinc-400">
                {editingTransaction ? 'Ajuste os dados deste registro' : 'Compra ou venda na sua corretora'}
              </p>
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

        {errorMsg && (
          <div className="mb-3 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Chave Compra vs Venda */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-950 border border-zinc-800 mb-4">
          <button
            type="button"
            onClick={() => setTxType('BUY')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              txType === 'BUY'
                ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Compra (Aporte)
          </button>
          <button
            type="button"
            onClick={() => setTxType('SELL')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              txType === 'SELL'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Venda (Saída)
          </button>
        </div>

        {/* Sugestões Rápidas */}
        <div className="mb-3.5">
          <span className="text-[11px] text-zinc-400 block mb-1.5 font-medium">
            Ativos Populares:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => handleSelectSuggestion(sug)}
                className={`text-xs px-2.5 py-1 rounded-xl font-mono font-medium transition-all ${
                  ticker.toUpperCase() === sug
                    ? 'bg-emerald-500 text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Ticker */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Código do FII (Ticker)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: MXRF11, VGIR11, XPML11"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onBlur={() => loadPriceForTicker(ticker)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-sm text-white font-mono uppercase tracking-wider outline-none focus:border-emerald-500"
                required
              />
              <button
                type="button"
                onClick={() => loadPriceForTicker(ticker)}
                className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-emerald-400"
                title="Buscar cotação ao vivo"
              >
                <Search className={`w-4 h-4 ${isFetchingPrice ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Quantidade de Cotas */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Quantidade de Cotas
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold outline-none focus:border-emerald-500"
                required
              />
            </div>

            {/* Preço Unitário */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Preço por Cota (R$)
              </label>
              <input
                type="text"
                placeholder="Ex: 9.42"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Pílulas Rápidas: Calculadora de Quantas Cotas Comprar */}
          {txType === 'BUY' && validPrice > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-zinc-500 mr-0.5">Calcular cotas:</span>
              {validPrice <= 100 && (
                <button
                  type="button"
                  onClick={() => handleQuickFillByBudget(100)}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  R$ 100 ({Math.floor(100 / validPrice)} cotas)
                </button>
              )}
              {remainingGoal >= validPrice && remainingGoal !== monthlyTarget && (
                <button
                  type="button"
                  onClick={() => handleQuickFillByBudget(remainingGoal)}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                >
                  Falta p/ Meta ({Math.floor(remainingGoal / validPrice)} cotas)
                </button>
              )}
              {monthlyTarget >= validPrice && (
                <button
                  type="button"
                  onClick={() => handleQuickFillByBudget(monthlyTarget)}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  Meta R$ {monthlyTarget} ({Math.floor(monthlyTarget / validPrice)} cotas)
                </button>
              )}
            </div>
          )}

          {/* Resumo da Operação */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between ${
              txType === 'SELL'
                ? 'bg-rose-500/10 border-rose-500/20'
                : 'bg-emerald-500/10 border-emerald-500/20'
            }`}
          >
            <div>
              <span
                className={`text-[11px] block ${
                  txType === 'SELL' ? 'text-rose-300/80' : 'text-emerald-300/80'
                }`}
              >
                {txType === 'SELL' ? 'Valor Total da Venda' : 'Total Deste Aporte'}
              </span>
              <span
                className={`text-lg font-extrabold ${
                  txType === 'SELL' ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {formatBRL(currentTotal)}
              </span>
            </div>
            {txType === 'BUY' ? (
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 block">
                  Impacto na Meta ({formatBRL(monthlyTarget)})
                </span>
                <span className="text-xs font-bold text-zinc-200">
                  {Math.round((currentTotal / Math.max(1, monthlyTarget)) * 100)}% da meta
                </span>
              </div>
            ) : (
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 block">Regra B3 / IRPF</span>
                <span className="text-[11px] font-semibold text-zinc-300">
                  Mantém seu Preço Médio
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Data da Operação */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                required
              />
            </div>

            {/* Corretora */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Corretora</label>
              <select
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
              >
                <option value="XP Investimentos">XP Investimentos</option>
                <option value="BTG Pactual">BTG Pactual</option>
                <option value="NuInvest / Nubank">NuInvest / Nubank</option>
                <option value="Clear Corretora">Clear</option>
                <option value="Inter">Banco Inter</option>
                <option value="Ágora">Ágora</option>
                <option value="Outra">Outra</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Observações (Opcional)
            </label>
            <input
              type="text"
              placeholder={
                txType === 'SELL' ? 'Ex: Reciclagem de carteira' : 'Ex: Aporte mensal'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition-all shadow-lg ${
                txType === 'SELL'
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-rose-500/20'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 shadow-emerald-500/20'
              }`}
            >
              <Check className="w-4 h-4" />
              {editingTransaction
                ? 'Salvar Alterações'
                : txType === 'SELL'
                ? 'Confirmar Venda'
                : 'Confirmar Aporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
