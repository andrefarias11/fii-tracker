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
} from '../lib/supabase';
import { getActiveAccount, getSavedAccounts, subscribeAuthAccounts } from '../lib/authManager';

const BASE_KEY_TRANSACTIONS = 'fii_tracker_transactions_v1';
const BASE_KEY_GOALS = 'fii_tracker_goals_v1';
const BASE_KEY_DIVIDENDS = 'fii_tracker_dividends_v1';
const BASE_KEY_FIXED_INCOME = 'fii_tracker_fixed_income_v1';

export function getScopedStorageKey(baseKey: string, userId: string | null): string {
  const scope = userId ? userId : 'guest';
  return `${baseKey}_${scope}`;
}

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

function loadScopedData(userId: string | null) {
  if (typeof window === 'undefined') {
    return {
      transactions: [],
      fixedIncomeAssets: [],
      goals: DEFAULT_GOALS,
      customDividends: {},
    };
  }

  const txKey = getScopedStorageKey(BASE_KEY_TRANSACTIONS, userId);
  const fiKey = getScopedStorageKey(BASE_KEY_FIXED_INCOME, userId);
  const goalsKey = getScopedStorageKey(BASE_KEY_GOALS, userId);
  const divKey = getScopedStorageKey(BASE_KEY_DIVIDENDS, userId);

  let rawTx = localStorage.getItem(txKey);
  let rawFi = localStorage.getItem(fiKey);
  let rawGoals = localStorage.getItem(goalsKey);
  let rawDiv = localStorage.getItem(divKey);

  // Se a chave com escopo ainda não existir:
  if (!rawTx && !rawFi && !rawGoals && !rawDiv) {
    if (userId) {
      // É uma conta autenticada
      const accounts = getSavedAccounts();
      // Regra Estrita: A migração de dados locais/legados (guest) só pode acontecer
      // para a PRIMEIRA conta que foi logada no aparelho! NUNCA para a 2ª ou 3ª conta!
      const isPrimaryAccount =
        accounts.length <= 1 && (accounts.length === 0 || accounts[0]?.id === userId);
      const alreadyMigrated = localStorage.getItem('fii_tracker_legacy_migrated_v1') === 'true';

      if (isPrimaryAccount && !alreadyMigrated) {
        // Migra dados legados (sem sufixo) para a conta principal
        const legacyTx = localStorage.getItem(BASE_KEY_TRANSACTIONS);
        const legacyFi = localStorage.getItem(BASE_KEY_FIXED_INCOME);
        const legacyGoals = localStorage.getItem(BASE_KEY_GOALS);
        const legacyDiv = localStorage.getItem(BASE_KEY_DIVIDENDS);

        if (legacyTx) {
          rawTx = legacyTx;
          localStorage.setItem(txKey, legacyTx);
        }
        if (legacyFi) {
          rawFi = legacyFi;
          localStorage.setItem(fiKey, legacyFi);
        }
        if (legacyGoals) {
          rawGoals = legacyGoals;
          localStorage.setItem(goalsKey, legacyGoals);
        }
        if (legacyDiv) {
          rawDiv = legacyDiv;
          localStorage.setItem(divKey, legacyDiv);
        }
        localStorage.setItem('fii_tracker_legacy_migrated_v1', 'true');
      }
      // Se NÃO for a primeira conta (ex: Conta 2, 3 de teste), NÃO copia nada! Começa vazia!
    } else {
      // Usuário Guest (deslogado): tenta carregar do legado sem sufixo se a chave guest estiver vazia
      rawTx = localStorage.getItem(BASE_KEY_TRANSACTIONS);
      rawFi = localStorage.getItem(BASE_KEY_FIXED_INCOME);
      rawGoals = localStorage.getItem(BASE_KEY_GOALS);
      rawDiv = localStorage.getItem(BASE_KEY_DIVIDENDS);
    }
  }

  let transactions: Transaction[] = [];
  let fixedIncomeAssets: FixedIncomeAsset[] = [];
  let goals: PortfolioGoals = DEFAULT_GOALS;
  let customDividends: Record<string, number> = {};

  try {
    if (rawTx) transactions = JSON.parse(rawTx);
  } catch {}
  try {
    if (rawFi) fixedIncomeAssets = JSON.parse(rawFi);
  } catch {}
  try {
    if (rawGoals) goals = JSON.parse(rawGoals);
  } catch {}
  try {
    if (rawDiv) customDividends = JSON.parse(rawDiv);
  } catch {}

  return { transactions, fixedIncomeAssets, goals, customDividends };
}

