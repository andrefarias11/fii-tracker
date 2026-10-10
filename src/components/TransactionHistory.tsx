'use client';

import { useState, useMemo } from 'react';
import { Transaction } from '../types/portfolio';
import { Trash2, Edit2, Calendar, Building2 } from 'lucide-react';

interface TransactionHistoryProps {
  transactions: Transaction[];
  onEditTransaction?: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export function TransactionHistory({
  transactions,
  onEditTransaction,
  onDeleteTransaction,
}: TransactionHistoryProps) {
  const [selectedTicker, setSelectedTicker] = useState<string>('TODOS');

  const uniqueTickers = useMemo(() => {
    return Array.from(new Set(transactions.map((t) => t.ticker))).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedTicker === 'TODOS') return transactions;
    return transactions.filter((t) => t.ticker === selectedTicker);
  }, [transactions, selectedTicker]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-8 text-center">
        <p className="text-sm text-zinc-400">Nenhum aporte registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filtro rápido por FII (exibido apenas se houver mais de 1 ativo) */}
      {uniqueTickers.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedTicker('TODOS')}
            className={`text-xs px-3 py-1 rounded-xl whitespace-nowrap font-medium transition-all ${
              selectedTicker === 'TODOS'
                ? 'bg-emerald-500 text-zinc-950 font-bold'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Todos ({transactions.length})
          </button>
          {uniqueTickers.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTicker(t)}
              className={`text-xs px-3 py-1 rounded-xl whitespace-nowrap font-mono font-medium transition-all ${
                selectedTicker === t
                  ? 'bg-emerald-500 text-zinc-950 font-bold'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2.5">
        {filteredTransactions.map((tx) => (
          <div
            key={tx.id}
            className="rounded-2xl bg-zinc-900 border border-zinc-800/80 p-3.5 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-white">{tx.ticker}</span>
                <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {tx.shares} {tx.shares === 1 ? 'cota' : 'cotas'}
                </span>
                <span className="text-[11px] text-zinc-400">a {formatBRL(tx.price)}</span>
              </div>

              <div className="flex items-center gap-2.5 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-500" />
                  {formatDate(tx.date)}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-zinc-500" />
                  {tx.broker}
                </span>
                {tx.notes && <span className="text-zinc-500 truncate max-w-[110px]">• {tx.notes}</span>}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white mr-1">{formatBRL(tx.total)}</span>
              {onEditTransaction && (
                <button
                  type="button"
                  onClick={() => onEditTransaction(tx)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 active:scale-95 transition-all"
                  title="Editar aporte"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Deseja remover este aporte de ${tx.ticker}?`)) {
                    onDeleteTransaction(tx.id);
                  }
                }}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all"
                title="Excluir aporte"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


