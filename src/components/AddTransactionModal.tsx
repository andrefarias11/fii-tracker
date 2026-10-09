'use client';

import { useState, useEffect } from 'react';
import { X, Search, Check, Sparkles } from 'lucide-react';
import { FII_DATABASE, findFiiInfo } from '../data/fiiDatabase';

interface AddTransactionModalProps {
  isOpen: boolean;
  initialTicker?: string;
  onClose: () => void;
  onAddTransaction: (data: {
    ticker: string;
    date: string;
    shares: number;
    price: number;
    broker?: string;
    notes?: string;
  }) => void;
}

const POPULAR_SUGGESTIONS = ['MXRF11', 'VGIR11', 'CPTS11', 'KISU11', 'XPML11', 'HGLG11', 'KNCR11'];

export function AddTransactionModal({
  isOpen,
  initialTicker = '',
  onClose,
  onAddTransaction,
}: AddTransactionModalProps) {
  const [ticker, setTicker] = useState(initialTicker);
  const [shares, setShares] = useState<number | string>(1);
  const [price, setPrice] = useState<number | string>('');
  const [date, setDate] = useState<string>('');
  const [broker, setBroker] = useState<string>('XP Investimentos');
  const [notes, setNotes] = useState<string>('');
  const [isFetchingPrice, setIsFetchingPrice] = useState<boolean>(false);

  useEffect(() => {
    if (!date) {
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [date]);

  useEffect(() => {
    if (initialTicker) {
      setTicker(initialTicker);
      loadPriceForTicker(initialTicker);
    }
  }, [initialTicker]);

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

    // Fallback: se não tiver cotação ao vivo, usa valor padrão da base
    const info = findFiiInfo(clean);
    if (!price) {
      setPrice(info.base === 10 ? 9.50 : 100.00);
    }
  };

  const handleSelectSuggestion = (suggested: string) => {
    setTicker(suggested);
    loadPriceForTicker(suggested);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = ticker.toUpperCase().trim();
    const numShares = Number(shares);
    const numPrice = typeof price === 'number' ? price : parseFloat(price.toString().replace(',', '.'));

    if (!cleanTicker || isNaN(numShares) || numShares <= 0 || isNaN(numPrice) || numPrice <= 0) {
      alert('Por favor, informe um código válido, quantidade de cotas e valor pago.');
      return;
    }

    onAddTransaction({
      ticker: cleanTicker,
      shares: numShares,
      price: numPrice,
      date: date || new Date().toISOString().slice(0, 10),
      broker: broker || 'XP Investimentos',
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  const currentTotal =
    Number(shares || 0) * (typeof price === 'number' ? price : parseFloat(price.toString().replace(',', '.') || '0'));

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
              <h2 className="text-base font-bold text-white">Registrar Novo Aporte</h2>
              <p className="text-xs text-zinc-400">Adicione suas compras feitas na XP</p>
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

        {/* Sugestões Rápidas */}
        <div className="mb-4">
          <span className="text-[11px] text-zinc-400 block mb-1.5 font-medium">Sugestões Populares (Base 10 / Base 100):</span>
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

          {/* Resumo do Aporte */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-emerald-300/80 block">Total Deste Aporte</span>
              <span className="text-lg font-extrabold text-emerald-400">
                {formatBRL(currentTotal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-400 block">Impacto na Meta (R$ 200)</span>
              <span className="text-xs font-bold text-zinc-200">
                {Math.round((currentTotal / 200) * 100)}% da meta
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Data da Compra */}
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
              placeholder="Ex: Aporte mensal de outubro"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Check className="w-4 h-4" />
              Confirmar Aporte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
