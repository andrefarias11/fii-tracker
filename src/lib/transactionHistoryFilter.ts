import type { Transaction } from '../types/portfolio';

export function getTransactionHistoryFilter(
  transactions: Transaction[],
  selectedTicker: string
): { effectiveTicker: string; filteredTransactions: Transaction[] } {
  const effectiveTicker =
    selectedTicker === 'TODOS' || transactions.some((tx) => tx.ticker === selectedTicker)
      ? selectedTicker
      : 'TODOS';

  return {
    effectiveTicker,
    filteredTransactions:
      effectiveTicker === 'TODOS'
        ? transactions
        : transactions.filter((tx) => tx.ticker === effectiveTicker),
  };
}
