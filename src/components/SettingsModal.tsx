'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Save,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Cloud,
  Check,
  RefreshCw,
  Unlink,
} from 'lucide-react';
import { PortfolioGoals } from '../types/portfolio';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  checkSupabaseConnection,
} from '../lib/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  goals: PortfolioGoals;
  isCloudConnected: boolean;
  isSyncingCloud: boolean;
  onClose: () => void;
  onUpdateGoals: (newGoals: Partial<PortfolioGoals>) => void;
  onExportBackup: () => string;
  onImportBackup: (jsonStr: string) => Promise<boolean>;
  onResetDemo: () => void;
  onClearAll: () => void;
  onSyncCloud: () => void;
}

export function SettingsModal({
  isOpen,
  goals,
  isCloudConnected,
  isSyncingCloud,
  onClose,
  onUpdateGoals,
  onExportBackup,
  onImportBackup,
  onResetDemo,
  onClearAll,
  onSyncCloud,
}: SettingsModalProps) {
  const [monthlyTarget, setMonthlyTarget] = useState<string>(String(goals.monthlyTarget || 200));
  const [milestoneEquity, setMilestoneEquity] = useState<string>(String(goals.milestoneEquityTarget || 1000));
  const [monthlyIncome, setMonthlyIncome] = useState<string>(String(goals.monthlyIncomeTarget || 10));
  const [message, setMessage] = useState<string | null>(null);
  const [isSavingGoals, setIsSavingGoals] = useState<boolean>(false);

  // Estados de configuração Supabase
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseKey, setSupabaseKey] = useState<string>('');
  const [isTestingCloud, setIsTestingCloud] = useState<boolean>(false);
  const [cloudTestResult, setCloudTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setSupabaseUrl(config.url);
      setSupabaseKey(config.key);
      setMonthlyTarget(String(goals.monthlyTarget || 200));
      setMilestoneEquity(String(goals.milestoneEquityTarget || 1000));
      setMonthlyIncome(String(goals.monthlyIncomeTarget || 10));
    }
  }, [isOpen, goals]);

  if (!isOpen) return null;

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    const mTarget = parseFloat(String(monthlyTarget).replace(',', '.'));
    const mEquity = parseFloat(String(milestoneEquity).replace(',', '.'));
    const mIncome = parseFloat(String(monthlyIncome).replace(',', '.'));

    if (isNaN(mTarget) || mTarget <= 0) {
      alert('Por favor, informe um valor maior que zero para a meta mensal.');
      return;
    }

    setIsSavingGoals(true);
    try {
      await onUpdateGoals({
        monthlyTarget: mTarget,
        milestoneEquityTarget: isNaN(mEquity) || mEquity <= 0 ? 1000 : mEquity,
        monthlyIncomeTarget: isNaN(mIncome) || mIncome <= 0 ? 10 : mIncome,
      });
      setMessage('Metas salvas com sucesso!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar metas:', err);
      alert('Falha ao salvar metas. Tente novamente.');
    } finally {
      setIsSavingGoals(false);
    }
  };

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTestingCloud(true);
    setCloudTestResult(null);

    saveSupabaseConfig(supabaseUrl, supabaseKey);

    const connected = await checkSupabaseConnection();
    setIsTestingCloud(false);

    if (connected) {
      setCloudTestResult('Sucesso! Conectado ao Supabase com segurança.');
      onSyncCloud();
    } else {
      setCloudTestResult('Falha ao conectar. Verifique a URL e a Anon Key digitadas.');
    }
  };

  const handleDisconnectSupabase = () => {
    if (confirm('Deseja desconectar o Supabase? Os dados locais continuarão salvos no seu aparelho.')) {
      clearSupabaseConfig();
      setSupabaseUrl('');
      setSupabaseKey('');
      setCloudTestResult('Supabase desconectado.');
      onSyncCloud();
    }
  };

  const handleExport = () => {
    const json = onExportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-fii-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = await onImportBackup(content);
        if (ok) {
          setMessage('Backup importado com sucesso!');
          setTimeout(() => setMessage(null), 3000);
        } else {
          alert('Arquivo de backup inválido.');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Configurações & Nuvem</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {message && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {message}
          </div>
        )}

        {/* 1. SEÇÃO SUPABASE NA NUVEM */}
        <div className="mb-6 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cloud className={`w-4 h-4 ${isCloudConnected ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Nuvem Supabase
              </h3>
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                isCloudConnected
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {isCloudConnected ? 'Conectado (Seguro)' : 'Modo Offline'}
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
            Conecte seu banco gratuito do Supabase para que seus lançamentos nunca sejam perdidos e sincronizem entre o iPhone e o PC.
          </p>

          <form onSubmit={handleConnectSupabase} className="space-y-2.5">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-0.5">Project URL</label>
              <input
                type="text"
                placeholder="https://xyz.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-0.5">Anon Key</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {cloudTestResult && (
              <div
                className={`text-[11px] p-2 rounded-xl flex items-center gap-1.5 ${
                  isCloudConnected
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {isCloudConnected ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {cloudTestResult}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isTestingCloud || !supabaseUrl || !supabaseKey}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Cloud className="w-3.5 h-3.5" />
                {isTestingCloud ? 'Conectando...' : 'Salvar & Conectar'}
              </button>

              {isCloudConnected && (
                <>
                  <button
                    type="button"
                    onClick={onSyncCloud}
                    disabled={isSyncingCloud}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all"
                    title="Sincronizar Agora"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectSupabase}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-all"
                    title="Desconectar"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        {/* 2. AJUSTE DE METAS */}
        <form onSubmit={handleSaveGoals} className="space-y-3.5 mb-6">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Definir Minhas Metas
          </h3>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Meta de Aporte Mensal (R$)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold outline-none focus:border-emerald-500"
              required
            />
            <p className="text-[11px] text-zinc-500 mt-1">Sua meta principal definida: R$ {monthlyTarget || '0'}/mês</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Marco Patrimonial (R$)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={milestoneEquity}
                onChange={(e) => setMilestoneEquity(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Renda Mensal (R$/mês)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingGoals}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
          >
            <Save className="w-3.5 h-3.5" />
            {isSavingGoals ? 'Salvando...' : 'Salvar Metas'}
          </button>
        </form>

        {/* 3. BACKUP MANUAL */}
        <div className="space-y-3 mb-6 pt-4 border-t border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Backup Manual em Arquivo
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExport}
              className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-left transition-all"
            >
              <Download className="w-4 h-4 text-emerald-400 mb-1" />
              <div className="text-xs font-bold text-white">Baixar Backup</div>
              <div className="text-[10px] text-zinc-500">Salvar arquivo JSON</div>
            </button>

            <label className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-left transition-all cursor-pointer block">
              <Upload className="w-4 h-4 text-teal-400 mb-1" />
              <div className="text-xs font-bold text-white">Restaurar</div>
              <div className="text-[10px] text-zinc-500">Carregar arquivo</div>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
        </div>

        {/* 4. AÇÕES AVANÇADAS */}
        <div className="space-y-2 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (confirm('Deseja recarregar a carteira com dados demonstrativos?')) {
                  onResetDemo();
                  onClose();
                }
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 py-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recarregar Exemplo
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm('Tem certeza de que deseja apagar todos os aportes cadastrados?')) {
                  onClearAll();
                  onClose();
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 py-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Carteira
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
