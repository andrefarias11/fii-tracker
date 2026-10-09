'use client';

import { Transaction } from '../types/portfolio';
import { Trash2, Calendar, Building2 } from 'lucide-react';

interface TransactionHistoryProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
}

export function TransactionHistory({
  transactions,
  onDeleteTransaction,
}: TransactionHistoryProps) {
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
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          Histórico de Aportes
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
            {transactions.length}
          </span>
        </h3>
      </div>

      <div className="space-y-2.5">
        {transactions.map((tx) => (
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
                {tx.notes && <span className="text-zinc-500 truncate max-w-[120px]">• {tx.notes}</span>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white">{formatBRL(tx.total)}</span>
              <button
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

