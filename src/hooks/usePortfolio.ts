'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Transaction,
  FiiPosition,
  PortfolioGoals,
  QuoteData,
  BcbIndicators,
  FixedIncomeAsset,
  UnifiedPortfolioSummary,
} from '../types/portfolio';
import { normalizeB3Ticker } from '../lib/ticker';
import {
  calculatePortfolioPositions,
  calculatePortfolioSummary,
  calculateUnifiedPortfolioSummary,
} from '../domain/portfolioEngine';
import { FII_FUNDAMENTALS } from '../data/fiiFundamentals';
import { fetchServerPushState } from '../lib/pushNotifications';
import {
  checkSupabaseConnection,
  fetchRemoteTransactions,
  syncTransactionToCloud,
  syncTransactionsBatchToCloud,
  deleteRemoteTransaction,
  deleteRemoteTransactionsBatch,
  fetchRemoteGoals,
  syncGoalsToCloud,
  fetchRemoteDividends,
  syncDividendToCloud,
  fetchRemoteFixedIncome,
  syncFixedIncomeToCloud,
  deleteRemoteFixedIncome,
  getSupabaseConfig,
  deleteRemoteCustomDividends,
  fetchDeletedIds,
  getSupabaseClient,
} from '../lib/supabase';
import { parsePortfolioBackup, validateTransaction } from '../lib/backupValidation';
import { CorruptSyncQueueError, flushQueue, inspectQueue, readRawQueue, SYNC_EVENT } from '../lib/syncQueue';
import { getActiveAccount, subscribeAuthAccounts } from '../lib/authManager';

import { BASE_KEY_TRANSACTIONS, BASE_KEY_GOALS, BASE_KEY_DIVIDENDS, BASE_KEY_FIXED_INCOME, DEFAULT_GOALS, DEMO_TRANSACTIONS, DEMO_FIXED_INCOME, getScopedStorageKey, loadScopedData } from '../lib/portfolioStorage';
export { getScopedStorageKey, DEMO_TRANSACTIONS, DEMO_FIXED_INCOME } from '../lib/portfolioStorage';

