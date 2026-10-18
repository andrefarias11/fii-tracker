'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { Header } from '../components/Header';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { GoalsCard } from '../components/GoalsCard';
import { MagicNumberCard } from '../components/MagicNumberCard';
import { PositionList } from '../components/PositionList';
import { TransactionHistory } from '../components/TransactionHistory';
import { InvestmentSimulator } from '../components/InvestmentSimulator';
import { OpportunityRadar } from '../components/OpportunityRadar';
import { UniversalB3Explorer } from '../components/UniversalB3Explorer';
import { MentorsTab } from '../components/MentorsTab';
import { RealEstateMap } from '../components/RealEstateMap';
import { AiInsightsTab } from '../components/AiInsightsTab';
import { DividendFlow } from '../components/DividendFlow';
import { AchievementsTimeline } from '../components/AchievementsTimeline';
import { MonthlyWrappedModal } from '../components/MonthlyWrappedModal';
import { SettingsModal } from '../components/SettingsModal';
import { B3ImportModal } from '../components/B3ImportModal';
import { IosInstallBanner } from '../components/IosInstallBanner';
import { AddFixedIncomeModal } from '../components/AddFixedIncomeModal';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { FixedIncomeList } from '../components/FixedIncomeList';
import { FixedIncomeAsset, Transaction } from '../types/portfolio';
import { AccountSwitcherModal } from '../components/AccountSwitcherModal';
import {
  initAuthVaultListener,
  getActiveAccount,
  subscribeAuthAccounts,
  SavedAccountSession,
} from '../lib/authManager';
import { calculateMonthlyWrapped } from '../lib/monthlyWrapped';
import { triggerHaptic } from '../lib/haptic';
import {
  Wallet,
  Target,
  Compass,
  Coins,
  GraduationCap,
  Layers,
  ReceiptText,
  Sparkles,
  Trophy,
  Globe,
  PiggyBank,
  MapPin,
} from 'lucide-react';

type MainTabType = 'portfolio' | 'proventos' | 'radar' | 'goals';

