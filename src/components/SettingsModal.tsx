'use client';

import { useState } from 'react';
import {
  X,
  Save,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Check,
  RefreshCw,
  Unlink,
  Bell,
  Smartphone,
  Copy,
  LayoutGrid,
} from 'lucide-react';
import { PortfolioGoals, FiiPosition, QuoteData } from '../types/portfolio';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  checkSupabaseConnection,
} from '../lib/supabase';
import {
  getPushPreferences,
  savePushPreferences,
  isWebPushSupported,
  registerAndSubscribePush,
  sendPushNotificationNow,
  buildPortfolioDailyAlert,
  scanSmartAlerts,
  PushPreferences,
  SmartAlertItem,
} from '../lib/pushNotifications';
import {
  buildWidgetPreviewData,
  generateScriptableWidgetCode,
} from '../lib/iphoneWidget';
import { APP_VERSION, APP_UPDATED_AT, APP_CHANGELOG } from '../lib/version';

interface SettingsModalProps {
  isOpen: boolean;
  goals: PortfolioGoals;
  positions?: FiiPosition[];
  quotes?: Record<string, QuoteData>;
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
  positions = [],
  quotes = {},
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
  const [monthlyTarget, setMonthlyTarget] = useState<string>(() => String(goals.monthlyTarget || 200));
  const [milestoneEquity, setMilestoneEquity] = useState<string>(() => String(goals.milestoneEquityTarget || 1000));
  const [monthlyIncome, setMonthlyIncome] = useState<string>(() => String(goals.monthlyIncomeTarget || 10));
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingGoals, setIsSavingGoals] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<'disconnect' | 'demo' | 'clear' | null>(null);

  // Estados de configuração Supabase
  const [supabaseUrl, setSupabaseUrl] = useState<string>(() => getSupabaseConfig().url);
  const [supabaseKey, setSupabaseKey] = useState<string>(() => getSupabaseConfig().key);
  const [isTestingCloud, setIsTestingCloud] = useState<boolean>(false);
  const [cloudTestResult, setCloudTestResult] = useState<string | null>(null);

  // Estados de Web Push API (iPhone / PWA)
  const [pushPrefs, setPushPrefs] = useState<PushPreferences>(() => getPushPreferences());
  const [pushSupport] = useState(() => isWebPushSupported());
  const [isEnablingPush, setIsEnablingPush] = useState<boolean>(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState<boolean>(false);
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);

  // Estados do Widget iOS (Scriptable)
  const [widgetCopied, setWidgetCopied] = useState<boolean>(false);
  const [showWidgetSteps, setShowWidgetSteps] = useState<boolean>(false);

  if (!isOpen) return null;

  const detectedAlerts = scanSmartAlerts(positions, quotes);
  const widgetPreview = buildWidgetPreviewData(positions, goals, quotes);

  const showBanner = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 3500);
  };

  const handleCopyWidgetCode = async () => {
    try {
      const code = generateScriptableWidgetCode(positions, goals);
      await navigator.clipboard.writeText(code);
      setWidgetCopied(true);
      showBanner('success', 'Código do Widget para iPhone copiado com sua carteira!');
      setTimeout(() => setWidgetCopied(false), 3500);
    } catch {
      showBanner('error', 'Não foi possível copiar automaticamente. Tente novamente.');
    }
  };

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    setPushStatusMsg(null);
    const result = await registerAndSubscribePush();
    setIsEnablingPush(false);
    setPushStatusMsg(result.message);
    if (result.ok) {
      setPushPrefs(getPushPreferences());
      showBanner('success', result.message);
    } else {
      showBanner('error', result.message);
    }
  };

  const handleTogglePushPref = (key: keyof PushPreferences) => {
    const next = { ...pushPrefs, [key]: !pushPrefs[key] };
    setPushPrefs(next);
    savePushPreferences(next);
  };

  const handleTestLockScreenPush = async (customAlert?: SmartAlertItem) => {
    setIsSendingTestPush(true);
    setPushStatusMsg(
      '📲 Bloqueie a tela do seu iPhone agora! O alerta chegará em 5 segundos...'
    );

    const sampleAlert = customAlert
      ? {
          title: customAlert.title,
          body: customAlert.body,
          tag: customAlert.id,
          url: customAlert.url,
        }
      : buildPortfolioDailyAlert(positions, quotes) || {
          title: '🔔 FII Tracker • Alerta Ativo',
          body: 'As notificações na Tela de Bloqueio estão funcionando perfeitamente!',
          tag: 'fii-test-lockscreen',
          url: '/?tab=radar',
        };

    const ok = await sendPushNotificationNow(
      {
        title: sampleAlert.title,
        body: sampleAlert.body,
        tag: sampleAlert.tag,
        url: sampleAlert.url || '/?tab=radar',
      },
      5
    );

    setIsSendingTestPush(false);
    setPushStatusMsg(
      ok
        ? '✅ Notificação disparada com sucesso pelo Web Push!'
        : 'Ative primeiro a permissão de notificações acima.'
    );
  };

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    const mTarget = parseFloat(String(monthlyTarget).replace(',', '.'));
    const mEquity = parseFloat(String(milestoneEquity).replace(',', '.'));
    const mIncome = parseFloat(String(monthlyIncome).replace(',', '.'));

    if (isNaN(mTarget) || mTarget <= 0) {
      showBanner('error', 'Informe um valor maior que zero para a meta mensal.');
      return;
    }

    setIsSavingGoals(true);
    try {
      await onUpdateGoals({
        monthlyTarget: mTarget,
        milestoneEquityTarget: isNaN(mEquity) || mEquity <= 0 ? 1000 : mEquity,
        monthlyIncomeTarget: isNaN(mIncome) || mIncome <= 0 ? 10 : mIncome,
      });
      showBanner('success', 'Metas salvas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar metas:', err);
      showBanner('error', 'Falha ao salvar metas. Tente novamente.');
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

  const handleConfirmDisconnectSupabase = () => {
    clearSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseKey('');
    setConfirmAction(null);
    setCloudTestResult('Supabase desconectado.');
    onSyncCloud();
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
          showBanner('success', 'Backup importado com sucesso!');
        } else {
          showBanner('error', 'Arquivo de backup inválido.');
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
          <h2 className="text-base font-bold text-white">Configurações & Alertas</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {banner && (
          <div
            className={`mb-4 p-3 rounded-2xl border text-xs flex items-center gap-2 ${
              banner.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
            }`}
          >
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
        )}

        {/* 0. SEÇÃO WEB PUSH API (NOTIFICAÇÕES DE OPORTUNIDADES E DATA-COM NO IPHONE) */}
        <div className="mb-6 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell className={`w-4 h-4 ${pushPrefs.enabled ? 'text-emerald-400' : 'text-amber-400'}`} />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Alertas B3 & Oportunidades (Web Push)
              </h3>
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                pushPrefs.enabled
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {pushPrefs.enabled ? 'Ativado (APNs)' : 'Desativado'}
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
            Fique sempre antenado mesmo após bater a meta do mês: receba alertas de{' '}
            <strong>Data-Com confirmada</strong>, <strong>Barganhas na B3</strong> e{' '}
            <strong>Consenso dos Mentores</strong> direto na tela bloqueada do iPhone.
          </p>

          {pushSupport.isIosNeedInstall && (
            <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
              📱 No iPhone, toque em <strong>Compartilhar → Adicionar à Tela de Início</strong> e abra o app pela Tela de Início para liberar o Web Push da Apple.
            </div>
          )}

          {/* 6 Categorias de Alerta (Oportunidades + Proventos) */}
          <div className="space-y-1.5 mb-3">
            {[
              {
                key: 'notifyConfirmedDividend' as const,
                label: '📢 Quando um FII confirmar valor de dividendo e Data-Com na B3',
              },
              {
                key: 'notifyMarketBargain' as const,
                label: '🔥 Super Oportunidade na B3 (FII muito descontado mesmo após bater meta)',
              },
              {
                key: 'notifyMentorConsensus' as const,
                label: '🏆 Quando um FII entrar no Consenso dos Mentores (Barsi + Buffett)',
              },
              {
                key: 'notifyExDate' as const,
                label: '⚡ Véspera e dia de Data-Com (para dar tempo de comprar e receber)',
              },
              {
                key: 'notifyPriceOpportunity' as const,
                label: '📉 Quando um FII da minha carteira cair abaixo do meu Preço Médio',
              },
              {
                key: 'notifyPaymentDay' as const,
                label: '💰 Dia em que o dividendo cair na conta da corretora',
              },
            ].map((opt) => (
              <label
                key={opt.key}
                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-900/70 border border-zinc-800/70 cursor-pointer text-[11px] text-zinc-300"
              >
                <span className="leading-snug">{opt.label}</span>
                <input
                  type="checkbox"
                  checked={pushPrefs[opt.key]}
                  onChange={() => handleTogglePushPref(opt.key)}
                  className="accent-emerald-500 w-3.5 h-3.5 rounded shrink-0"
                />
              </label>
            ))}
          </div>

          {pushStatusMsg && (
            <div className="mb-3 p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-emerald-300">
              {pushStatusMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isEnablingPush}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Bell className="w-3.5 h-3.5" />
              {isEnablingPush
                ? 'Ativando...'
                : pushPrefs.enabled
                ? 'Revalidar Push'
                : 'Ativar Alertas'}
            </button>

            <button
              type="button"
              onClick={() => handleTestLockScreenPush()}
              disabled={isSendingTestPush}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              title="Dispara a principal oportunidade/alerta de hoje em 5 segundos para sua Tela de Bloqueio"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              {isSendingTestPush ? 'Aguarde 5s...' : 'Testar Tela Bloq. (5s)'}
            </button>
          </div>

          {/* Prévia Ao Vivo dos Alertas Detectados Hoje na B3 */}
          {detectedAlerts.length > 0 && (
            <div className="pt-2.5 border-t border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  📡 Radar de Alertas Detectados Hoje ({detectedAlerts.length})
                </span>
                <span className="text-[9px] text-zinc-500">Toque para enviar p/ tela bloq.</span>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                {detectedAlerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleTestLockScreenPush(alert)}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/90 hover:border-emerald-500/40 cursor-pointer transition-all"
                  >
                    <div className="text-[11px] font-bold text-white mb-0.5">
                      {alert.title}
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-snug">
                      {alert.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 0.5. SEÇÃO WIDGET PARA TELA INICIAL E BLOQUEIO DO IPHONE */}
        <div className="mb-6 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Widget para iPhone (Tela Inicial & Bloq.)
              </h3>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              🔋 Trava B3 (Zero Bateria)
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
            Acompanhe seu patrimônio, dividendos do mês e a melhor oportunidade do dia direto na tela inicial do iPhone. <strong>Congela sozinho das 18h às 10h e nos fins de semana</strong> para não gastar bateria.
          </p>

          {/* Prévia Visual Idêntica ao Widget Médio do iPhone */}
          <div className="mb-3 p-3.5 rounded-3xl bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-extrabold text-emerald-400 tracking-wider">
                🏢 FII TRACKER
              </span>
              <span className="text-[9px] text-zinc-400 font-medium">
                ● Prévia Ao Vivo • iOS Widget
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <div className="text-[8px] font-bold text-zinc-500 uppercase">
                  Patrimônio Atual
                </div>
                <div className="text-base font-extrabold text-white leading-tight">
                  R$ {widgetPreview.equity.toFixed(2).replace('.', ',')}
                </div>
                <div
                  className={`text-[10px] font-semibold ${
                    widgetPreview.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {widgetPreview.profit >= 0 ? '+' : ''}
                  R$ {widgetPreview.profit.toFixed(2).replace('.', ',')} (
                  {widgetPreview.profit >= 0 ? '+' : ''}
                  {widgetPreview.profitPct}%)
                </div>

                <div className="mt-2 text-[8px] font-bold text-zinc-500 uppercase">
                  Proventos Mês (YoC {widgetPreview.yocPct}%)
                </div>
                <div className="text-xs font-extrabold text-emerald-400">
                  R$ {widgetPreview.monthlyIncome.toFixed(2).replace('.', ',')} / R${' '}
                  {widgetPreview.incomeGoal.toFixed(0)}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
                  <div className="text-[8px] font-bold text-zinc-400 uppercase">
                    📅 Próximo Provento
                  </div>
                  <div className="text-[10px] font-semibold text-white truncate">
                    {widgetPreview.nextEvent}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-emerald-950/50 border border-emerald-500/20">
                  <div className="text-[8px] font-bold text-emerald-400 uppercase">
                    🔥 Oportunidade Radar B3
                  </div>
                  <div className="text-[9px] font-semibold text-emerald-100 truncate">
                    {widgetPreview.topBargain}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWidgetCode}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              {widgetCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Código Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Código do Widget
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowWidgetSteps((prev) => !prev)}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-all"
            >
              {showWidgetSteps ? 'Ocultar Guia' : 'Como Instalar'}
            </button>
          </div>

          {showWidgetSteps && (
            <div className="mt-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-300 space-y-1.5 leading-relaxed">
              <div className="font-bold text-white">Passo a passo no iPhone (leva 1 minuto):</div>
              <div>
                1. Baixe o app gratuito <strong>Scriptable</strong> na App Store do iPhone.
              </div>
              <div>
                2. Clique em <strong>Copiar Código do Widget</strong> acima, abra o Scriptable, toque no <strong>+</strong> (canto superior direito) e cole o código.
              </div>
              <div>
                3. Na tela inicial do iPhone, segure o dedo num espaço vazio → toque em <strong>+</strong> → escolha <strong>Scriptable</strong> (tamanho Médio) → edite o widget e selecione o script que você salvou!
              </div>
            </div>
          )}
        </div>

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
                  {confirmAction === 'disconnect' ? (
                    <button
                      type="button"
                      onClick={handleConfirmDisconnectSupabase}
                      className="px-2.5 py-2 rounded-xl bg-rose-500 text-white text-[11px] font-bold transition-all"
                    >
                      Confirmar?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAction('disconnect')}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-all"
                      title="Desconectar"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  )}
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
          <div className="flex items-center justify-between gap-2">
            {confirmAction === 'demo' ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onResetDemo();
                    setConfirmAction(null);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold"
                >
                  Confirmar Exemplo?
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="text-xs text-zinc-400 px-1.5"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAction('demo')}
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 py-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Recarregar Exemplo
              </button>
            )}

            {confirmAction === 'clear' ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmAction(null);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-xl bg-rose-500 text-white text-xs font-bold"
                >
                  Apagar Tudo?
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="text-xs text-zinc-400 px-1.5"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAction('clear')}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 py-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Carteira
              </button>
            )}
          </div>
        </div>

        {/* 5. VERSÃO DO APP & CONTROLE DE ATUALIZAÇÃO */}
        <div className="mt-6 pt-4 border-t border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Versão do Sistema</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Última atualização: {APP_UPDATED_AT}
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold active:scale-95 transition-all"
              title="Recarregar o aplicativo para buscar a versão mais recente"
            >
              <RefreshCw className="w-3 h-3 text-emerald-400" />
              Recarregar App
            </button>
          </div>

          <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800/70 p-3 space-y-2">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Novidades da v{APP_CHANGELOG[0]?.version}
            </div>
            <ul className="space-y-1">
              {APP_CHANGELOG[0]?.highlights.map((item, idx) => (
                <li key={idx} className="text-[11px] text-zinc-300 flex items-start gap-1.5 leading-snug">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