export function usePortfolio(explicitUserId?: string | null) {
  const [subscribedUserId, setActiveUserId] = useState<string | null>(() => {
    if (explicitUserId !== undefined) return explicitUserId;
    if (typeof window !== 'undefined') {
      return getActiveAccount()?.id || null;
    }
    return null;
  });

  const activeUserId = explicitUserId !== undefined ? explicitUserId : subscribedUserId;
  const currentSyncUserId = useRef<string | null>(activeUserId);

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
  const [pendingChanges, setPendingChanges] = useState(0);
  const [corruptQueueCount, setCorruptQueueCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncRunning = useRef(false);
  useEffect(() => {
    const update = () => {
      const queue = activeUserId ? inspectQueue(activeUserId) : { items: [], corrupt: [] };
      setPendingChanges(queue.items.length);
      setCorruptQueueCount(queue.corrupt.length);
    };
    update();
    window.addEventListener(SYNC_EVENT, update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener(SYNC_EVENT, update); window.removeEventListener('storage', update); };
  }, [activeUserId]);

  // Listener ativo para trocas de conta no cofre de sessões
  useEffect(() => {
    const unsubscribe = subscribeAuthAccounts((_, active) => {
      const nextId = active?.id || null;
      setActiveUserId((prev) => (prev !== nextId ? nextId : prev));
    });
    return () => unsubscribe();
  }, []);

  // Sincronizar com o Supabase (Bidirecional / Two-Way Smart Merge Protegido)
  const syncWithCloud = useCallback(async (forcedUserId?: string | null) => {
    const syncUser = forcedUserId !== undefined ? forcedUserId : currentSyncUserId.current;

    if (!syncUser || syncRunning.current) return;
    const config = getSupabaseConfig();
    if (!config.url || !config.key) {
      setIsCloudConnected(false);
      return;
    }

    syncRunning.current = true;
    setIsSyncing(true);
    setSyncError(null);
    try {
      if (inspectQueue(syncUser).corrupt.length) throw new CorruptSyncQueueError();
      const isConnected = await checkSupabaseConnection();
      setIsCloudConnected(isConnected);

      // Trava 1: Se o usuário ativo mudou durante a checagem de conexão, interrompe
      if (currentSyncUserId.current !== syncUser) {
        return;
      }

      if (!isConnected) throw new Error('Sem conexão autenticada com a nuvem. Alterações locais preservadas.');
      if (isConnected) {
        const client = getSupabaseClient();
        if (!client || !await flushQueue(client, syncUser)) {
          if (inspectQueue(syncUser).corrupt.length) throw new CorruptSyncQueueError();
          throw new Error('Há alterações pendentes de envio.');
        }
        const syncKeys = [BASE_KEY_TRANSACTIONS, BASE_KEY_FIXED_INCOME, BASE_KEY_GOALS, BASE_KEY_DIVIDENDS];
        const snapshot = new Map(syncKeys.map(key => [key, localStorage.getItem(getScopedStorageKey(key, syncUser))]));
        const changed = (key: string) => snapshot.get(key) !== localStorage.getItem(getScopedStorageKey(key, syncUser));
        const [deletedTx, deletedFi] = await Promise.all([fetchDeletedIds(syncUser, 'transactions'), fetchDeletedIds(syncUser, 'fixed_income_assets')]);
        const [remoteGoals, remoteDivs, remoteTxs, remoteFixedIncome] = await Promise.all([
          fetchRemoteGoals(syncUser),
          fetchRemoteDividends(syncUser),
          fetchRemoteTransactions(syncUser),
          fetchRemoteFixedIncome(syncUser),
        ]);

        // Trava 2: Se o usuário ativo mudou durante a busca remota, aborta
        if (currentSyncUserId.current !== syncUser) {
          return;
        }

        if (inspectQueue(syncUser).corrupt.length) throw new CorruptSyncQueueError();

        // A response fetched before a local edit must never overwrite that edit.
        if (syncKeys.some(changed)) return;

        // 1. Metas
        if (remoteGoals) {
          setGoals(remoteGoals);
          try {
            localStorage.setItem(
              getScopedStorageKey(BASE_KEY_GOALS, syncUser),
              JSON.stringify(remoteGoals)
            );
          } catch {}
        }

        // 2. Dividendos customizados
        if (remoteDivs) {
          setCustomDividends(remoteDivs);
          try {
            localStorage.setItem(
              getScopedStorageKey(BASE_KEY_DIVIDENDS, syncUser),
              JSON.stringify(remoteDivs)
            );
          } catch {}
        }

        // 3. Transações (Smart Merge Bidirecional)
        if (remoteTxs !== null) {
          let currentLocalTxs: Transaction[] = [];
          try {
            const raw = localStorage.getItem(getScopedStorageKey(BASE_KEY_TRANSACTIONS, syncUser));
            if (raw) currentLocalTxs = JSON.parse(raw);
          } catch {
            currentLocalTxs = [];
          }

          if (currentSyncUserId.current !== syncUser) return;

          const remoteIds = new Set(remoteTxs.map((t) => t.id));
          const missingInRemote: Transaction[] = [];

          for (const localTx of currentLocalTxs) {
            if (localTx.id.startsWith('demo-') || deletedTx.has(localTx.id)) continue;

            if (!remoteIds.has(localTx.id)) {
              const existsEquiv = remoteTxs.some(
                (r) =>
                  r.ticker === localTx.ticker && (r.type || 'BUY') === (localTx.type || 'BUY') &&
                  r.date === localTx.date &&
                  Math.abs(r.shares) === Math.abs(localTx.shares) &&
                  Math.abs(r.total) === Math.abs(localTx.total)
              );
              if (!existsEquiv) {
                missingInRemote.push(localTx);
              }
            }
          }

          // Trava 3: Só sobe registros locais se o usuário ativo ainda for o mesmo!
          if (missingInRemote.length > 0 && currentSyncUserId.current === syncUser) {
            await syncTransactionsBatchToCloud(missingInRemote, syncUser);
          }

          if (currentSyncUserId.current !== syncUser) return;

          if (changed(BASE_KEY_TRANSACTIONS)) return;
          const finalTxs = [...remoteTxs, ...missingInRemote].sort(
            (a, b) => b.date.localeCompare(a.date)
          );

          setTransactions(finalTxs);
          try {
            localStorage.setItem(
              getScopedStorageKey(BASE_KEY_TRANSACTIONS, syncUser),
              JSON.stringify(finalTxs)
            );
          } catch {}
        }

        // 4. Renda Fixa & Caixinhas (Smart Merge Bidirecional)
        if (remoteFixedIncome !== null) {
          let currentLocalFi: FixedIncomeAsset[] = [];
          try {
            const raw = localStorage.getItem(getScopedStorageKey(BASE_KEY_FIXED_INCOME, syncUser));
            if (raw) currentLocalFi = JSON.parse(raw);
          } catch {
            currentLocalFi = [];
          }

          if (currentSyncUserId.current !== syncUser) return;

          const remoteFiIds = new Set(remoteFixedIncome.map((f) => f.id));
          const missingInRemoteFi: FixedIncomeAsset[] = [];

          for (const localAsset of currentLocalFi) {
            if (localAsset.id.startsWith('demo-fi-') || deletedFi.has(localAsset.id)) continue;

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

          if (missingInRemoteFi.length > 0 && currentSyncUserId.current === syncUser) {
            for (const asset of missingInRemoteFi) {
              await syncFixedIncomeToCloud(asset, syncUser);
            }
          }

          if (currentSyncUserId.current !== syncUser) return;

          if (changed(BASE_KEY_FIXED_INCOME)) return;
          const finalFi = [...remoteFixedIncome, ...missingInRemoteFi];
          setFixedIncomeAssets(finalFi);
          try {
            localStorage.setItem(
              getScopedStorageKey(BASE_KEY_FIXED_INCOME, syncUser),
              JSON.stringify(finalFi)
            );
          } catch {}
        }
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Falha na sincronização. Dados locais preservados.');
      if (currentSyncUserId.current === syncUser) {
        setCorruptQueueCount(inspectQueue(syncUser).corrupt.length);
      }
      setIsCloudConnected(false);
    } finally {
      syncRunning.current = false;
      if (currentSyncUserId.current === syncUser) {
        setIsSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    const retry = () => { void syncWithCloud(); };
    window.addEventListener('online', retry);
    const interval = window.setInterval(retry, 30000);
    return () => { window.removeEventListener('online', retry); window.clearInterval(interval); };
  }, [syncWithCloud]);

  // Ao alterar o activeUserId (troca de conta ou montagem inicial):
  // 1. Limpa IMEDIATAMENTE estados em memória
  // 2. Carrega EXCLUSIVAMENTE o storage com escopo do novo usuário
  // 3. Dispara syncWithCloud para o novo usuário
  useEffect(() => {
    currentSyncUserId.current = activeUserId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentYearMonth(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7));

    // Limpeza IMEDIATA do estado em memória
    setTransactions([]);
    setFixedIncomeAssets([]);
    setCustomDividends({});
    setGoals(DEFAULT_GOALS);

    // Carrega dados locais específicos deste usuário
    const data = loadScopedData(activeUserId);
    setTransactions(data.transactions);
    setFixedIncomeAssets(data.fixedIncomeAssets);
    setGoals(data.goals);
    setCustomDividends(data.customDividends);

    setIsInitialized(true);

    // Sincroniza nuvem para o usuário ativo
    syncWithCloud(activeUserId);
  }, [activeUserId, syncWithCloud]);

  // Salvar transações localmente
  const persistTransactions = (newTxList: Transaction[]) => {
    setTransactions(newTxList);
    try {
      localStorage.setItem(
        getScopedStorageKey(BASE_KEY_TRANSACTIONS, currentSyncUserId.current),
        JSON.stringify(newTxList)
      );
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
      localStorage.setItem(
        getScopedStorageKey(BASE_KEY_GOALS, currentSyncUserId.current),
        JSON.stringify(updated)
      );
    } catch (e) {
      console.error('Erro ao salvar metas:', e);
    }

    if (currentSyncUserId.current) {
      try {
        await syncGoalsToCloud(updated, currentSyncUserId.current);
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
      localStorage.setItem(
        getScopedStorageKey(BASE_KEY_DIVIDENDS, currentSyncUserId.current),
        JSON.stringify(updated)
      );
    } catch (e) {
      console.error('Erro ao salvar dividendo:', e);
    }

    if (currentSyncUserId.current) {
      await syncDividendToCloud(cleanTicker, div, currentSyncUserId.current);
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
    splitAdjustment?: Transaction['splitAdjustment'];
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
      splitAdjustment: data.splitAdjustment,
    };

    const updated = [newTx, ...transactions];
    persistTransactions(updated);

    syncTransactionToCloud(newTx, currentSyncUserId.current).catch((err) => {
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
    splitAdjustment?: Transaction['splitAdjustment'];
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
      splitAdjustment: data.splitAdjustment,
    };

    const updatedList = transactions.map((t) => (t.id === id ? updatedTx : t));
    persistTransactions(updatedList);

    syncTransactionToCloud(updatedTx, currentSyncUserId.current).catch((err) => {
      console.warn('Falha ao atualizar no Supabase:', err);
    });

    return updatedTx;
  };

  // Excluir aporte
  const deleteTransaction = async (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    persistTransactions(updated);

    deleteRemoteTransaction(id, currentSyncUserId.current).catch((err) => {
      console.warn('Falha ao deletar no Supabase:', err);
    });
  };

  // Limpar tudo em 1 único Batch Delete no Supabase
  const clearAllTransactions = async () => {
    const existingIds = transactions.map((t) => t.id);
    persistTransactions([]);
    if (existingIds.length > 0) {
      deleteRemoteTransactionsBatch(existingIds, currentSyncUserId.current).catch(() => {});
    }
  };

  // Recarregar dados de exemplo em 1 único Batch Upsert
  const resetDemo = async () => {
    persistTransactions(DEMO_TRANSACTIONS);
    syncTransactionsBatchToCloud(DEMO_TRANSACTIONS, currentSyncUserId.current).catch(() => {});
  };

  // Importar transações vindas da planilha da B3 (Batch Upsert & Batch Delete no Supabase)
  const importTransactionsFromB3 = async (newTxs: Transaction[], replaceAll: boolean) => {
    if (!newTxs.every(validateTransaction)) throw new Error('Importação inválida. Nenhum dado alterado.');
    localStorage.setItem(getScopedStorageKey('fii_before_import', currentSyncUserId.current), exportBackup());
    const importUser = currentSyncUserId.current;
    const { deduplicateB3Transactions } = await import('../lib/b3Parser');
    if (currentSyncUserId.current !== importUser) throw new Error('Conta alterada durante a importação. Tente novamente.');
    let finalTransactions: Transaction[] = [];
    let txsToUpsert: Transaction[] = newTxs;

    const demoIds = transactions.filter((t) => t.id.startsWith('demo-')).map((t) => t.id);
    const realExistingTxs = transactions.filter((t) => !t.id.startsWith('demo-'));

    if (replaceAll) {
      const incomingIds = new Set(newTxs.map(t => t.id));
      const allExistingIds = transactions.filter(t => !incomingIds.has(t.id)).map((t) => t.id);
      if (allExistingIds.length > 0) {
        deleteRemoteTransactionsBatch(allExistingIds, currentSyncUserId.current).catch(() => {});
      }
      finalTransactions = newTxs;
    } else {
      if (demoIds.length > 0) {
        deleteRemoteTransactionsBatch(demoIds, currentSyncUserId.current).catch(() => {});
      }
      const { uniqueTransactions } = deduplicateB3Transactions(newTxs, realExistingTxs);
      txsToUpsert = uniqueTransactions;
      finalTransactions = [...uniqueTransactions, ...realExistingTxs];
    }

    persistTransactions(finalTransactions);

    if (txsToUpsert.length > 0) {
      await syncTransactionsBatchToCloud(txsToUpsert, currentSyncUserId.current);
      // Connectivity is determined by a successful authenticated sync.
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
    try {
      localStorage.setItem(
        getScopedStorageKey(BASE_KEY_FIXED_INCOME, currentSyncUserId.current),
        JSON.stringify(newList)
      );
    } catch (e) {
      console.error('Erro ao salvar renda fixa:', e);
      throw new Error('Não foi possível salvar a Renda Fixa neste dispositivo. Verifique o espaço disponível e tente novamente.');
    }
    setFixedIncomeAssets(newList);
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

    syncFixedIncomeToCloud(newAsset, currentSyncUserId.current).catch((err) => {
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
      syncFixedIncomeToCloud(updatedAsset, currentSyncUserId.current).catch((err) => {
        console.warn('Falha ao atualizar renda fixa no Supabase:', err);
      });
    }
    return updatedAsset;
  };

  const deleteFixedIncomeAsset = async (id: string) => {
    const updated = fixedIncomeAssets.filter((a) => a.id !== id);
    persistFixedIncome(updated);

    deleteRemoteFixedIncome(id, currentSyncUserId.current).catch((err) => {
      console.warn('Falha ao deletar renda fixa no Supabase:', err);
    });
  };

  const resetFixedIncomeDemo = async () => {
    persistFixedIncome(DEMO_FIXED_INCOME);
    if (DEMO_FIXED_INCOME[0]) {
      syncFixedIncomeToCloud(DEMO_FIXED_INCOME[0], currentSyncUserId.current).catch(() => {});
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
      version: '5.0.0',
      exportedAt: new Date().toISOString(),
      transactions,
      goals,
      customDividends,
      fixedIncomeAssets,
    };
    return JSON.stringify(data, null, 2);
  };

  const exportCorruptQueue = () => {
    const user = currentSyncUserId.current;
    if (!user) return;
    if (!inspectQueue(user).corrupt.length) return;
    const entries = readRawQueue(user);
    const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fii-tracker-fila-local-ilegivel.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Importar Backup JSON (com Batch Upsert no Supabase)
  const importBackup = async (jsonStr: string) => {
    const user = currentSyncUserId.current;
    try {
      const parsed = parsePortfolioBackup(jsonStr);
      localStorage.setItem(getScopedStorageKey('fii_before_import', user), exportBackup());
      // Explicit restoration gets fresh identities; stale devices cannot revive deleted IDs.
      const restoredTxs = parsed.transactions.map(t => ({ ...t, id: crypto.randomUUID() }));
      const restoredFi = parsed.fixedIncomeAssets.map(t => ({ ...t, id: crypto.randomUUID() }));
      const oldTxIds = transactions.map(t => t.id);
      const oldFiIds = fixedIncomeAssets.map(t => t.id);
      const removedDividends = Object.keys(customDividends).filter(t => !(t in parsed.customDividends));
      persistTransactions(restoredTxs);
      persistFixedIncome(restoredFi);
      setGoals(parsed.goals);
      setCustomDividends(parsed.customDividends);
      localStorage.setItem(getScopedStorageKey(BASE_KEY_GOALS, user), JSON.stringify(parsed.goals));
      localStorage.setItem(getScopedStorageKey(BASE_KEY_DIVIDENDS, user), JSON.stringify(parsed.customDividends));
      // All writes capture the original owner, independent of later account switches.
      await deleteRemoteTransactionsBatch(oldTxIds, user);
      for (const id of oldFiIds) await deleteRemoteFixedIncome(id, user);
      await deleteRemoteCustomDividends(removedDividends, user);
      await syncTransactionsBatchToCloud(restoredTxs, user);
      for (const asset of restoredFi) await syncFixedIncomeToCloud(asset, user);
      await syncGoalsToCloud(parsed.goals, user);
      for (const [ticker, amount] of Object.entries(parsed.customDividends)) await syncDividendToCloud(ticker, amount, user);
      return true;
    } catch (e) {
      console.error('Falha ao importar backup:', e);
      return false;
    }
  };

  const undoLastImport = async () => {
    const user = currentSyncUserId.current;
    const key = getScopedStorageKey('fii_before_import', user);
    const previous = localStorage.getItem(key);
    if (!previous) return false;
    const restored = await importBackup(previous);
    if (restored) localStorage.removeItem(key);
    return restored;
  };

  // Sincroniza/migra preferências de notificações Web Push com o servidor sem disparo duplicado no cliente
  useEffect(() => {
    if (isInitialized && isCloudConnected && activeUserId) {
      void fetchServerPushState(activeUserId);
    }
  }, [isInitialized, isCloudConnected, activeUserId]);

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
    pendingChanges,
    corruptQueueCount,
    syncError,
    exportCorruptQueue,
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
    undoLastImport,
    importTransactionsFromB3,
  };
}
