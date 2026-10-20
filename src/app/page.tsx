'use client';
import dynamic from 'next/dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AssetDetailsSheet } from '../components/AssetDetailsSheet';
import { Button, SegmentedControl } from '../components/ui/Controls';
import { FeedbackToast, PortfolioSkeleton, SectionSkeleton, type Notice } from '../components/ui/Feedback';
import { usePortfolio } from '../hooks/usePortfolio';
import { Header } from '../components/Header';
import { OverviewDashboard } from '../components/OverviewDashboard';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { GoalsCard } from '../components/GoalsCard';
import { MagicNumberCard } from '../components/MagicNumberCard';
import { PositionList } from '../components/PositionList';
import { TransactionHistory } from '../components/TransactionHistory';
const InvestmentSimulator = dynamic(() => import('../components/InvestmentSimulator').then(m => m.InvestmentSimulator), { loading: () => <SectionSkeleton chart label="Carregando simulador" /> });
import { OpportunityRadar } from '../components/OpportunityRadar';
import { UniversalB3Explorer } from '../components/UniversalB3Explorer';
import { MentorsTab } from '../components/MentorsTab';
const RealEstateMap = dynamic(() => import('../components/RealEstateMap').then(m => m.RealEstateMap), { loading: () => <SectionSkeleton chart label="Carregando mapa de imóveis" /> });
const AiInsightsTab = dynamic(() => import('../components/AiInsightsTab').then(m => m.AiInsightsTab), { loading: () => <SectionSkeleton label="Carregando análises" /> });
import { DividendFlow } from '../components/DividendFlow';
import { AchievementsTimeline } from '../components/AchievementsTimeline';
const MonthlyWrappedModal = dynamic(() => import('../components/MonthlyWrappedModal').then(m => m.MonthlyWrappedModal));
const SettingsModal = dynamic(() => import('../components/SettingsModal').then(m => m.SettingsModal));
const B3ImportModal = dynamic(() => import('../components/B3ImportModal').then(m => m.B3ImportModal));
import { IosInstallBanner } from '../components/IosInstallBanner';
const AddFixedIncomeModal = dynamic(() => import('../components/AddFixedIncomeModal').then(m => m.AddFixedIncomeModal));
const AddTransactionModal = dynamic(() => import('../components/AddTransactionModal').then(m => m.AddTransactionModal));
import { FixedIncomeList } from '../components/FixedIncomeList';
import { FixedIncomeAsset, Transaction } from '../types/portfolio';
const AccountSwitcherModal = dynamic(() => import('../components/AccountSwitcherModal').then(m => m.AccountSwitcherModal));
import {
  initAuthVaultListener,
  getActiveAccount,
  subscribeAuthAccounts,
  SavedAccountSession,
} from '../lib/authManager';
import { calculateMonthlyWrapped } from '../lib/monthlyWrapped';
import { triggerHaptic } from '../lib/haptic';
import {
  parsePushNavigationUrl,
  type PushAlertEventType,
} from '../lib/pushNavigation';
import {
  Wallet,
  LayoutDashboard,
  Menu,
  ArrowUpRight,
  Settings,
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

type MainTabType = 'overview' | 'portfolio' | 'proventos' | 'radar' | 'goals' | 'more';
type PageFeedback = { id: number; kind: 'refresh' | 'sync' } | { id: number; kind: 'message'; message: string; tone: Notice['tone'] };

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
    pendingChanges,
    pendingFixedIncomeChanges,
    corruptQueueCount,
    syncError,
    exportCorruptQueue,
    undoLastImport,
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
    if (typeof window === 'undefined') return 'overview';
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
    if (raw === 'portfolio' || raw === 'history' || raw === 'fixed_income' || raw === 'caixinhas') return 'portfolio';
    if (raw === 'more') return 'more';
    return 'overview';
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
  const [goalsSubView, setGoalsSubView] = useState<'achievements' | 'targets' | 'simulator'>(() => {
    if (typeof window === 'undefined') return 'achievements';
    const view = new URLSearchParams(window.location.search).get('view');
    return view === 'targets' || view === 'simulator' ? view : 'achievements';
  });

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState<boolean>(false);
  const [isB3ModalOpen, setIsB3ModalOpen] = useState<boolean>(false);
  const [isWrappedModalOpen, setIsWrappedModalOpen] = useState<boolean>(false);
  const [isFixedIncomeModalOpen, setIsFixedIncomeModalOpen] = useState<boolean>(false);
  const [editingFixedIncomeAsset, setEditingFixedIncomeAsset] = useState<FixedIncomeAsset | null>(null);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState<boolean>(false);
  const [addTxTicker, setAddTxTicker] = useState<string>('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedAssetTicker, setSelectedAssetTicker] = useState<string | null>(null);
  const [selectedAssetSection, setSelectedAssetSection] = useState<
    'summary' | 'dividends' | 'indicators'
  >('summary');
  const [focusedProventoFilter, setFocusedProventoFilter] = useState<{
    ticker: string | null;
    date: string | null;
    eventType: PushAlertEventType | null;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    const parsed = parsePushNavigationUrl(window.location.href, window.location.origin);
    if (!parsed || (!parsed.ticker && !parsed.date && !parsed.eventType)) return null;
    return {
      ticker: parsed.ticker,
      date: parsed.date,
      eventType: parsed.eventType,
    };
  });
  const [feedback, setFeedback] = useState<PageFeedback | null>(null);
  const dismissFeedback = useCallback(() => setFeedback(null), []);

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

  const navigateFromTabParam = useCallback((rawTab: string | null, rawView?: string | null) => {
    if (!rawTab || rawTab === 'overview') { setActiveTab('overview'); return; }
    if (rawTab === 'more') { setActiveTab('more'); return; }
    if (rawTab === 'fixed_income' || rawTab === 'caixinhas') { setActiveTab('portfolio'); setHomeSubView('fixed_income'); return; }
    if (rawTab === 'map' || rawTab === 'ai' || rawTab === 'universal') { setActiveTab('radar'); setExploreSubView(rawTab); return; }
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
      setGoalsSubView(rawView === 'targets' || rawView === 'simulator' ? rawView : 'achievements');
    }
  }, []);

  useEffect(() => {
    const onPop = () => { const params = new URLSearchParams(window.location.search); navigateFromTabParam(params.get('tab'), params.get('view')); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [navigateFromTabParam]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const tab = activeTab === 'portfolio' ? (homeSubView === 'assets' ? 'portfolio' : homeSubView)
      : activeTab === 'radar' ? exploreSubView : activeTab;
    url.searchParams.set('tab', tab);
    if (activeTab === 'goals') url.searchParams.set('view', goalsSubView); else url.searchParams.delete('view');
    if (window.location.href !== url.href) window.history.pushState(null, '', url);
  }, [activeTab, homeSubView, exploreSubView, goalsSubView]);

  // Garante que a página inicie no topo ao carregar
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [isInitialized]);

  // Escuta clique em notificações Web Push (navega para Proventos e foca no ativo/evento correspondente)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_FROM_PUSH' && typeof event.data.url === 'string') {
        try {
          const parsed = parsePushNavigationUrl(event.data.url, window.location.origin);
          if (parsed) {
            navigateFromTabParam(parsed.tab);
            if (parsed.ticker || parsed.date || parsed.eventType) {
              setFocusedProventoFilter({
                ticker: parsed.ticker,
                date: parsed.date,
                eventType: parsed.eventType,
              });
            }
            if (event.data.url.startsWith('/') && !event.data.url.startsWith('//')) {
              window.history.replaceState(null, '', event.data.url);
            }
          } else {
            const url = new URL(event.data.url, window.location.origin);
            navigateFromTabParam(url.searchParams.get('tab'));
          }
        } catch {
          // ignore
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigateFromTabParam]);

  if (!isInitialized) {
    return <PortfolioSkeleton />;
  }

  // 4 Abas Principais na Dock Flutuante (Estilo XP Investimentos)
  const navItems: { id: MainTabType; label: string; icon: typeof Wallet }[] = [
    { id: 'overview', label: 'Início', icon: LayoutDashboard },
    { id: 'portfolio', label: 'Carteira', icon: Wallet },
    { id: 'proventos', label: 'Proventos', icon: Coins },
    { id: 'radar', label: 'Radar', icon: Compass },
    { id: 'more', label: 'Mais', icon: Menu },
  ];

  const getTabTitle = (tab: MainTabType) => {
    switch (tab) {
      case 'overview': return 'Visão geral';
      case 'more': return 'Seu espaço';
      case 'portfolio':
        return 'Carteira';
      case 'proventos':
        return 'Proventos';
      case 'radar':
        return exploreSubView === 'radar' ? 'Radar' : exploreSubView === 'map' ? 'Imóveis' : exploreSubView === 'mentors' ? 'Mentores' : exploreSubView === 'ai' ? 'Análises' : 'Busca B3';
      case 'goals':
        return goalsSubView === 'targets' ? 'Metas e conquistas' : goalsSubView === 'simulator' ? 'Simulador' : 'Conquistas';
      default:
        return 'Carteira';
    }
  };

  const handleOpenBuyForTicker = (ticker: string) => {
    setSelectedAssetTicker(null);
    setEditingTx(null);
    setAddTxTicker(ticker);
    setIsAddTxModalOpen(true);
  };

  const handleOpenAsset = (
    ticker: string,
    section: 'summary' | 'dividends' | 'indicators' = 'summary'
  ) => {
    setSelectedAssetSection(section);
    setSelectedAssetTicker(ticker);
  };
  const handleOpenRelated = (ticker: string, view: 'map' | 'ai') => {
    setSelectedAssetTicker(null);
    setExploreTickerFilter(ticker);
    setActiveTab('radar');
    setExploreSubView(view);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const feedbackNotice: Notice | null = !feedback ? null : feedback.kind === 'message'
    ? { id: feedback.id, message: feedback.message, tone: feedback.tone }
    : feedback.kind === 'sync'
    ? { id: feedback.id, busy: isSyncing, tone: corruptQueueCount || syncError || !isCloudConnected ? 'error' : pendingChanges ? 'info' : 'success', message: isSyncing ? 'Sincronizando sua conta…' : corruptQueueCount ? 'Sincronização pausada: há alterações pendentes ilegíveis neste dispositivo.' : syncError || (!isCloudConnected ? 'Nuvem indisponível. Dados locais preservados.' : pendingChanges ? 'Há alterações aguardando envio.' : 'Sua conta está sincronizada.') }
    : { id: feedback.id, busy: isLoadingQuotes, tone: lastSyncTime && lastSyncTime.getTime() >= feedback.id ? 'success' : 'info', message: isLoadingQuotes ? 'Consultando cotações…' : lastSyncTime && lastSyncTime.getTime() >= feedback.id ? 'Cotações atualizadas.' : 'Sem novas cotações. As últimas referências foram mantidas.' };

  return (
    <div className="app-shell min-h-[100dvh] text-zinc-100 flex flex-col antialiased selection:bg-[#f5b800] selection:text-zinc-950">
      <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
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
          setFeedback({ id: Date.now(), kind: 'refresh' });
          await Promise.all([fetchLiveQuotes(), syncWithCloud()]);
        }}
        onSyncCloud={async () => {
          if (!activeAccount) { setIsAccountSwitcherOpen(true); return; }
          triggerHaptic('light');
          setFeedback({ id: Date.now(), kind: 'sync' });
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

      {/* Área principal */}
      <main id="main-content" tabIndex={-1} className="app-content flex-1 w-full space-y-6">
        {corruptQueueCount > 0 ? (
          <div role="alert" className="rounded-2xl border border-amber-300/40 bg-[#1b1710] p-4 text-sm leading-relaxed text-amber-50">
            <p className="font-semibold">Sincronização pausada neste dispositivo</p>
            <p className="mt-1 text-amber-100/80">
              {corruptQueueCount} {corruptQueueCount === 1 ? 'alteração pendente está ilegível' : 'alterações pendentes estão ilegíveis'}. Os registros locais foram preservados. Não limpe os dados deste navegador enquanto recupera a fila.
            </p>
            <button
              type="button"
              className="mt-3 min-h-11 rounded-lg border border-amber-200/40 px-3 py-2 font-medium text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              onClick={exportCorruptQueue}
            >
              Baixar diagnóstico
            </button>
            <p className="mt-2 text-xs text-amber-100/70">O arquivo pode conter dados da sua conta. Guarde-o em local privado para análise e recuperação.</p>
          </div>
        ) : (pendingChanges > 0 || syncError) && !(activeTab === 'portfolio' && homeSubView === 'fixed_income' && pendingChanges === pendingFixedIncomeChanges && !syncError) && <div role="status" className="rounded-2xl border border-amber-200/15 bg-[#121215] p-4 text-xs leading-relaxed text-zinc-300">
          {pendingChanges > 0 ? `${pendingChanges} alteração(ões) aguardando envio. ` : ''}{syncError}
          <button className="underline ml-2" onClick={() => syncWithCloud()}>Tentar sincronizar</button>
        </div>}
        <IosInstallBanner />

        {activeTab === 'overview' && <OverviewDashboard positions={positions} transactions={transactions} summary={unifiedSummary} privateMode={isPrivacyMode}
          onPortfolio={() => { setActiveTab('portfolio'); setHomeSubView('assets'); }}
          onDividends={() => setActiveTab('proventos')} onImport={() => setIsB3ModalOpen(true)}
          onAdd={() => { setEditingTx(null); setAddTxTicker(''); setIsAddTxModalOpen(true); }} onAsset={handleOpenAsset} />}
        {activeTab === 'more' && <section aria-label="Ferramentas e preferências" className="space-y-6">
          <div><p className="eyebrow">Tudo em um lugar</p><h2 className="text-2xl font-semibold mt-2">Ferramentas para sua jornada</h2><p className="ui-caption mt-2">Acompanhe seus registros, explore ativos e planeje seus próximos passos.</p></div>
          <div className="tool-grid">{[
            { label: 'Extrato', description: 'Compras, vendas e recebimentos', icon: ReceiptText, action: () => { setActiveTab('portfolio'); setHomeSubView('history'); } },
            { label: 'Renda fixa', description: 'Aplicações, taxas e vencimentos', icon: PiggyBank, action: () => { setActiveTab('portfolio'); setHomeSubView('fixed_income'); } },
            { label: 'Imóveis', description: 'Conheça os imóveis dos fundos', icon: MapPin, action: () => { setActiveTab('radar'); setExploreSubView('map'); } },
            { label: 'Mentores', description: 'Compare critérios de investimento', icon: GraduationCap, action: () => { setActiveTab('radar'); setExploreSubView('mentors'); } },
            { label: 'Metas e conquistas', description: 'Acompanhe seu progresso', icon: Target, action: () => { setActiveTab('goals'); setGoalsSubView('targets'); } },
            { label: 'Simulador', description: 'Explore cenários futuros', icon: Sparkles, action: () => { setActiveTab('goals'); setGoalsSubView('simulator'); } },
            { label: 'Configurações e alertas', description: 'Notificações, preferências e backups', icon: Settings, action: () => setIsSettingsModalOpen(true) },
          ].map(item => <button key={item.label} onClick={item.action} className="tool-card"><item.icon className="h-5 w-5 text-amber-200" /><span className="flex-1"><span className="block font-semibold">{item.label}</span><span className="ui-caption block mt-1">{item.description}</span></span><ArrowUpRight className="h-4 w-4 text-zinc-500" /></button>)}</div>
        </section>}

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

            <SegmentedControl label="Conteúdo da carteira" value={homeSubView} onChange={(value) => { triggerHaptic('selection'); setHomeSubView(value); }} options={[
              { value: 'assets', label: 'Bolsa', icon: <Layers /> },
              { value: 'fixed_income', label: 'Renda fixa', icon: <PiggyBank /> },
              { value: 'history', label: 'Extrato', icon: <ReceiptText /> },
            ]} />

            {homeSubView === 'assets' ? (
              <div className="space-y-3 animate-in fade-in duration-150">
                <PositionList
                  positions={positions}
                  onOpenAsset={handleOpenAsset}
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
                  pendingSyncCount={corruptQueueCount > 0 ? 0 : pendingFixedIncomeChanges}
                  isSyncing={isSyncing}
                  onRetrySync={() => { void syncWithCloud(); }}
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
              onOpenB3Modal={() => setIsB3ModalOpen(true)}
              onOpenAsset={(ticker) => handleOpenAsset(ticker, 'dividends')}
              positions={positions}
              transactions={transactions}
              bcbIndicators={bcbIndicators}
              monthlyContributionGoal={goals.monthlyTarget}
              isPrivacyMode={isPrivacyMode}
              focusedTicker={focusedProventoFilter?.ticker ?? null}
              focusedDate={focusedProventoFilter?.date ?? null}
              focusedEventType={focusedProventoFilter?.eventType ?? null}
              onClearFocus={() => {
                setFocusedProventoFilter(null);
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', '/?tab=proventos');
                }
              }}
            />
          </div>
        )}

        {/* 3. ABA: EXPLORAR (RADAR B3 + BUSCA UNIVERSAL + MAPA IMOBILIÁRIO + IA & FATOS + MENTORES) */}
        {activeTab === 'radar' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <SegmentedControl label="Explorar investimentos" value={exploreSubView} onChange={(value) => { triggerHaptic('selection'); setExploreSubView(value); }} scrollable options={[
              { value: 'radar', label: 'Radar', icon: <Compass /> }, { value: 'universal', label: 'Busca B3', icon: <Globe /> },
              { value: 'map', label: 'Mapa', icon: <MapPin /> }, { value: 'ai', label: 'Análises', icon: <Sparkles /> },
              { value: 'mentors', label: 'Mentores', icon: <GraduationCap /> },
            ]} />

            {exploreSubView === 'radar' ? (
              <div className="animate-in fade-in duration-150">
                <OpportunityRadar
                  onOpenAsset={handleOpenAsset}
                  isLoading={isLoadingQuotes && Object.keys(quotes).length === 0}
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
                  onOpenAsset={handleOpenAsset}
                  isLoading={isLoadingQuotes && Object.keys(quotes).length === 0}
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
            <SegmentedControl label="Conquistas e metas" value={goalsSubView} onChange={(value) => { triggerHaptic('selection'); setGoalsSubView(value); }} options={[
              { value: 'achievements', label: 'Troféus', icon: <Trophy /> }, { value: 'targets', label: 'Metas', icon: <Target /> },
              { value: 'simulator', label: 'Simulador', icon: <Sparkles /> },
            ]} />

            {goalsSubView === 'achievements' && (
              <div className="animate-in fade-in duration-150">
                <AchievementsTimeline
                  isPrivacyMode={isPrivacyMode}
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
                  isPrivacyMode={isPrivacyMode}
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
        <details className="ui-label border-t border-white/[0.06] pt-3"><summary>Dados e recuperação</summary>
          <p className="py-3 leading-relaxed">Cotações recebidas: {Object.keys(quotes).length}. Última consulta: {lastSyncTime?.toLocaleString('pt-BR') || 'Não disponível'}. Fundamentos do catálogo são referências sem atualização automática. Projeções não comprovam recebimentos.</p>
          <Button variant="ghost" onClick={async () => { const ok = await undoLastImport(); setFeedback({ id: Date.now(), kind: 'message', tone: ok ? 'success' : 'info', message: ok ? 'Importação desfeita. Sua carteira foi restaurada.' : 'Não há importação disponível para desfazer.' }); }}>Desfazer última importação</Button>
        </details>
      </main>

      {/* Navegação principal responsiva */}
      <nav className="app-navigation" aria-label="Navegação principal">
        <div className="sidebar-brand"><span className="brand-mark">F</span><span>FII Tracker<small>Seu patrimônio, com clareza</small></span></div>
        <div className="app-navigation__items">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'more' && activeTab === 'goals');
            return (
              <button
                key={item.id}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveTab(item.id);
                  if (item.id === 'portfolio') setHomeSubView('assets');
                  if (item.id === 'radar') setExploreSubView('radar');
                  window.scrollTo({ top: 0, behavior: isActive && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
                }}
                aria-label={item.label}
                className={`dock-tab flex flex-col items-center justify-center py-1.5 rounded-full transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'bg-white/[0.1] text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <Icon
                  className={`w-5 h-5 mb-1 transition-colors ${
                    isActive ? 'text-white' : ''
                  }`}
                />
                <span
                  className={`text-[11px] leading-none tracking-tight ${
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

      <FeedbackToast notice={feedbackNotice} onClose={dismissFeedback} />
      {selectedAssetTicker && <AssetDetailsSheet
        key={`${activeAccount?.id ?? 'local'}-${selectedAssetTicker}-${selectedAssetSection}`}
        ticker={selectedAssetTicker}
        initialSection={selectedAssetSection}
        positions={positions}
        quotes={quotes}
        transactions={transactions}
        isPrivacyMode={isPrivacyMode}
        onClose={() => setSelectedAssetTicker(null)}
        onOpenBuyModal={handleOpenBuyForTicker}
        onUpdateDividend={updateCustomDividend}
        onOpenMapForTicker={(ticker) => handleOpenRelated(ticker, 'map')}
        onOpenAiForTicker={(ticker) => handleOpenRelated(ticker, 'ai')}
      />}

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
        onImportTransactions={async (newTransactions, replaceAll) => {
          await importTransactionsFromB3(newTransactions, replaceAll);
          setFeedback({ id: Date.now(), kind: 'message', tone: 'success', message: 'Extrato importado. Carteira atualizada neste dispositivo.' });
        }}
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
        pendingChanges={pendingChanges}
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
