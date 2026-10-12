'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Transaction,
  FiiPosition,
  PortfolioGoals,
  QuoteData,
  BcbIndicators,
} from '../types/portfolio';
import { deduplicateB3Transactions, normalizeB3Ticker } from '../lib/b3Parser';
import {
  calculatePortfolioPositions,
  calculatePortfolioSummary,
} from '../domain/portfolioEngine';
import { FII_FUNDAMENTALS } from '../data/fiiFundamentals';
import { runAutoDailyPushCheck } from '../lib/pushNotifications';
import { syncPortfolioToWidgetServer } from '../lib/iphoneWidget';
import {
  checkSupabaseConnection,
  fetchRemoteTransactions,
  upsertRemoteTransaction,
  upsertRemoteTransactionsBatch,
  deleteRemoteTransaction,
  deleteRemoteTransactionsBatch,
  fetchRemoteGoals,
  upsertRemoteGoals,
  fetchRemoteDividends,
  upsertRemoteDividend,
  getSupabaseConfig,
} from '../lib/supabase';

const STORAGE_KEY_TRANSACTIONS = 'fii_tracker_transactions_v1';
const STORAGE_KEY_GOALS = 'fii_tracker_goals_v1';
const STORAGE_KEY_DIVIDENDS = 'fii_tracker_dividends_v1';

const DEFAULT_GOALS: PortfolioGoals = {
  monthlyTarget: 200,
  milestoneEquityTarget: 1000,
  monthlyIncomeTarget: 10,
};

export const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: 'demo-1',
    ticker: 'MXRF11',
    date: '2026-10-01',
    shares: 11,
    price: 9.42,
    total: 103.62,
    broker: 'XP Investimentos',
    notes: 'Primeiro aporte do mês',
  },
  {
    id: 'demo-2',
    ticker: 'VGIR11',
    date: '2026-10-01',
    shares: 10,
    price: 9.6,
    total: 96.0,
    broker: 'XP Investimentos',
    notes: 'Diversificação em Papel/CDI',
  },
];

