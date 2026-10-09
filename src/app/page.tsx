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

            {/* Ações Rápidas: Novo Aporte ou Importar da B3 */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleOpenAddModal('')}
                className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Novo Aporte</div>
                  <div className="text-[10px] text-zinc-400">Lançar manual</div>
                </div>
              </button>

              <button
                onClick={() => setIsB3ModalOpen(true)}
                className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-sky-500/40 flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Importar B3</div>
                  <div className="text-[10px] text-zinc-400">Extrato Excel</div>
                </div>
              </button>
            </div>

            {/* Banner de Atalho para Proventos & Radar */}
            <div className="grid grid-cols-2 gap-2.5">
              <div
                onClick={() => setActiveTab('proventos')}
                className="cursor-pointer rounded-2xl bg-gradient-to-br from-emerald-950/40 to-zinc-900 border border-emerald-500/25 p-3 flex flex-col justify-between hover:border-emerald-500/50 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Proventos</span>
                </div>
                <div className="text-sm font-extrabold text-emerald-300">
                  R$ {summary.totalMonthlyDividends.toFixed(2)}
                  <span className="text-[10px] text-zinc-400 font-normal"> /mês</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 mt-1">Ver calendário →</span>
              </div>

              <div
                onClick={() => setActiveTab('radar')}
                className="cursor-pointer rounded-2xl bg-gradient-to-br from-sky-950/40 to-zinc-900 border border-sky-500/25 p-3 flex flex-col justify-between hover:border-sky-500/50 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Compass className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">Radar FII</span>
                </div>
                <div className="text-xs font-bold text-zinc-200">
                  Onde comprar?
                </div>
                <span className="text-[10px] text-sky-400/80 mt-1">Ver oportunidades →</span>
              </div>
            </div>

            <PositionList
              positions={positions}
              onOpenAddModalWithTicker={handleOpenAddModal}
              onUpdateDividend={updateCustomDividend}
            />
          </>
        )}

        {/* Aba: Proventos & Calendário de Dividendos */}
        {activeTab === 'proventos' && (
          <DividendFlow
            positions={positions}
            monthlyContributionGoal={goals.monthlyTarget}
          />
        )}

        {/* Aba: Radar de Oportunidades & Alocação */}
        {activeTab === 'radar' && (
          <OpportunityRadar
            quotes={quotes}
            monthlyTarget={goals.monthlyTarget}
            currentMonthInvested={summary.currentMonthInvested}
            onOpenAddModalWithTicker={handleOpenAddModal}
            onImportTransactions={importTransactionsFromB3}
          />
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

            {/* Simulador integrado na aba de metas */}
            <InvestmentSimulator />
          </div>
        )}

        {/* Aba: Histórico de Aportes */}
        {activeTab === 'history' && (
          <div className="space-y-3">
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
              onDeleteTransaction={deleteTransaction}
            />
          </div>
        )}
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

      {/* Barra de Navegação Inferior estilo iOS (5 Abas) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-800/80 pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-5 px-1 py-2">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'portfolio' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <PieChart className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Carteira</span>
          </button>

          <button
            onClick={() => setActiveTab('proventos')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'proventos' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Coins className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Proventos</span>
          </button>

          <button
            onClick={() => setActiveTab('radar')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'radar' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Compass className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Radar</span>
          </button>

          <button
            onClick={() => setActiveTab('goals')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'goals' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Target className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Metas</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'history' ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <History className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Extrato</span>
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

      <B3ImportModal
        isOpen={isB3ModalOpen}
        onClose={() => setIsB3ModalOpen(false)}
        onImportTransactions={importTransactionsFromB3}
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
