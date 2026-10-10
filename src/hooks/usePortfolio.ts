'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, FiiPosition, PortfolioGoals, QuoteData } from '../types/portfolio';
import { findFiiInfo } from '../data/fiiDatabase';
import {
  checkSupabaseConnection,
  fetchRemoteTransactions,
  upsertRemoteTransaction,
  deleteRemoteTransaction,
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
    notes: 'Primeiro aporte do mês'
  },
  {
    id: 'demo-2',
    ticker: 'VGIR11',
    date: '2026-10-01',
    shares: 10,
    price: 9.60,
    total: 96.00,
    broker: 'XP Investimentos',
    notes: 'Diversificação em Papel/CDI'
  }
];

export function usePortfolio() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<PortfolioGoals>(DEFAULT_GOALS);
  const [customDividends, setCustomDividends] = useState<Record<string, number>>({});
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [isLoadingQuotes, setIsLoadingQuotes] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [currentYearMonth, setCurrentYearMonth] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Estados de Nuvem (Supabase)
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sincronizar com o Supabase
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
        // 1. Sincronizar Metas
        const remoteGoals = await fetchRemoteGoals();
        if (remoteGoals) {
          setGoals(remoteGoals);
          localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(remoteGoals));
        }

        // 2. Sincronizar Dividendos
        const remoteDivs = await fetchRemoteDividends();
        if (remoteDivs) {
          setCustomDividends(remoteDivs);
          localStorage.setItem(STORAGE_KEY_DIVIDENDS, JSON.stringify(remoteDivs));
        }

        // 3. Sincronizar Transações
        const remoteTxs = await fetchRemoteTransactions();
        if (remoteTxs && remoteTxs.length > 0) {
          setTransactions(remoteTxs);
          localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(remoteTxs));
        } else if (remoteTxs && remoteTxs.length === 0) {
          // Se o banco estiver vazio, enviar os dados locais existentes para o Supabase
          const localTxsStr = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
          if (localTxsStr) {
            const localTxs: Transaction[] = JSON.parse(localTxsStr);
            for (const tx of localTxs) {
              await upsertRemoteTransaction(tx);
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
      monthlyTarget: newGoals.monthlyTarget !== undefined ? Number(newGoals.monthlyTarget) : (goals.monthlyTarget || 200),
      milestoneEquityTarget: newGoals.milestoneEquityTarget !== undefined ? Number(newGoals.milestoneEquityTarget) : (goals.milestoneEquityTarget || 1000),
      monthlyIncomeTarget: newGoals.monthlyIncomeTarget !== undefined ? Number(newGoals.monthlyIncomeTarget) : (goals.monthlyIncomeTarget || 10),
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
    const cleanTicker = ticker.toUpperCase();
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

  // Adicionar aporte
  const addTransaction = async (data: {
    ticker: string;
    date: string;
    shares: number;
    price: number;
    broker?: string;
    notes?: string;
  }) => {
    const total = Number((data.shares * data.price).toFixed(2));
    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ticker: data.ticker.toUpperCase().trim(),
      date: data.date,
      shares: Number(data.shares),
      price: Number(data.price),
      total,
      broker: data.broker || 'XP Investimentos',
      notes: data.notes
    };

    const updated = [newTx, ...transactions];
    persistTransactions(updated);

    if (isCloudConnected) {
      await upsertRemoteTransaction(newTx);
    }

    return newTx;
  };

  // Editar aporte existente
  const updateTransaction = async (
    id: string,
    data: {
      ticker: string;
      date: string;
      shares: number;
      price: number;
      broker?: string;
      notes?: string;
    }
  ) => {
    const total = Number((data.shares * data.price).toFixed(2));
    const updatedTx: Transaction = {
      id,
      ticker: data.ticker.toUpperCase().trim(),
      date: data.date,
      shares: Number(data.shares),
      price: Number(data.price),
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

  // Limpar tudo
  const clearAllTransactions = async () => {
    if (isCloudConnected) {
      for (const tx of transactions) {
        await deleteRemoteTransaction(tx.id);
      }
    }
    persistTransactions([]);
  };

  // Recarregar dados de exemplo
  const resetDemo = async () => {
    persistTransactions(DEMO_TRANSACTIONS);
    if (isCloudConnected) {
      for (const tx of DEMO_TRANSACTIONS) {
        await upsertRemoteTransaction(tx);
      }
    }
  };

  // Importar transações vindas da planilha da B3
  const importTransactionsFromB3 = async (newTxs: Transaction[], replaceAll: boolean) => {
    let finalTransactions: Transaction[] = [];

    if (replaceAll) {
      if (isCloudConnected) {
        for (const tx of transactions) {
          await deleteRemoteTransaction(tx.id);
        }
      }
      finalTransactions = newTxs;
    } else {
      finalTransactions = [...newTxs, ...transactions];
    }

    persistTransactions(finalTransactions);

    if (isCloudConnected) {
      for (const tx of newTxs) {
        await upsertRemoteTransaction(tx);
      }
    }
  };

  // Buscar cotações em tempo real (carteira + radar de oportunidades)
  const fetchLiveQuotes = useCallback(async () => {
    const radarTickers = [
      'MXRF11',
      'VGIR11',
      'CPTS11',
      'KISU11',
      'GALG11',
      'SNAG11',
      'VGIA11',
      'XPML11',
      'HGLG11',
      'BTLG11',
      'KNCR11',
      'TRXF11',
    ];
    const uniqueTickers = Array.from(
      new Set([...transactions.map((t) => t.ticker.toUpperCase().trim()), ...radarTickers])
    );
    if (uniqueTickers.length === 0) return;

    setIsLoadingQuotes(true);
    try {
      const res = await fetch(`/api/quote?tickers=${encodeURIComponent(uniqueTickers.join(','))}`);
      if (res.ok) {
        const data = await res.json();
        if (data.quotes) {
          setQuotes((prev) => ({ ...prev, ...data.quotes }));
          setLastSyncTime(new Date());
        }
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
      fetchLiveQuotes();
    }
  }, [isInitialized, transactions.length, fetchLiveQuotes]);

  // Agrupar posições por FII
  const positions: FiiPosition[] = useMemo(() => {
    const map = new Map<string, { totalShares: number; totalInvested: number }>();

    for (const tx of transactions) {
      const current = map.get(tx.ticker) || { totalShares: 0, totalInvested: 0 };
      current.totalShares += tx.shares;
      current.totalInvested += tx.total;
      map.set(tx.ticker, current);
    }

    const result: FiiPosition[] = [];

    for (const [ticker, data] of map.entries()) {
      if (data.totalShares <= 0) continue;

      const info = findFiiInfo(ticker);
      const averagePrice = Number((data.totalInvested / data.totalShares).toFixed(2));
      const liveQuote = quotes[ticker];
      const currentPrice = liveQuote?.price ? liveQuote.price : averagePrice;
      const currentTotal = Number((data.totalShares * currentPrice).toFixed(2));
      const profitLoss = Number((currentTotal - data.totalInvested).toFixed(2));
      const profitLossPercent = data.totalInvested > 0
        ? Number(((profitLoss / data.totalInvested) * 100).toFixed(2))
        : 0;

      // Prioridade: 1) Dividendo customizado pelo usuário, 2) Último dividendo real da B3 via API, 3) Catálogo
      const hasCustomDiv = customDividends[ticker] !== undefined;
      const hasLiveDiv = Boolean(liveQuote?.lastDividend && liveQuote.lastDividend > 0);

      const monthlyDividendPerShare = hasCustomDiv
        ? customDividends[ticker]
        : hasLiveDiv
        ? Number((liveQuote!.lastDividend || 0).toFixed(3))
        : info.estimatedMonthlyDividend;

      const dividendSource: FiiPosition['dividendSource'] = hasCustomDiv
        ? 'MANUAL'
        : hasLiveDiv
        ? liveQuote?.dividendSource || 'MERCADO'
        : 'CATALOGO';

      const totalMonthlyDividend = Number((data.totalShares * monthlyDividendPerShare).toFixed(2));

      const vp = liveQuote?.vp || info.vp || currentPrice;
      const pvp = vp > 0 ? Number((currentPrice / vp).toFixed(2)) : 1.0;

      const currentYieldPercent =
        currentPrice > 0 ? Number(((monthlyDividendPerShare / currentPrice) * 100).toFixed(2)) : 0;
      const yieldOnCostPercent =
        averagePrice > 0 ? Number(((monthlyDividendPerShare / averagePrice) * 100).toFixed(2)) : 0;
      // Preço teto considerando meta mínima de 0,90% a.m. isento de IR
      const ceilingPrice = Number((monthlyDividendPerShare / 0.009).toFixed(2));

      // Número Mágico
      const magicNumber = monthlyDividendPerShare > 0
        ? Math.ceil(currentPrice / monthlyDividendPerShare)
        : 100;
      const magicProgressPercent = Math.min(100, Math.round((data.totalShares / magicNumber) * 100));

      result.push({
        ticker,
        name: info.name,
        segment: info.segment,
        base: info.base,
        vp,
        pvp,
        totalShares: data.totalShares,
        averagePrice,
        totalInvested: Number(data.totalInvested.toFixed(2)),
        currentPrice,
        currentTotal,
        profitLoss,
        profitLossPercent,
        monthlyDividendPerShare,
        totalMonthlyDividend,
        currentYieldPercent,
        yieldOnCostPercent,
        ceilingPrice,
        magicNumber,
        magicProgressPercent,
        dailyChangePercent: liveQuote?.changePercent,
        lastUpdated: liveQuote?.updatedAt,
        dividendExDate: liveQuote?.dividendExDate,
        dividendPaymentDate: liveQuote?.dividendPaymentDate,
        dividendPaymentDay: liveQuote?.dividendPaymentDay,
        isCurrentMonthAnnounced: liveQuote?.isCurrentMonthAnnounced,
        dividendSource,
      });
    }

    return result.sort((a, b) => b.currentTotal - a.currentTotal);
  }, [transactions, quotes, customDividends]);

  // Resumo Geral da Carteira
  const summary = useMemo(() => {
    const totalInvested = positions.reduce((acc, p) => acc + p.totalInvested, 0);
    const currentEquity = positions.reduce((acc, p) => acc + p.currentTotal, 0);
    const totalProfitLoss = Number((currentEquity - totalInvested).toFixed(2));
    const totalProfitLossPercent = totalInvested > 0
      ? Number(((totalProfitLoss / totalInvested) * 100).toFixed(2))
      : 0;
    const totalMonthlyDividends = Number(
      positions.reduce((acc, p) => acc + p.totalMonthlyDividend, 0).toFixed(2)
    );
    const averageYieldOnCostPercent = totalInvested > 0
      ? Number(((totalMonthlyDividends / totalInvested) * 100).toFixed(2))
      : 0;

    // Aportes do mês atual
    const currentMonthInvested = currentYearMonth
      ? transactions
          .filter((t) => t.date.startsWith(currentYearMonth))
          .reduce((acc, t) => acc + t.total, 0)
      : 0;

    const monthlyGoalProgressPercent = Math.min(
      100,
      Math.round((currentMonthInvested / (goals.monthlyTarget || 200)) * 100)
    );

    const equityGoalProgressPercent = Math.min(
      100,
      Math.round((currentEquity / (goals.milestoneEquityTarget || 1000)) * 100)
    );

    const incomeGoalProgressPercent = Math.min(
      100,
      Math.round((totalMonthlyDividends / (goals.monthlyIncomeTarget || 10)) * 100)
    );

    return {
      totalInvested: Number(totalInvested.toFixed(2)),
      currentEquity: Number(currentEquity.toFixed(2)),
      totalProfitLoss,
      totalProfitLossPercent,
      totalMonthlyDividends,
      averageYieldOnCostPercent,
      currentMonthInvested: Number(currentMonthInvested.toFixed(2)),
      monthlyGoalProgressPercent,
      equityGoalProgressPercent,
      incomeGoalProgressPercent
    };
  }, [positions, transactions, goals, currentYearMonth]);

  // Exportar Backup JSON
  const exportBackup = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      transactions,
      goals,
      customDividends
    };
    return JSON.stringify(data, null, 2);
  };

  // Importar Backup JSON
  const importBackup = async (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.transactions)) {
        persistTransactions(parsed.transactions);
        if (isCloudConnected) {
          for (const tx of parsed.transactions) {
            await upsertRemoteTransaction(tx);
          }
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

  return {
    isInitialized,
    transactions,
    positions,
    summary,
    goals,
    quotes,
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
    importTransactionsFromB3
  };
}

