'use client';

import { useState } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { Header } from '../components/Header';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { GoalsCard } from '../components/GoalsCard';
import { MagicNumberCard } from '../components/MagicNumberCard';
import { PositionList } from '../components/PositionList';
import { TransactionHistory } from '../components/TransactionHistory';
import { InvestmentSimulator } from '../components/InvestmentSimulator';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { SettingsModal } from '../components/SettingsModal';
import { IosInstallBanner } from '../components/IosInstallBanner';
import {
  PieChart,
  Target,
  History,
  Calculator,
  Plus,
} from 'lucide-react';

type TabType = 'portfolio' | 'goals' | 'history' | 'simulator';

export default function HomePage() {
  const {
    isInitialized,
    transactions,
    positions,
    summary,
    goals,
    isLoadingQuotes,
    lastSyncTime,
    isCloudConnected,
    isSyncing,
    syncWithCloud,
    addTransaction,
    deleteTransaction,
    clearAllTransactions,
    resetDemo,
    updateGoals,
    updateCustomDividend,
    fetchLiveQuotes,
    exportBackup,
    importBackup,
  } = usePortfolio();

  const [activeTab, setActiveTab] = useState<TabType>('portfolio');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [targetTickerForAdd, setTargetTickerForAdd] = useState<string>('');

  const handleOpenAddModal = (ticker = '') => {
    setTargetTickerForAdd(ticker);
    setIsAddModalOpen(true);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center animate-pulse mb-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500" />
        </div>
        <p className="text-sm font-semibold text-zinc-300">Carregando carteira de FIIs...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-zinc-950">
      {/* Header com Atualizar e Configurações */}
      <Header
        lastSyncTime={lastSyncTime}
        isLoadingQuotes={isLoadingQuotes}
        isCloudConnected={isCloudConnected}
        isSyncingCloud={isSyncing}
        onRefresh={fetchLiveQuotes}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Conteúdo Principal (Mobile First) */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 pb-28 space-y-4">
        <IosInstallBanner />

        {/* Aba: Carteira */}
        {activeTab === 'portfolio' && (
          <>
            <PortfolioSummary
              currentEquity={summary.currentEquity}
              totalInvested={summary.totalInvested}
              totalProfitLoss={summary.totalProfitLoss}
              totalProfitLossPercent={summary.totalProfitLossPercent}
              totalMonthlyDividends={summary.totalMonthlyDividends}
            />

            {/* Prévia da Meta Mensal (Atalho) */}
            <div
              onClick={() => setActiveTab('goals')}
              className="cursor-pointer rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 flex items-center justify-between hover:border-emerald-500/40 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    Meta deste mês: R$ {summary.currentMonthInvested.toFixed(2)} / R$ {goals.monthlyTarget.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {summary.monthlyGoalProgressPercent}% concluída • Toque para ver detalhes
                  </div>
                </div>
              </div>
              <div className="w-12 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, summary.monthlyGoalProgressPercent)}%` }}
                />
              </div>
            </div>

            <PositionList
              positions={positions}
              onOpenAddModalWithTicker={handleOpenAddModal}
              onUpdateDividend={updateCustomDividend}
            />
          </>
        )}

        {/* Aba: Metas & Bola de Neve */}
        {activeTab === 'goals' && (
          <div className="space-y-4">
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

            <MagicNumberCard positions={positions} />
          </div>
        )}

        {/* Aba: Histórico de Aportes */}
        {activeTab === 'history' && (
          <TransactionHistory
            transactions={transactions}
            onDeleteTransaction={deleteTransaction}
          />
        )}

        {/* Aba: Simulador de Juros Compostos */}
        {activeTab === 'simulator' && <InvestmentSimulator />}
      </main>

      {/* Botão Flutuante (FAB) para Adicionar Aporte */}
      <div className="fixed bottom-20 right-4 z-40 max-w-md mx-auto">
        <button
          onClick={() => handleOpenAddModal('')}
          className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-zinc-950 font-extrabold text-sm shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>Novo Aporte</span>
        </button>
      </div>

      {/* Barra de Navegação Inferior estilo iOS */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-800/80 pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-2">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'portfolio' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <PieChart className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Carteira</span>
          </button>

          <button
            onClick={() => setActiveTab('goals')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'goals' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Target className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Metas</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'simulator' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Calculator className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Simulador</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'history' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <History className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Extrato</span>
          </button>
        </div>
      </nav>

      {/* Modais */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        initialTicker={targetTickerForAdd}
        onClose={() => setIsAddModalOpen(false)}
        onAddTransaction={addTransaction}
      />

      <SettingsModal
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