export function usePortfolio() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<PortfolioGoals>(DEFAULT_GOALS);
  const [customDividends, setCustomDividends] = useState<Record<string, number>>({});
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [bcbIndicators, setBcbIndicators] = useState<BcbIndicators | null>(null);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [currentYearMonth, setCurrentYearMonth] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Estados de Nuvem (Supabase)
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sincronizar com o Supabase (Batch SQL)
  const syncWithCloud = useCallback(async () => {
    const config = getSupabaseConfig();
    if (!config.url || !config.key) {
      setIsCloudConnected(false);
      return;
    }

    setIsSyncing(true);
    try {
      const isConnected = await checkSupabaseConnection();
      setIsCloudConnected(isConnected);

      if (isConnected) {
        const [remoteGoals, remoteDivs, remoteTxs] = await Promise.all([
          fetchRemoteGoals(),
          fetchRemoteDividends(),
          fetchRemoteTransactions(),
        ]);

        if (remoteGoals) {
          setGoals(remoteGoals);
          localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(remoteGoals));
        }

        if (remoteDivs) {
          setCustomDividends(remoteDivs);
          localStorage.setItem(STORAGE_KEY_DIVIDENDS, JSON.stringify(remoteDivs));
        }

        if (remoteTxs && remoteTxs.length > 0) {
          setTransactions(remoteTxs);
          localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(remoteTxs));
        } else if (remoteTxs && remoteTxs.length === 0) {
          const localTxsStr = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
          if (localTxsStr) {
            const localTxs: Transaction[] = JSON.parse(localTxsStr);
            if (localTxs.length > 0) {
              await upsertRemoteTransactionsBatch(localTxs);
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro na sincronização com Supabase:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Carregar dados salvos no localStorage no início
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentYearMonth(new Date().toISOString().slice(0, 7));
      const savedTx = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      const savedGoals = localStorage.getItem(STORAGE_KEY_GOALS);
      const savedDivs = localStorage.getItem(STORAGE_KEY_DIVIDENDS);

      if (savedTx) {
        setTransactions(JSON.parse(savedTx));
      } else {
        setTransactions([]);
      }

      if (savedGoals) {
        setGoals(JSON.parse(savedGoals));
      }

      if (savedDivs) {
        setCustomDividends(JSON.parse(savedDivs));
      }
    } catch (e) {
      console.error('Falha ao carregar dados do LocalStorage:', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Sincronização em nuvem única após carregar dados locais
  useEffect(() => {
    if (isInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      syncWithCloud();
    }
  }, [isInitialized, syncWithCloud]);

  // Salvar transações localmente
  const persistTransactions = (newTxList: Transaction[]) => {
    setTransactions(newTxList);
    try {
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(newTxList));
    } catch (e) {
      console.error('Erro ao salvar transações:', e);
    }
  };

  // Salvar metas
  const updateGoals = async (newGoals: Partial<PortfolioGoals>) => {
    const updated: PortfolioGoals = {
      monthlyTarget:
        newGoals.monthlyTarget !== undefined
          ? Number(newGoals.monthlyTarget)
          : goals.monthlyTarget || 200,
      milestoneEquityTarget:
        newGoals.milestoneEquityTarget !== undefined
          ? Number(newGoals.milestoneEquityTarget)
          : goals.milestoneEquityTarget || 1000,
      monthlyIncomeTarget:
        newGoals.monthlyIncomeTarget !== undefined
          ? Number(newGoals.monthlyIncomeTarget)
          : goals.monthlyIncomeTarget || 10,
    };

    setGoals(updated);
    try {
      localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(updated));
    } catch (e) {
      console.error('Erro ao salvar metas:', e);
    }

    if (isCloudConnected) {
      try {
        await upsertRemoteGoals(updated);
      } catch (err) {
        console.error('Erro ao salvar metas no Supabase:', err);
      }
    }
  };

  // Salvar dividendo customizado por cota
  const updateCustomDividend = async (ticker: string, div: number) => {
    const cleanTicker = normalizeB3Ticker(ticker);
    const updated = { ...customDividends, [cleanTicker]: div };
    setCustomDividends(updated);
    try {
      localStorage.setItem(STORAGE_KEY_DIVIDENDS, JSON.stringify(updated));
    } catch (e) {
      console.error('Erro ao salvar dividendo:', e);
    }

    if (isCloudConnected) {
      await upsertRemoteDividend(cleanTicker, div);
    }
  };

  // Adicionar aporte ou venda
  const addTransaction = async (data: {
    ticker: string;
    type?: 'BUY' | 'SELL';
    date: string;
    shares: number;
    price: number;
    broker?: string;
    notes?: string;
  }) => {
    const absShares = Math.abs(Number(data.shares));
    const absPrice = Math.abs(Number(data.price));
    const total = Number((absShares * absPrice).toFixed(2));
    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ticker: normalizeB3Ticker(data.ticker),
      type: data.type === 'SELL' ? 'SELL' : 'BUY',
      date: data.date,
      shares: absShares,
      price: absPrice,
      total,
      broker: data.broker || 'XP Investimentos',
      notes: data.notes,
    };

    const updated = [newTx, ...transactions];
    persistTransactions(updated);

    if (isCloudConnected) {
      await upsertRemoteTransaction(newTx);
    }

    return newTx;
  };

  // Editar aporte/venda existente
  const updateTransaction = async (
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
  ) => {
    const absShares = Math.abs(Number(data.shares));
    const absPrice = Math.abs(Number(data.price));
    const total = Number((absShares * absPrice).toFixed(2));
    const updatedTx: Transaction = {
      id,
      ticker: normalizeB3Ticker(data.ticker),
      type: data.type === 'SELL' ? 'SELL' : 'BUY',
      date: data.date,
      shares: absShares,
      price: absPrice,
      total,
      broker: data.broker || 'XP Investimentos',
      notes: data.notes,
    };

    const updatedList = transactions.map((t) => (t.id === id ? updatedTx : t));
    persistTransactions(updatedList);

    if (isCloudConnected) {
      await upsertRemoteTransaction(updatedTx);
    }

    return updatedTx;
  };

  // Excluir aporte
  const deleteTransaction = async (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    persistTransactions(updated);

    if (isCloudConnected) {
      await deleteRemoteTransaction(id);
    }
  };

  // Limpar tudo em 1 único Batch Delete no Supabase
  const clearAllTransactions = async () => {
    const existingIds = transactions.map((t) => t.id);
    persistTransactions([]);
    if (isCloudConnected && existingIds.length > 0) {
      await deleteRemoteTransactionsBatch(existingIds);
    }
  };

  // Recarregar dados de exemplo em 1 único Batch Upsert
  const resetDemo = async () => {
    persistTransactions(DEMO_TRANSACTIONS);
    if (isCloudConnected) {
      await upsertRemoteTransactionsBatch(DEMO_TRANSACTIONS);
    }
  };

  // Importar transações vindas da planilha da B3 (Batch Upsert & Batch Delete no Supabase)
  const importTransactionsFromB3 = async (newTxs: Transaction[], replaceAll: boolean) => {
    let finalTransactions: Transaction[] = [];
    let txsToUpsert: Transaction[] = newTxs;

    const demoIds = transactions.filter((t) => t.id.startsWith('demo-')).map((t) => t.id);
    const realExistingTxs = transactions.filter((t) => !t.id.startsWith('demo-'));

    if (replaceAll) {
      const allExistingIds = transactions.map((t) => t.id);
      if (isCloudConnected && allExistingIds.length > 0) {
        await deleteRemoteTransactionsBatch(allExistingIds);
      }
      finalTransactions = newTxs;
    } else {
      if (isCloudConnected && demoIds.length > 0) {
        await deleteRemoteTransactionsBatch(demoIds);
      }
      const { uniqueTransactions } = deduplicateB3Transactions(newTxs, realExistingTxs);
      txsToUpsert = uniqueTransactions;
      finalTransactions = [...uniqueTransactions, ...realExistingTxs];
    }

    persistTransactions(finalTransactions);

    if (isCloudConnected && txsToUpsert.length > 0) {
      await upsertRemoteTransactionsBatch(txsToUpsert);
    }
  };

  // Buscar cotações em tempo real (carteira + radar de oportunidades)
  const fetchLiveQuotes = useCallback(async () => {
    const portfolioTickers = transactions
      .map((t) => normalizeB3Ticker(t.ticker))
      .filter(Boolean);
    const radarTickers = FII_FUNDAMENTALS.map((f) => f.ticker);

    const uniqueTickers = Array.from(new Set([...portfolioTickers, ...radarTickers]));
    if (uniqueTickers.length === 0) return;

    setIsLoadingQuotes(true);
    try {
      // Divide em lotes de até 25 tickers para resposta rápida e segura na API
      const chunks: string[][] = [];
      for (let i = 0; i < uniqueTickers.length; i += 25) {
        chunks.push(uniqueTickers.slice(i, i + 25));
      }

      const [quoteResponses, bcbRes] = await Promise.all([
        Promise.allSettled(
          chunks.map((chunk) =>
            fetch(`/api/quote?tickers=${encodeURIComponent(chunk.join(','))}`)
          )
        ),
        fetch('/api/bcb').catch(() => null),
      ]);

      const mergedQuotes: Record<string, QuoteData> = {};
      for (const res of quoteResponses) {
        if (res.status === 'fulfilled' && res.value.ok) {
          const data = await res.value.json();
          if (data.quotes) {
            Object.assign(mergedQuotes, data.quotes);
          }
        }
      }

      if (Object.keys(mergedQuotes).length > 0) {
        setQuotes((prev) => ({ ...prev, ...mergedQuotes }));
        setLastSyncTime(new Date());
      }

      if (bcbRes && bcbRes.ok) {
        const bcbData: BcbIndicators = await bcbRes.json();
        setBcbIndicators(bcbData);
      }
    } catch (err) {
      console.error('Erro ao buscar cotações ao vivo:', err);
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [transactions]);

  // Atualizar cotações automaticamente ao iniciar e quando as transações mudarem
  useEffect(() => {
    if (isInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchLiveQuotes();
    }
  }, [isInitialized, transactions.length, fetchLiveQuotes]);

  // Motor de Domínio Puro: Agrupar posições e calcular resumo
  const positions: FiiPosition[] = useMemo(
    () => calculatePortfolioPositions(transactions, quotes, customDividends, currentYearMonth),
    [transactions, quotes, customDividends, currentYearMonth]
  );

  const summary = useMemo(
    () => calculatePortfolioSummary(positions, transactions, goals, currentYearMonth),
    [positions, transactions, goals, currentYearMonth]
  );

  // Exportar Backup JSON
  const exportBackup = () => {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      transactions,
      goals,
      customDividends,
    };
    return JSON.stringify(data, null, 2);
  };

  // Importar Backup JSON (com Batch Upsert no Supabase)
  const importBackup = async (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.transactions)) {
        persistTransactions(parsed.transactions);
        if (isCloudConnected && parsed.transactions.length > 0) {
          await upsertRemoteTransactionsBatch(parsed.transactions);
        }
      }
      if (parsed.goals) {
        updateGoals(parsed.goals);
      }
      if (parsed.customDividends) {
        setCustomDividends(parsed.customDividends);
        localStorage.setItem(STORAGE_KEY_DIVIDENDS, JSON.stringify(parsed.customDividends));
      }
      return true;
    } catch (e) {
      console.error('Falha ao importar backup:', e);
      return false;
    }
  };

  // Verifica alertas automáticos de Web Push e sincroniza carteira com o Widget do iPhone
  useEffect(() => {
    if (isInitialized) {
      syncPortfolioToWidgetServer(positions, goals);
    }
    if (isInitialized && lastSyncTime) {
      runAutoDailyPushCheck(positions, quotes);
    }
  }, [isInitialized, positions, goals, quotes, lastSyncTime]);

  return {
    isInitialized,
    transactions,
    positions,
    summary,
    goals,
    quotes,
    bcbIndicators,
    isLoadingQuotes,
    lastSyncTime,
    isCloudConnected,
    isSyncing,
    syncWithCloud,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    clearAllTransactions,
    resetDemo,
    updateGoals,
    updateCustomDividend,
    fetchLiveQuotes,
    exportBackup,
    importBackup,
    importTransactionsFromB3,
  };
}
