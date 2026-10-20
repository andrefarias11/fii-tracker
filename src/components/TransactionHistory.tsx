'use client';

import { useState, useMemo } from 'react';
import { Transaction } from '../types/portfolio';
import { getTransactionHistoryFilter } from '../lib/transactionHistoryFilter';
import { Chip } from './ui/Controls';
import {
  Trash2,
  Edit2,
  Calendar,
  Building2,
  X,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
} from 'lucide-react';

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

  const { effectiveTicker, filteredTransactions } = useMemo(() => {
    return getTransactionHistoryFilter(transactions, selectedTicker);
  }, [transactions, selectedTicker]);

  if (selectedTicker !== effectiveTicker) setSelectedTicker(effectiveTicker);

  // Agrupamento por mês (YYYY-MM)
  const groupedByMonth = useMemo(() => {
    const groups = new Map<
      string,
      {
        yearMonth: string;
        label: string;
        totalBought: number;
        totalSold: number;
        totalDividends: number;
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
        totalDividends: 0,
        items: [],
      };

      if (tx.type === 'DIVIDEND') {
        existing.totalDividends += tx.total;
      } else if (tx.type === 'SELL') {
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
      <div className="rounded-[20px] bg-[#121215] border border-white/[0.06] p-8 text-center">
        <p className="text-sm text-zinc-400">Nenhuma movimentação registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtro rápido por Ativo em Pílulas Estilo XP */}
      {uniqueTickers.length > 1 && (
        <div role="group" aria-label="Filtrar extrato por ativo" className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <Chip
            onClick={() => setSelectedTicker('TODOS')}
            selected={effectiveTicker === 'TODOS'}
          >
            Todos ({transactions.length})
          </Chip>
          {uniqueTickers.map((t) => (
            <Chip
              key={t}
              onClick={() => setSelectedTicker(t)}
              selected={effectiveTicker === t}
            >
              {t}
            </Chip>
          ))}
        </div>
      )}

      {/* Grupos mensais com subtotal */}
      <div className="space-y-5">
        {groupedByMonth.map((group) => {
          const hitMonthlyGoal =
            effectiveTicker === 'TODOS' &&
            monthlyTarget > 0 &&
            group.totalBought >= monthlyTarget;

          return (
            <div key={group.yearMonth} className="space-y-2.5">
              {/* Cabeçalho do Mês Solto Estilo XP */}
              <div className="flex min-w-0 flex-col items-start gap-2 px-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">{group.label}</span>
                  {hitMonthlyGoal && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#2b2512] px-2 py-0.5 text-[10px] font-bold text-[#f5b800]">
                      <CheckCircle2 className="w-3 h-3" />
                      Meta batida
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs tabular-nums sm:justify-end">
                  {group.totalDividends > 0 && (
                    <span className="min-w-0 break-words font-semibold text-emerald-400">
                      ▲ {formatBRL(group.totalDividends)}
                    </span>
                  )}
                  {group.totalBought > 0 && (
                    <span className="min-w-0 break-words font-semibold text-zinc-300">
                      Aportes: {formatBRL(group.totalBought)}
                    </span>
                  )}
                  {group.totalSold > 0 && (
                    <span className="min-w-0 break-words font-semibold text-rose-400">
                      ▼ {formatBRL(group.totalSold)}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Agrupado de Transações do Mês Estilo XP */}
              <div className="rounded-[20px] bg-[#121215] border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden">
                {group.items.map((tx) => {
                  const isConfirming = confirmingDeleteId === tx.id;
                  const isSell = tx.type === 'SELL';
                  const isDividend = tx.type === 'DIVIDEND';

                  return (
                    <div
                      key={tx.id}
                      className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-bold text-white">{tx.ticker}</span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              isDividend
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : isSell
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-[#2b2512] text-[#f5b800]'
                            }`}
                          >
                            {isDividend ? (
                              <Coins className="w-3 h-3" />
                            ) : isSell ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {isDividend
                              ? 'Provento B3'
                              : `${isSell ? 'Venda' : 'Compra'} • ${tx.shares} ${
                                  tx.shares === 1 ? 'cota' : 'cotas'
                                }`}
                          </span>
                          {!isDividend && (
                            <span className="text-xs text-zinc-400 tabular-nums">
                              a {formatBRL(tx.price)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 text-[11px] text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-500" />
                            <span className="tabular-nums">{formatDate(tx.date)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-zinc-500" />
                            {tx.broker}
                          </span>
                          {tx.notes && (
                            <span className="text-zinc-500 truncate max-w-[140px]">
                              • {tx.notes.replace(/^\[PROVENTO B3\]\s*/i, '')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:shrink-0">
                        {!isConfirming && (
                          <span
                            className={`mr-auto text-sm font-bold tabular-nums sm:mr-1 ${
                              isDividend
                                ? 'text-emerald-400'
                                : isSell
                                ? 'text-rose-400'
                                : 'text-white'
                            }`}
                          >
                            {isDividend ? '▲ ' : isSell ? '▼ ' : ''}
                            {formatBRL(tx.total)}
                          </span>
                        )}

                        {isConfirming ? (
                          <div className="flex flex-wrap items-center justify-end gap-1 animate-in fade-in duration-150">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteTransaction(tx.id);
                                setConfirmingDeleteId(null);
                              }}
                              className="inline-flex min-h-11 items-center justify-center rounded-full bg-rose-500 px-4 text-xs font-bold text-white hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 active:scale-95 transition-all"
                              aria-label={`Confirmar exclusão da operação de ${tx.ticker} em ${formatDate(tx.date)}`}
                            >
                              Confirmar exclusão
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                              aria-label={`Cancelar exclusão da operação de ${tx.ticker} em ${formatDate(tx.date)}`}
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
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-400 hover:text-[#f5b800] hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5b800] active:scale-95 transition-all"
                                aria-label={`Editar operação de ${tx.ticker} em ${formatDate(tx.date)}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(tx.id)}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-400 hover:text-rose-400 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 active:scale-95 transition-all"
                              aria-label={`Excluir operação de ${tx.ticker} em ${formatDate(tx.date)}`}
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
