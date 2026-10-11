'use client';

import { useState, useEffect } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { Header } from '../components/Header';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { AllocationCard } from '../components/AllocationCard';
import { GoalsCard } from '../components/GoalsCard';
import { MagicNumberCard } from '../components/MagicNumberCard';
import { PositionList } from '../components/PositionList';
import { TransactionHistory } from '../components/TransactionHistory';
import { InvestmentSimulator } from '../components/InvestmentSimulator';
import { OpportunityRadar } from '../components/OpportunityRadar';
import { MentorsTab } from '../components/MentorsTab';
import { DividendFlow } from '../components/DividendFlow';
import { AchievementsTimeline } from '../components/AchievementsTimeline';
import { SettingsModal } from '../components/SettingsModal';
import { B3ImportModal } from '../components/B3ImportModal';
import { IosInstallBanner } from '../components/IosInstallBanner';
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
} from 'lucide-react';

type MainTabType = 'portfolio' | 'proventos' | 'radar' | 'goals';

export default function HomePage() {
  const {
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
    deleteTransaction,
    clearAllTransactions,
    resetDemo,
    updateGoals,
    updateCustomDividend,
    fetchLiveQuotes,
    exportBackup,
    importBackup,
    importTransactionsFromB3,
  } = usePortfolio();

  const [activeTab, setActiveTab] = useState<MainTabType>(() => {
    if (typeof window === 'undefined') return 'portfolio';
    const raw = new URLSearchParams(window.location.search).get('tab');
    if (raw === 'proventos') return 'proventos';
    if (raw === 'radar' || raw === 'mentors') return 'radar';
    if (raw === 'goals' || raw === 'achievements') return 'goals';
    return 'portfolio';
  });
  // Sub-seções estilo Apple iOS Segmented Control para evitar poluição visual
  const [homeSubView, setHomeSubView] = useState<'assets' | 'history'>(() => {
    if (typeof window === 'undefined') return 'assets';
    return new URLSearchParams(window.location.search).get('tab') === 'history'
      ? 'history'
      : 'assets';
  });
  const [exploreSubView, setExploreSubView] = useState<'radar' | 'mentors'>(() => {
    if (typeof window === 'undefined') return 'radar';
    return new URLSearchParams(window.location.search).get('tab') === 'mentors'
      ? 'mentors'
      : 'radar';
  });
  const [goalsSubView, setGoalsSubView] = useState<'achievements' | 'targets' | 'simulator'>(
    'achievements'
  );

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isB3ModalOpen, setIsB3ModalOpen] = useState<boolean>(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('fii_tracker_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleTogglePrivacy = () => {
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
      <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center animate-pulse mb-3">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-400" />
        </div>
        <p className="text-xs font-medium text-zinc-400">Carregando FII Tracker...</p>
      </div>
    );
  }

  // Apenas 4 Abas Principais na Dock Flutuante (Estilo Apple / Nubank)
  const navItems: { id: MainTabType; label: string; icon: typeof Wallet }[] = [
    { id: 'portfolio', label: 'Início', icon: Wallet },
    { id: 'proventos', label: 'Proventos', icon: Coins },
    { id: 'radar', label: 'Explorar', icon: Compass },
    { id: 'goals', label: 'Troféus', icon: Trophy },
  ];

  return (
    <div className="min-h-[100dvh] bg-black text-zinc-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-zinc-950">
      {/* Header Minimalista */}
      <Header
        lastSyncTime={lastSyncTime}
        isLoadingQuotes={isLoadingQuotes}
        isCloudConnected={isCloudConnected}
        isSyncingCloud={isSyncing}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={handleTogglePrivacy}
        onRefresh={fetchLiveQuotes}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Conteúdo Principal com Respiro Estilo iOS */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 pb-28 space-y-4">
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
              isPrivacyMode={isPrivacyMode}
              onNavigateToProventos={() => setActiveTab('proventos')}
              onNavigateToGoals={() => {
                setActiveTab('goals');
                setGoalsSubView('achievements');
              }}
              onOpenExtrato={() =>
                setHomeSubView((prev) => (prev === 'history' ? 'assets' : 'history'))
              }
              onOpenB3Modal={() => setIsB3ModalOpen(true)}
            />

            {/* Seletor Segmentado iOS: Meus Ativos vs Extrato */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#121215] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setHomeSubView('assets')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  homeSubView === 'assets'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Meus Ativos ({positions.length})
              </button>

              <button
                type="button"
                onClick={() => setHomeSubView('history')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  homeSubView === 'history'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <ReceiptText className="w-3.5 h-3.5 text-emerald-400" />
                Extrato B3 ({transactions.length})
              </button>
            </div>

            {homeSubView === 'assets' ? (
              <div className="space-y-3 animate-in fade-in duration-150">
                <AllocationCard
                  positions={positions}
                  onNavigateToRadar={() => {
                    setActiveTab('radar');
                    setExploreSubView('radar');
                  }}
                />

                <PositionList
                  positions={positions}
                  isPrivacyMode={isPrivacyMode}
                  onUpdateDividend={updateCustomDividend}
                  onOpenB3Modal={() => setIsB3ModalOpen(true)}
                />
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-150">
                <TransactionHistory
                  transactions={transactions}
                  monthlyTarget={goals.monthlyTarget}
                  isPrivacyMode={isPrivacyMode}
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

        {/* 3. ABA: EXPLORAR (RADAR B3 + MENTORES UNIFICADOS) */}
        {activeTab === 'radar' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Seletor Segmentado iOS: Radar B3 vs Mentores */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#121215] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setExploreSubView('radar')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  exploreSubView === 'radar'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                Radar de Oportunidades
              </button>

              <button
                type="button"
                onClick={() => setExploreSubView('mentors')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  exploreSubView === 'mentors'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                Mentores (Barsi & Cia)
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
                  isPrivacyMode={isPrivacyMode}
                  onOpenB3Modal={() => setIsB3ModalOpen(true)}
                />
              </div>
            ) : (
              <div className="animate-in fade-in duration-150">
                <MentorsTab
                  quotes={quotes}
                  positions={positions}
                  monthlyTarget={goals.monthlyTarget}
                  isPrivacyMode={isPrivacyMode}
                />
              </div>
            )}
          </div>
        )}

        {/* 4. ABA: TROFÉUS & METAS (PLATINA 20 METAS + BOLA DE NEVE + SIMULADOR) */}
        {activeTab === 'goals' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Seletor Segmentado iOS: Conquistas (20) vs Bola de Neve vs Simulador */}
            <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#121215] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setGoalsSubView('achievements')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  goalsSubView === 'achievements'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-cyan-400" />
                Platina (20)
              </button>

              <button
                type="button"
                onClick={() => setGoalsSubView('targets')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  goalsSubView === 'targets'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                Bola de Neve
              </button>

              <button
                type="button"
                onClick={() => setGoalsSubView('simulator')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  goalsSubView === 'simulator'
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Simulador
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
                  isPrivacyMode={isPrivacyMode}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* DOCK FLUTUANTE ESTILO APPLE iOS / NUBANK (Apenas 4 Abas Limpas) */}
      <nav className="fixed bottom-4 inset-x-0 z-30 px-6 pb-safe pointer-events-none">
        <div className="max-w-xs mx-auto pointer-events-auto rounded-full bg-[#16161a]/90 backdrop-blur-2xl border border-white/[0.09] shadow-[0_12px_40px_rgba(0,0,0,0.75)] p-1.5 grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-white/[0.11] text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon
                  className={`w-4 h-4 mb-0.5 transition-colors ${
                    isActive ? 'text-emerald-400' : ''
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
      <B3ImportModal
        isOpen={isB3ModalOpen}
        existingTransactions={transactions}
        onClose={() => setIsB3ModalOpen(false)}
        onImportTransactions={importTransactionsFromB3}
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
    </div>
  );
}
