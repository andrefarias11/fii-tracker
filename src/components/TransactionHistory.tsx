'use client';

import { useState, useMemo } from 'react';
import { Transaction } from '../types/portfolio';
import { Trash2, Edit2, Calendar, Building2, X, CheckCircle2, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface TransactionHistoryProps {
  transactions: Transaction[];
  monthlyTarget?: number;
  isPrivacyMode?: boolean;
  onEditTransaction?: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function TransactionHistory({
  transactions,
  monthlyTarget = 400,
  isPrivacyMode = false,
  onEditTransaction,
  onDeleteTransaction,
}: TransactionHistoryProps) {
  const [selectedTicker, setSelectedTicker] = useState<string>('TODOS');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const uniqueTickers = useMemo(() => {
    return Array.from(new Set(transactions.map((t) => t.ticker))).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedTicker === 'TODOS') return transactions;
    return transactions.filter((t) => t.ticker === selectedTicker);
  }, [transactions, selectedTicker]);

  // Agrupamento por mês (YYYY-MM)
  const groupedByMonth = useMemo(() => {
    const groups = new Map<
      string,
      {
        yearMonth: string;
        label: string;
        totalBought: number;
        totalSold: number;
        items: Transaction[];
      }
    >();

    filteredTransactions.forEach((tx) => {
      const ym = tx.date ? tx.date.slice(0, 7) : 'Sem data';
      let label = ym;
      if (/^\d{4}-\d{2}$/.test(ym)) {
        const [y, m] = ym.split('-');
        const monthIdx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
        label = `${MONTH_NAMES[monthIdx]} de ${y}`;
      }

      const existing = groups.get(ym) || {
        yearMonth: ym,
        label,
        totalBought: 0,
        totalSold: 0,
        items: [],
      };

      if (tx.type === 'SELL') {
        existing.totalSold += tx.total;
      } else {
        existing.totalBought += tx.total;
      }
      existing.items.push(tx);
      groups.set(ym, existing);
    });

    return Array.from(groups.values()).sort((a, b) =>
      b.yearMonth.localeCompare(a.yearMonth)
    );
  }, [filteredTransactions]);

  const formatBRL = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••';
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
        <p className="text-sm text-zinc-400">Nenhuma movimentação registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Grupos mensais com subtotal */}
      <div className="space-y-4">
        {groupedByMonth.map((group) => {
          const hitMonthlyGoal =
            selectedTicker === 'TODOS' &&
            monthlyTarget > 0 &&
            group.totalBought >= monthlyTarget;

          return (
            <div key={group.yearMonth} className="space-y-2">
              {/* Cabeçalho do Mês com Subtotal */}
              <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-200">{group.label}</span>
                  {hitMonthlyGoal && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Meta batida
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  {group.totalBought > 0 && (
                    <span className="font-semibold text-emerald-400">
                      +{formatBRL(group.totalBought)}
                    </span>
                  )}
                  {group.totalSold > 0 && (
                    <span className="font-semibold text-rose-400">
                      -{formatBRL(group.totalSold)}
                    </span>
                  )}
                </div>
              </div>

              {/* Transações do mês */}
              <div className="space-y-2">
                {group.items.map((tx) => {
                  const isConfirming = confirmingDeleteId === tx.id;
                  const isSell = tx.type === 'SELL';

                  return (
                    <div
                      key={tx.id}
                      className="rounded-2xl bg-zinc-900 border border-zinc-800/80 p-3.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-sm font-bold text-white">{tx.ticker}</span>
                          <span
                            className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isSell
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {isSell ? (
                              <ArrowUpRight className="w-2.5 h-2.5" />
                            ) : (
                              <ArrowDownRight className="w-2.5 h-2.5" />
                            )}
                            {isSell ? 'Venda' : 'Compra'} • {tx.shares}{' '}
                            {tx.shares === 1 ? 'cota' : 'cotas'}
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
                          {tx.notes && (
                            <span className="text-zinc-500 truncate max-w-[110px]">
                              • {tx.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isConfirming && (
                          <span
                            className={`text-sm font-bold mr-1 ${
                              isSell ? 'text-rose-400' : 'text-white'
                            }`}
                          >
                            {isSell ? '-' : ''}
                            {formatBRL(tx.total)}
                          </span>
                        )}

                        {isConfirming ? (
                          <div className="flex items-center gap-1 animate-in fade-in duration-150">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteTransaction(tx.id);
                                setConfirmingDeleteId(null);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600 active:scale-95 transition-all"
                            >
                              Excluir?
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            {onEditTransaction && (
                              <button
                                type="button"
                                onClick={() => onEditTransaction(tx)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 active:scale-95 transition-all"
                                title="Editar operação"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(tx.id)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all"
                              title="Excluir operação"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