export function usePortfolio(explicitUserId?: string | null) {
  const [activeUserId, setActiveUserId] = useState<string | null>(() => {
    if (explicitUserId !== undefined) return explicitUserId;
    if (typeof window !== 'undefined') {
      return getActiveAccount()?.id || null;
    }
    return null;
  });

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

  // Sincroniza com prop explicitUserId se fornecida
  useEffect(() => {
    if (explicitUserId !== undefined && explicitUserId !== activeUserId) {
      setActiveUserId(explicitUserId);
    }
  }, [explicitUserId, activeUserId]);

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

    const config = getSupabaseConfig();
    if (!config.url || !config.key) {
      setIsCloudConnected(false);
      return;
    }

    setIsSyncing(true);
    try {
      const isConnected = await checkSupabaseConnection();
      setIsCloudConnected(isConnected);

      // Trava 1: Se o usuário ativo mudou durante a checagem de conexão, interrompe
      if (currentSyncUserId.current !== syncUser) {
        return;
      }

      if (isConnected) {
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
            if (localTx.id.startsWith('demo-')) continue;

            if (!remoteIds.has(localTx.id)) {
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

          // Trava 3: Só sobe registros locais se o usuário ativo ainda for o mesmo!
          if (missingInRemote.length > 0 && currentSyncUserId.current === syncUser) {
            await syncTransactionsBatchToCloud(missingInRemote, syncUser);
          }

          if (currentSyncUserId.current !== syncUser) return;

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

          if (missingInRemoteFi.length > 0 && currentSyncUserId.current === syncUser) {
            for (const asset of missingInRemoteFi) {
              await syncFixedIncomeToCloud(asset, syncUser);
            }
          }

          if (currentSyncUserId.current !== syncUser) return;

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
      console.error('Erro na sincronização com Supabase:', err);
    } finally {
      if (currentSyncUserId.current === syncUser) {
        setIsSyncing(false);
      }
    }
  }, []);

  // Ao alterar o activeUserId (troca de conta ou montagem inicial):
  // 1. Limpa IMEDIATAMENTE estados em memória
  // 2. Carrega EXCLUSIVAMENTE o storage com escopo do novo usuário
  // 3. Dispara syncWithCloud para o novo usuário
  useEffect(() => {
    currentSyncUserId.current = activeUserId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentYearMonth(new Date().toISOString().slice(0, 7));

    // Limpeza IMEDIATA do estado em memória
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactions([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFixedIncomeAssets([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomDividends({});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoals(DEFAULT_GOALS);

    // Carrega dados locais específicos deste usuário
    const data = loadScopedData(activeUserId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactions(data.transactions);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFixedIncomeAssets(data.fixedIncomeAssets);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoals(data.goals);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomDividends(data.customDividends);

    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    if (isCloudConnected) {
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

    if (isCloudConnected) {
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
    let finalTransactions: Transaction[] = [];
    let txsToUpsert: Transaction[] = newTxs;

    const demoIds = transactions.filter((t) => t.id.startsWith('demo-')).map((t) => t.id);
    const realExistingTxs = transactions.filter((t) => !t.id.startsWith('demo-'));

    if (replaceAll) {
      const allExistingIds = transactions.map((t) => t.id);
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
      localStorage.setItem(
        getScopedStorageKey(BASE_KEY_FIXED_INCOME, currentSyncUserId.current),
        JSON.stringify(newList)
      );
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
          await syncTransactionsBatchToCloud(parsed.transactions, currentSyncUserId.current);
        }
      }
      if (parsed.goals) {
        updateGoals(parsed.goals);
      }
      if (parsed.customDividends) {
        setCustomDividends(parsed.customDividends);
        try {
          localStorage.setItem(
            getScopedStorageKey(BASE_KEY_DIVIDENDS, currentSyncUserId.current),
            JSON.stringify(parsed.customDividends)
          );
        } catch {}
      }
      if (Array.isArray(parsed.fixedIncomeAssets)) {
        persistFixedIncome(parsed.fixedIncomeAssets);
        if (isCloudConnected) {
          for (const fi of parsed.fixedIncomeAssets) {
            await syncFixedIncomeToCloud(fi, currentSyncUserId.current);
          }
        }
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