export default function HomePage() {
  const [activeAccount, setActiveAccount] = useState<SavedAccountSession | null>(() => {
    if (typeof window === 'undefined') return null;
    return getActiveAccount();
  });

  const {
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
  } = usePortfolio(activeAccount?.id);

  const [activeTab, setActiveTab] = useState<MainTabType>(() => {
    if (typeof window === 'undefined') return 'portfolio';
    const raw = new URLSearchParams(window.location.search).get('tab');
    if (raw === 'proventos') return 'proventos';
    if (
      raw === 'radar' ||
      raw === 'mentors' ||
      raw === 'universal' ||
      raw === 'map' ||
      raw === 'ai'
    )
      return 'radar';
    if (raw === 'goals' || raw === 'achievements') return 'goals';
    return 'portfolio';
  });
  const [homeSubView, setHomeSubView] = useState<'assets' | 'fixed_income' | 'history'>(() => {
    if (typeof window === 'undefined') return 'assets';
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'history') return 'history';
    if (tab === 'fixed_income' || tab === 'caixinhas') return 'fixed_income';
    return 'assets';
  });
  const [exploreSubView, setExploreSubView] = useState<
    'radar' | 'universal' | 'map' | 'ai' | 'mentors'
  >(() => {
    if (typeof window === 'undefined') return 'radar';
    const raw = new URLSearchParams(window.location.search).get('tab');
    if (raw === 'mentors') return 'mentors';
    if (raw === 'universal') return 'universal';
    if (raw === 'map') return 'map';
    if (raw === 'ai') return 'ai';
    return 'radar';
  });
  const [exploreTickerFilter, setExploreTickerFilter] = useState<string | null>(null);
  const [goalsSubView, setGoalsSubView] = useState<'achievements' | 'targets' | 'simulator'>(
    'achievements'
  );

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState<boolean>(false);
  const [isB3ModalOpen, setIsB3ModalOpen] = useState<boolean>(false);
  const [isWrappedModalOpen, setIsWrappedModalOpen] = useState<boolean>(false);
  const [isFixedIncomeModalOpen, setIsFixedIncomeModalOpen] = useState<boolean>(false);
  const [editingFixedIncomeAsset, setEditingFixedIncomeAsset] = useState<FixedIncomeAsset | null>(null);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState<boolean>(false);
  const [addTxTicker, setAddTxTicker] = useState<string>('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  useEffect(() => {
    // Inicializa listener do cofre de sessões (OAuth redirect Google, SIGNED_IN e INITIAL_SESSION)
    initAuthVaultListener();

    const unsubscribe = subscribeAuthAccounts((_, active) => {
      setActiveAccount(active);
    });

    return () => unsubscribe();
  }, []);

  // Sincronização automática em segundo plano ao focar a aba ou retornar ao app no celular (PWA / iOS / Web)
  useEffect(() => {
    if (!isInitialized) return;

    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncWithCloud();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [isInitialized, syncWithCloud]);

  const monthlyWrapped = useMemo(() => {
    if (!isInitialized) return null;
    return calculateMonthlyWrapped(positions, transactions, goals.monthlyTarget);
  }, [isInitialized, positions, transactions, goals.monthlyTarget]);

  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('fii_tracker_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleTogglePrivacy = () => {
    triggerHaptic('light');
    setIsPrivacyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('fii_tracker_privacy_mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const navigateFromTabParam = (rawTab: string | null) => {
    if (!rawTab) return;
    if (rawTab === 'portfolio') {
      setActiveTab('portfolio');
      setHomeSubView('assets');
    } else if (rawTab === 'history') {
      setActiveTab('portfolio');
      setHomeSubView('history');
    } else if (rawTab === 'proventos') {
      setActiveTab('proventos');
    } else if (rawTab === 'radar') {
      setActiveTab('radar');
      setExploreSubView('radar');
    } else if (rawTab === 'mentors') {
      setActiveTab('radar');
      setExploreSubView('mentors');
    } else if (rawTab === 'goals' || rawTab === 'achievements') {
      setActiveTab('goals');
      setGoalsSubView('achievements');
    }
  };

  // Garante que a página inicie no topo ao carregar
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [isInitialized]);

  // Escuta clique em notificações Web Push
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_FROM_PUSH' && typeof event.data.url === 'string') {
        try {
          const url = new URL(event.data.url, window.location.origin);
          navigateFromTabParam(url.searchParams.get('tab'));
        } catch {
          // ignore
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-[100dvh] bg-[#0b0b0d] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-full bg-[#2b2512] border border-[#f5b800]/30 flex items-center justify-center animate-pulse mb-3">
          <div className="w-3.5 h-3.5 rounded-full bg-[#f5b800]" />
        </div>
        <p className="text-xs font-medium text-zinc-400">Carregando FII Tracker...</p>
      </div>
    );
  }

  // 4 Abas Principais na Dock Flutuante (Estilo XP Investimentos)
  const navItems: { id: MainTabType; label: string; icon: typeof Wallet }[] = [
    { id: 'portfolio', label: 'Carteira', icon: Wallet },
    { id: 'proventos', label: 'Proventos', icon: Coins },
    { id: 'radar', label: 'Explorar', icon: Compass },
    { id: 'goals', label: 'Rentabilidade', icon: Trophy },
  ];

  const getTabTitle = (tab: MainTabType) => {
    switch (tab) {
      case 'portfolio':
        return 'Carteira';
      case 'proventos':
        return 'Proventos';
      case 'radar':
        return 'Explorar';
      case 'goals':
        return 'Rentabilidade';
      default:
        return 'Carteira';
    }
  };

  const handleOpenBuyForTicker = (ticker: string) => {
    setEditingTx(null);
    setAddTxTicker(ticker);
    setIsAddTxModalOpen(true);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0b0b0d] text-zinc-100 flex flex-col antialiased selection:bg-[#f5b800] selection:text-zinc-950">
      {/* Header Estilo XP */}
      <Header
        title={getTabTitle(activeTab)}
        lastSyncTime={lastSyncTime}
        isLoadingQuotes={isLoadingQuotes}
        isCloudConnected={isCloudConnected}
        isSyncingCloud={isSyncing}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={handleTogglePrivacy}
        onRefresh={async () => {
          triggerHaptic('medium');
          await Promise.all([fetchLiveQuotes(), syncWithCloud()]);
        }}
        onSyncCloud={async () => {
          triggerHaptic('light');
          await syncWithCloud();
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenAccountSwitcher={() => setIsAccountSwitcherOpen(true)}
        activeAccount={activeAccount}
        onOpenWrapped={
          monthlyWrapped && monthlyWrapped.hasActivity
            ? () => setIsWrappedModalOpen(true)
            : undefined
        }
      />

      {/* Conteúdo Principal com Respiro Estilo iOS */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 pb-32 space-y-4">
        <IosInstallBanner />

        {/* 1. ABA: INÍCIO (CARTEIRA + EXTRATO INTEGRADO) */}
        {activeTab === 'portfolio' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <PortfolioSummary
              currentEquity={summary.currentEquity}
              totalInvested={summary.totalInvested}
              totalProfitLoss={summary.totalProfitLoss}
              totalProfitLossPercent={summary.totalProfitLossPercent}
              totalMonthlyDividends={summary.totalMonthlyDividends}
              averageYieldOnCostPercent={summary.averageYieldOnCostPercent}
              currentMonthInvested={summary.currentMonthInvested}
              monthlyTarget={goals.monthlyTarget}
              monthlyGoalProgressPercent={summary.monthlyGoalProgressPercent}
              bcbIndicators={bcbIndicators}
              unifiedSummary={unifiedSummary}
              fixedIncomeCount={fixedIncomeAssets.length}
              isPrivacyMode={isPrivacyMode}
              onNavigateToProventos={() => setActiveTab('proventos')}
              onNavigateToGoals={() => {
                setActiveTab('goals');
                setGoalsSubView('achievements');
              }}
              onOpenExtrato={() => setHomeSubView('history')}
              onNavigateToFixedIncome={() => setHomeSubView('fixed_income')}
              onOpenB3Modal={() => setIsB3ModalOpen(true)}
            />

            {/* Seletor Segmentado XP: Bolsa vs Caixinhas vs Extrato */}
            <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#1c1c1e] border border-white/[0.04] gap-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setHomeSubView('assets');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
                  homeSubView === 'assets'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span className="truncate">Bolsa ({positions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setHomeSubView('fixed_income');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
                  homeSubView === 'fixed_income'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <PiggyBank className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span className="truncate">Caixinhas ({fixedIncomeAssets.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setHomeSubView('history');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
                  homeSubView === 'history'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <ReceiptText className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span className="truncate">Extrato ({transactions.length})</span>
              </button>
            </div>

            {homeSubView === 'assets' ? (
              <div className="space-y-3 animate-in fade-in duration-150">
                <PositionList
                  positions={positions}
                  isPrivacyMode={isPrivacyMode}
                  onUpdateDividend={updateCustomDividend}
                  onOpenB3Modal={() => setIsB3ModalOpen(true)}
                  onOpenBuyModal={handleOpenBuyForTicker}
                  onOpenMapForTicker={(ticker) => {
                    setExploreTickerFilter(ticker);
                    setActiveTab('radar');
                    setExploreSubView('map');
                  }}
                  onOpenAiForTicker={(ticker) => {
                    setExploreTickerFilter(ticker);
                    setActiveTab('radar');
                    setExploreSubView('ai');
                  }}
                />
              </div>
            ) : homeSubView === 'fixed_income' ? (
              <div className="space-y-3 animate-in fade-in duration-150">
                <FixedIncomeList
                  assets={fixedIncomeAssets}
                  bcbIndicators={bcbIndicators}
                  isPrivacyMode={isPrivacyMode}
                  onAddNew={() => {
                    setEditingFixedIncomeAsset(null);
                    setIsFixedIncomeModalOpen(true);
                  }}
                  onEdit={(asset) => {
                    setEditingFixedIncomeAsset(asset);
                    setIsFixedIncomeModalOpen(true);
                  }}
                  onResetDemo={resetFixedIncomeDemo}
                />
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-150">
                <TransactionHistory
                  transactions={transactions}
                  monthlyTarget={goals.monthlyTarget}
                  isPrivacyMode={isPrivacyMode}
                  onEditTransaction={(tx) => {
                    setEditingTx(tx);
                    setAddTxTicker(tx.ticker);
                    setIsAddTxModalOpen(true);
                  }}
                  onDeleteTransaction={deleteTransaction}
                />
              </div>
            )}
          </div>
        )}

        {/* 2. ABA: PROVENTOS & DESEMPENHO DIÁRIO */}
        {activeTab === 'proventos' && (
          <div className="animate-in fade-in duration-200">
            <DividendFlow
              positions={positions}
              transactions={transactions}
              bcbIndicators={bcbIndicators}
              monthlyContributionGoal={goals.monthlyTarget}
              isPrivacyMode={isPrivacyMode}
            />
          </div>
        )}

        {/* 3. ABA: EXPLORAR (RADAR B3 + BUSCA UNIVERSAL + MAPA IMOBILIÁRIO + IA & FATOS + MENTORES) */}
        {activeTab === 'radar' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Seletor Segmentado XP: Radar | Busca B3 | Mapa | IA & Fatos | Mentores */}
            <div className="flex items-center overflow-x-auto scrollbar-none p-1 rounded-2xl bg-[#1c1c1e] border border-white/[0.04] gap-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setExploreSubView('radar');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  exploreSubView === 'radar'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span>Radar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setExploreSubView('universal');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  exploreSubView === 'universal'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span>Busca B3</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setExploreSubView('map');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  exploreSubView === 'map'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span>Mapa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setExploreSubView('ai');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  exploreSubView === 'ai'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span>IA & Fatos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setExploreSubView('mentors');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  exploreSubView === 'mentors'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span>Mentores</span>
              </button>
            </div>

            {exploreSubView === 'radar' ? (
              <div className="animate-in fade-in duration-150">
                <OpportunityRadar
                  quotes={quotes}
                  positions={positions}
                  monthlyTarget={goals.monthlyTarget}
                  currentMonthInvested={summary.currentMonthInvested}
                  totalMonthlyDividends={summary.totalMonthlyDividends}
                  fixedIncomeAssets={fixedIncomeAssets}
                  onOpenAddFixedIncome={() => {
                    setEditingFixedIncomeAsset(null);
                    setIsFixedIncomeModalOpen(true);
                  }}
                  isPrivacyMode={isPrivacyMode}
                  onOpenB3Modal={() => setIsB3ModalOpen(true)}
                  onOpenBuyModal={handleOpenBuyForTicker}
                />
              </div>
            ) : exploreSubView === 'universal' ? (
              <div className="animate-in fade-in duration-150">
                <UniversalB3Explorer
                  positions={positions}
                  monthlyTarget={goals.monthlyTarget}
                  onOpenBuyModal={handleOpenBuyForTicker}
                />
              </div>
            ) : exploreSubView === 'map' ? (
              <div className="animate-in fade-in duration-150">
                <RealEstateMap
                  positions={positions}
                  initialTickerFilter={exploreTickerFilter}
                  onClearTickerFilter={() => setExploreTickerFilter(null)}
                  onOpenBuyModal={handleOpenBuyForTicker}
                />
              </div>
            ) : exploreSubView === 'ai' ? (
              <div className="animate-in fade-in duration-150">
                <AiInsightsTab
                  positions={positions}
                  fixedIncomeAssets={fixedIncomeAssets}
                  bcbIndicators={bcbIndicators}
                  initialTickerFilter={exploreTickerFilter}
                  onClearTickerFilter={() => setExploreTickerFilter(null)}
                  onOpenBuyModal={handleOpenBuyForTicker}
                />
              </div>
            ) : (
              <div className="animate-in fade-in duration-150">
                <MentorsTab
                  quotes={quotes}
                  positions={positions}
                  monthlyTarget={goals.monthlyTarget}
                  isPrivacyMode={isPrivacyMode}
                  onOpenBuyModal={handleOpenBuyForTicker}
                />
              </div>
            )}
          </div>
        )}

        {/* 4. ABA: TROFÉUS & METAS (PLATINA 20 METAS + BOLA DE NEVE + SIMULADOR) */}
        {activeTab === 'goals' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Seletor Segmentado XP: Platina (20) vs Bola de Neve vs Simulador */}
            <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#1c1c1e] border border-white/[0.04] gap-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setGoalsSubView('achievements');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
                  goalsSubView === 'achievements'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span className="truncate">Platina (20)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setGoalsSubView('targets');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
                  goalsSubView === 'targets'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span className="truncate">Bola de Neve</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setGoalsSubView('simulator');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
                  goalsSubView === 'simulator'
                    ? 'bg-[#2b2512] text-[#f5b800] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#f5b800] shrink-0" />
                <span className="truncate">Simulador</span>
              </button>
            </div>

            {goalsSubView === 'achievements' && (
              <div className="animate-in fade-in duration-150">
                <AchievementsTimeline
                  positions={positions}
                  transactions={transactions}
                  summary={{
                    totalInvested: summary.totalInvested,
                    currentEquity: summary.currentEquity,
                    totalMonthlyDividends: summary.totalMonthlyDividends,
                  }}
                  onOpenB3Modal={() => setIsB3ModalOpen(true)}
                />
              </div>
            )}

            {goalsSubView === 'targets' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <GoalsCard
                  monthlyTarget={goals.monthlyTarget}
                  currentMonthInvested={summary.currentMonthInvested}
                  monthlyGoalProgressPercent={summary.monthlyGoalProgressPercent}
                  milestoneEquityTarget={goals.milestoneEquityTarget}
                  currentEquity={summary.currentEquity}
                  equityGoalProgressPercent={summary.equityGoalProgressPercent}
                  monthlyIncomeTarget={goals.monthlyIncomeTarget}
                  totalMonthlyDividends={summary.totalMonthlyDividends}
                  incomeGoalProgressPercent={summary.incomeGoalProgressPercent}
                  onOpenSettings={() => setIsSettingsModalOpen(true)}
                />

                <MagicNumberCard
                  positions={positions}
                  monthlyTarget={goals.monthlyTarget}
                />
              </div>
            )}

            {goalsSubView === 'simulator' && (
              <div className="animate-in fade-in duration-150">
                <InvestmentSimulator
                  currentEquity={summary.currentEquity}
                  monthlyTarget={goals.monthlyTarget}
                  averageYieldPercent={summary.averageYieldOnCostPercent}
                  bcbIndicators={bcbIndicators}
                  isPrivacyMode={isPrivacyMode}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* DOCK FLUTUANTE ESTILO XP iOS (Apenas 4 Abas Limpas) */}
      <nav className="fixed bottom-safe-dock inset-x-0 z-30 px-6 pointer-events-none">
        <div className="max-w-xs mx-auto pointer-events-auto rounded-full bg-[#1c1c1e]/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.75)] p-1.5 grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveTab(item.id);
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded-full transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'bg-white/[0.1] text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon
                  className={`w-4 h-4 mb-0.5 transition-colors ${
                    isActive ? 'text-[#f5b800]' : ''
                  }`}
                />
                <span
                  className={`text-[10px] leading-none tracking-tight ${
                    isActive ? 'font-bold text-white' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modais */}
      <AddTransactionModal
        key={isAddTxModalOpen ? `tx-${editingTx?.id || addTxTicker || 'new'}` : 'tx-closed'}
        isOpen={isAddTxModalOpen}
        initialTicker={addTxTicker}
        editingTransaction={editingTx}
        monthlyTarget={goals.monthlyTarget}
        currentMonthInvested={summary.currentMonthInvested}
        onClose={() => {
          setIsAddTxModalOpen(false);
          setAddTxTicker('');
          setEditingTx(null);
        }}
        onAddTransaction={addTransaction}
        onUpdateTransaction={updateTransaction}
      />

      <B3ImportModal
        isOpen={isB3ModalOpen}
        existingTransactions={transactions}
        onClose={() => setIsB3ModalOpen(false)}
        onImportTransactions={importTransactionsFromB3}
      />

      <MonthlyWrappedModal
        isOpen={isWrappedModalOpen}
        onClose={() => setIsWrappedModalOpen(false)}
        positions={positions}
        transactions={transactions}
        monthlyTarget={goals.monthlyTarget}
        isPrivacyMode={isPrivacyMode}
      />

      <AddFixedIncomeModal
        key={isFixedIncomeModalOpen ? `fi-${editingFixedIncomeAsset?.id || 'new'}` : 'fi-closed'}
        isOpen={isFixedIncomeModalOpen}
        onClose={() => {
          setIsFixedIncomeModalOpen(false);
          setEditingFixedIncomeAsset(null);
        }}
        onSave={addFixedIncomeAsset}
        onUpdate={updateFixedIncomeAsset}
        onDelete={deleteFixedIncomeAsset}
        editingAsset={editingFixedIncomeAsset}
      />

      <SettingsModal
        key={isSettingsModalOpen ? 'settings-open' : 'settings-closed'}
        isOpen={isSettingsModalOpen}
        goals={goals}
        positions={positions}
        quotes={quotes}
        isCloudConnected={isCloudConnected}
        isSyncingCloud={isSyncing}
        onClose={() => setIsSettingsModalOpen(false)}
        onUpdateGoals={updateGoals}
        onExportBackup={exportBackup}
        onImportBackup={importBackup}
        onResetDemo={resetDemo}
        onClearAll={clearAllTransactions}
        onSyncCloud={syncWithCloud}
      />

      <AccountSwitcherModal
        isOpen={isAccountSwitcherOpen}
        onClose={() => setIsAccountSwitcherOpen(false)}
        onAccountChanged={() => {
          syncWithCloud();
        }}
      />
    </div>
  );
}
