'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Transaction,
  FiiPosition,
  PortfolioGoals,
  QuoteData,
  BcbIndicators,
  FixedIncomeAsset,
  UnifiedPortfolioSummary,
} from '../types/portfolio';
import { deduplicateB3Transactions, normalizeB3Ticker } from '../lib/b3Parser';
import {
  calculatePortfolioPositions,
  calculatePortfolioSummary,
  calculateUnifiedPortfolioSummary,
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
  fetchRemoteFixedIncome,
  upsertRemoteFixedIncome,
  deleteRemoteFixedIncome,
  getSupabaseConfig,
} from '../lib/supabase';

const STORAGE_KEY_TRANSACTIONS = 'fii_tracker_transactions_v1';
const STORAGE_KEY_GOALS = 'fii_tracker_goals_v1';
const STORAGE_KEY_DIVIDENDS = 'fii_tracker_dividends_v1';
const STORAGE_KEY_FIXED_INCOME = 'fii_tracker_fixed_income_v1';

const DEFAULT_GOALS: PortfolioGoals = {
  monthlyTarget: 200,
  milestoneEquityTarget: 1000,
  monthlyIncomeTarget: 10,
};

export const DEMO_FIXED_INCOME: FixedIncomeAsset[] = [
  {
    id: 'demo-fi-1',
    name: 'Caixinha Reserva Nubank',
    type: 'CAIXINHA',
    institution: 'Nubank',
    investedAmount: 500,
    currentBalance: 518.4,
    rateType: 'CDI',
    ratePercent: 100,
    isExempt: false,
    updatedAt: '2026-10-01',
    notes: 'Reserva com liquidez imediata (100% CDI)',
  },
];

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
  const [fixedIncomeAssets, setFixedIncomeAssets] = useState<FixedIncomeAsset[]>([]);
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

  // Sincronizar com o Supabase (Bidirecional / Two-Way Smart Merge)
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
        const [remoteGoals, remoteDivs, remoteTxs, remoteFixedIncome] = await Promise.all([
          fetchRemoteGoals(),
          fetchRemoteDividends(),
          fetchRemoteTransactions(),
          fetchRemoteFixedIncome(),
        ]);

        // 1. Metas
        if (remoteGoals) {
          setGoals(remoteGoals);
          localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(remoteGoals));
        }

        // 2. Dividendos customizados
        if (remoteDivs) {
          setCustomDividends(remoteDivs);
          localStorage.setItem(STORAGE_KEY_DIVIDENDS, JSON.stringify(remoteDivs));
        }

        // 3. Transações (Smart Merge Bidirecional)
        if (remoteTxs !== null) {
          let currentLocalTxs: Transaction[] = [];
          try {
            const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
            if (raw) currentLocalTxs = JSON.parse(raw);
          } catch {
            currentLocalTxs = [];
          }

          const remoteIds = new Set(remoteTxs.map((t) => t.id));
          const missingInRemote: Transaction[] = [];

          for (const localTx of currentLocalTxs) {
            // Ignora transações de demo se houver transações reais
            if (localTx.id.startsWith('demo-')) continue;

            if (!remoteIds.has(localTx.id)) {
              // Verifica se não há registro equivalente com mesmo ticker, data, shares e total
              const existsEquiv = remoteTxs.some(
                (r) =>
                  r.ticker === localTx.ticker &&
                  r.date === localTx.date &&
                  Math.abs(r.shares) === Math.abs(localTx.shares) &&
                  Math.abs(r.total) === Math.abs(localTx.total)
              );
              if (!existsEquiv) {
                missingInRemote.push(localTx);
              }
            }
          }

          // Se este dispositivo tem transações locais que ainda não estão no Supabase, envie-as!
          if (missingInRemote.length > 0) {
            await upsertRemoteTransactionsBatch(missingInRemote);
          }

          // A lista consolidada final é a união de remotas + locais enviadas
          const finalTxs = [...remoteTxs, ...missingInRemote].sort(
            (a, b) => b.date.localeCompare(a.date)
          );

          setTransactions(finalTxs);
          localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(finalTxs));
        }

        // 4. Renda Fixa & Caixinhas (Smart Merge Bidirecional)
        if (remoteFixedIncome !== null) {
          let currentLocalFi: FixedIncomeAsset[] = [];
          try {
            const raw = localStorage.getItem(STORAGE_KEY_FIXED_INCOME);
            if (raw) currentLocalFi = JSON.parse(raw);
          } catch {
            currentLocalFi = [];
          }

          const remoteFiIds = new Set(remoteFixedIncome.map((f) => f.id));
          const missingInRemoteFi: FixedIncomeAsset[] = [];

          for (const localAsset of currentLocalFi) {
            if (localAsset.id.startsWith('demo-fi-')) continue;

            if (!remoteFiIds.has(localAsset.id)) {
              const existsEquiv = remoteFixedIncome.some(
                (r) =>
                  r.name.trim().toLowerCase() === localAsset.name.trim().toLowerCase() &&
                  r.institution.trim().toLowerCase() === localAsset.institution.trim().toLowerCase()
              );
              if (!existsEquiv) {
                missingInRemoteFi.push(localAsset);
              }
            }
          }

          if (missingInRemoteFi.length > 0) {
            for (const asset of missingInRemoteFi) {
              await upsertRemoteFixedIncome(asset);
            }
          }

          const finalFi = [...remoteFixedIncome, ...missingInRemoteFi];
          setFixedIncomeAssets(finalFi);
          localStorage.setItem(STORAGE_KEY_FIXED_INCOME, JSON.stringify(finalFi));
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
      const savedFixedIncome = localStorage.getItem(STORAGE_KEY_FIXED_INCOME);

      if (savedTx) {
        setTransactions(JSON.parse(savedTx));
      } else {
        setTransactions([]);
      }

      if (savedFixedIncome) {
        setFixedIncomeAssets(JSON.parse(savedFixedIncome));
      } else {
        setFixedIncomeAssets([]);
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

    upsertRemoteTransaction(newTx).catch((err) => {
      console.warn('Tentativa de sincronização imediata falhou, sincronizará no próximo ciclo:', err);
    });

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

    upsertRemoteTransaction(updatedTx).catch((err) => {
      console.warn('Falha ao atualizar no Supabase:', err);
    });

    return updatedTx;
  };

  // Excluir aporte
  const deleteTransaction = async (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    persistTransactions(updated);

    deleteRemoteTransaction(id).catch((err) => {
      console.warn('Falha ao deletar no Supabase:', err);
    });
  };

  // Limpar tudo em 1 único Batch Delete no Supabase
  const clearAllTransactions = async () => {
    const existingIds = transactions.map((t) => t.id);
    persistTransactions([]);
    if (existingIds.length > 0) {
      deleteRemoteTransactionsBatch(existingIds).catch(() => {});
    }
  };

  // Recarregar dados de exemplo em 1 único Batch Upsert
  const resetDemo = async () => {
    persistTransactions(DEMO_TRANSACTIONS);
    upsertRemoteTransactionsBatch(DEMO_TRANSACTIONS).catch(() => {});
  };

  // Importar transações vindas da planilha da B3 (Batch Upsert & Batch Delete no Supabase)
  const importTransactionsFromB3 = async (newTxs: Transaction[], replaceAll: boolean) => {
    let finalTransactions: Transaction[] = [];
    let txsToUpsert: Transaction[] = newTxs;

    const demoIds = transactions.filter((t) => t.id.startsWith('demo-')).map((t) => t.id);
    const realExistingTxs = transactions.filter((t) => !t.id.startsWith('demo-'));

    if (replaceAll) {
      const allExistingIds = transactions.map((t) => t.id);
      if (allExistingIds.length > 0) {
        deleteRemoteTransactionsBatch(allExistingIds).catch(() => {});
      }
      finalTransactions = newTxs;
    } else {
      if (demoIds.length > 0) {
        deleteRemoteTransactionsBatch(demoIds).catch(() => {});
      }
      const { uniqueTransactions } = deduplicateB3Transactions(newTxs, realExistingTxs);
      txsToUpsert = uniqueTransactions;
      finalTransactions = [...uniqueTransactions, ...realExistingTxs];
    }

    persistTransactions(finalTransactions);

    if (txsToUpsert.length > 0) {
      await upsertRemoteTransactionsBatch(txsToUpsert);
      setIsCloudConnected(true);
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

  // Salvar renda fixa localmente
  const persistFixedIncome = (newList: FixedIncomeAsset[]) => {
    setFixedIncomeAssets(newList);
    try {
      localStorage.setItem(STORAGE_KEY_FIXED_INCOME, JSON.stringify(newList));
    } catch (e) {
      console.error('Erro ao salvar renda fixa:', e);
    }
  };

  const addFixedIncomeAsset = async (data: Omit<FixedIncomeAsset, 'id' | 'updatedAt'>) => {
    const today = new Date().toISOString().slice(0, 10);
    const newAsset: FixedIncomeAsset = {
      ...data,
      id: `fi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      updatedAt: today,
    };
    const updated = [newAsset, ...fixedIncomeAssets];
    persistFixedIncome(updated);

    upsertRemoteFixedIncome(newAsset).catch((err) => {
      console.warn('Falha ao salvar renda fixa no Supabase:', err);
    });
    return newAsset;
  };

  const updateFixedIncomeAsset = async (id: string, data: Partial<FixedIncomeAsset>) => {
    const today = new Date().toISOString().slice(0, 10);
    const updatedList = fixedIncomeAssets.map((asset) => {
      if (asset.id === id) {
        return {
          ...asset,
          ...data,
          updatedAt: today,
        };
      }
      return asset;
    });
    persistFixedIncome(updatedList);

    const updatedAsset = updatedList.find((a) => a.id === id);
    if (updatedAsset) {
      upsertRemoteFixedIncome(updatedAsset).catch((err) => {
        console.warn('Falha ao atualizar renda fixa no Supabase:', err);
      });
    }
    return updatedAsset;
  };

  const deleteFixedIncomeAsset = async (id: string) => {
    const updated = fixedIncomeAssets.filter((a) => a.id !== id);
    persistFixedIncome(updated);

    deleteRemoteFixedIncome(id).catch((err) => {
      console.warn('Falha ao deletar renda fixa no Supabase:', err);
    });
  };

  const resetFixedIncomeDemo = async () => {
    persistFixedIncome(DEMO_FIXED_INCOME);
    if (DEMO_FIXED_INCOME[0]) {
      upsertRemoteFixedIncome(DEMO_FIXED_INCOME[0]).catch(() => {});
    }
  };

  // Motor de Domínio Puro: Agrupar posições e calcular resumo
  const positions: FiiPosition[] = useMemo(
    () => calculatePortfolioPositions(transactions, quotes, customDividends, currentYearMonth),
    [transactions, quotes, customDividends, currentYearMonth]
  );

  const summary = useMemo(
    () => calculatePortfolioSummary(positions, transactions, goals, currentYearMonth),
    [positions, transactions, goals, currentYearMonth]
  );

  const unifiedSummary: UnifiedPortfolioSummary = useMemo(
    () => calculateUnifiedPortfolioSummary(positions, fixedIncomeAssets, bcbIndicators),
    [positions, fixedIncomeAssets, bcbIndicators]
  );

  // Exportar Backup JSON
  const exportBackup = () => {
    const data = {
      version: '2.5',
      exportedAt: new Date().toISOString(),
      transactions,
      goals,
      customDividends,
      fixedIncomeAssets,
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
      if (Array.isArray(parsed.fixedIncomeAssets)) {
        persistFixedIncome(parsed.fixedIncomeAssets);
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
    fixedIncomeAssets,
    unifiedSummary,
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
    addFixedIncomeAsset,
    updateFixedIncomeAsset,
    deleteFixedIncomeAsset,
    resetFixedIncomeDemo,
    updateGoals,
    updateCustomDividend,
    fetchLiveQuotes,
    exportBackup,
    importBackup,
    importTransactionsFromB3,
  };
}
