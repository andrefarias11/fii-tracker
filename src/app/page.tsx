'use client';

import { useState, useEffect } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { Transaction } from '../types/portfolio';
import { Header } from '../components/Header';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { AllocationCard } from '../components/AllocationCard';
import { GoalsCard } from '../components/GoalsCard';
import { MagicNumberCard } from '../components/MagicNumberCard';
import { PositionList } from '../components/PositionList';
import { TransactionHistory } from '../components/TransactionHistory';
import { InvestmentSimulator } from '../components/InvestmentSimulator';
import { OpportunityRadar } from '../components/OpportunityRadar';
import { DividendFlow } from '../components/DividendFlow';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { SettingsModal } from '../components/SettingsModal';
import { B3ImportModal } from '../components/B3ImportModal';
import { IosInstallBanner } from '../components/IosInstallBanner';
import {
  PieChart,
  Target,
  History,
  Plus,
  FileSpreadsheet,
  Compass,
  Coins,
} from 'lucide-react';

type TabType = 'portfolio' | 'proventos' | 'radar' | 'goals' | 'history';

export default function HomePage() {
  const {
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
    importTransactionsFromB3,
  } = usePortfolio();

  const [activeTab, setActiveTab] = useState<TabType>('portfolio');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isB3ModalOpen, setIsB3ModalOpen] = useState<boolean>(false);
  const [targetTickerForAdd, setTargetTickerForAdd] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
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

  const handleOpenAddModal = (ticker = '') => {
    setEditingTransaction(null);
    setTargetTickerForAdd(ticker);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setTargetTickerForAdd('');
    setEditingTransaction(tx);
    setIsAddModalOpen(true);
  };

  // Garante que a página inicie sempre no topo absoluto ao carregar no iOS Safari / PWA
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [isInitialized]);

  if (!isInitialized) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center animate-pulse mb-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500" />
        </div>
        <p className="text-sm font-semibold text-zinc-300">Carregando carteira de FIIs...</p>
      </div>
    );
  }

  const navItems: { id: TabType; label: string; icon: typeof PieChart }[] = [
    { id: 'portfolio', label: 'Carteira', icon: PieChart },
    { id: 'proventos', label: 'Proventos', icon: Coins },
    { id: 'radar', label: 'Radar', icon: Compass },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'history', label: 'Extrato', icon: History },
  ];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-zinc-950">
      {/* Header com Modo Privacidade, Atualizar e Configurações */}
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

      {/* Conteúdo Principal (Mobile First) */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 pb-32 space-y-4">
        <IosInstallBanner />

        {/* Aba: Carteira */}
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
              isPrivacyMode={isPrivacyMode}
              onNavigateToProventos={() => setActiveTab('proventos')}
              onNavigateToGoals={() => setActiveTab('goals')}
            />

            {/* Barra enxuta de Diversificação por Setor */}
            <AllocationCard
              positions={positions}
              onNavigateToRadar={() => setActiveTab('radar')}
            />

            <PositionList
              positions={positions}
              isPrivacyMode={isPrivacyMode}
              onOpenAddModalWithTicker={handleOpenAddModal}
              onUpdateDividend={updateCustomDividend}
              onOpenB3Modal={() => setIsB3ModalOpen(true)}
            />
          </div>
        )}

        {/* Aba: Proventos & Calendário de Dividendos */}
        {activeTab === 'proventos' && (
          <div className="animate-in fade-in duration-200">
            <DividendFlow
              positions={positions}
              monthlyContributionGoal={goals.monthlyTarget}
              isPrivacyMode={isPrivacyMode}
            />
          </div>
        )}

        {/* Aba: Radar de Oportunidades & Alocação */}
        {activeTab === 'radar' && (
          <div className="animate-in fade-in duration-200">
            <OpportunityRadar
              quotes={quotes}
              positions={positions}
              monthlyTarget={goals.monthlyTarget}
              currentMonthInvested={summary.currentMonthInvested}
              totalMonthlyDividends={summary.totalMonthlyDividends}
              onOpenAddModalWithTicker={handleOpenAddModal}
              onImportTransactions={importTransactionsFromB3}
            />
          </div>
        )}

        {/* Aba: Metas & Bola de Neve */}
        {activeTab === 'goals' && (
          <div className="space-y-4 animate-in fade-in duration-200">
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
              onOpenAddModalWithTicker={handleOpenAddModal}
            />

            {/* Simulador integrado na aba de metas */}
            <InvestmentSimulator />
          </div>
        )}

        {/* Aba: Histórico de Aportes */}
        {activeTab === 'history' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Total de compras: {transactions.length}</span>
              <button
                onClick={() => setIsB3ModalOpen(true)}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-sky-500/10 px-2.5 py-1 rounded-xl border border-sky-500/20 active:scale-95 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Importar Planilha B3
              </button>
            </div>
            <TransactionHistory
              transactions={transactions}
              isPrivacyMode={isPrivacyMode}
              onEditTransaction={handleOpenEditModal}
              onDeleteTransaction={deleteTransaction}
            />
          </div>
        )}
      </main>

      {/* Botão Flutuante (FAB) alinhado ao container max-w-md */}
      <div className="fixed bottom-20 inset-x-0 z-40 pointer-events-none">
        <div className="max-w-md mx-auto px-4 flex justify-end">
          <button
            onClick={() => handleOpenAddModal('')}
            className="pointer-events-auto flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-zinc-950 font-extrabold text-xs shadow-xl shadow-emerald-500/25 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Aporte</span>
          </button>
        </div>
      </div>

      {/* Barra de Navegação Inferior estilo iOS com Pílula Ativa (5 Abas) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-5 px-2 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all ${
                  isActive ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <div
                  className={`px-3 py-0.5 rounded-full transition-all mb-0.5 ${
                    isActive ? 'bg-emerald-500/15' : ''
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modais */}
      <AddTransactionModal
        key={editingTransaction?.id || targetTickerForAdd || (isAddModalOpen ? 'open' : 'closed')}
        isOpen={isAddModalOpen}
        initialTicker={targetTickerForAdd}
        editingTransaction={editingTransaction}
        monthlyTarget={goals.monthlyTarget}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
        }}
        onAddTransaction={addTransaction}
        onUpdateTransaction={updateTransaction}
      />

      <B3ImportModal
        isOpen={isB3ModalOpen}
        onClose={() => setIsB3ModalOpen(false)}
        onImportTransactions={importTransactionsFromB3}
      />

      <SettingsModal
        key={isSettingsModalOpen ? 'settings-open' : 'settings-closed'}
        isOpen={isSettingsModalOpen}
        goals={goals}
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

