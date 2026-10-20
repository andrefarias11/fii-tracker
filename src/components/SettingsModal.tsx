'use client';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { authenticatedFetch } from '../lib/authenticatedFetch';

import { useState, useEffect, useCallback } from 'react';
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
  Clock,
  Smartphone,
  Copy,
  LayoutGrid,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { PortfolioGoals, FiiPosition, QuoteData } from '../types/portfolio';
import {
  getSupabaseConfig,
  isEnvironmentSupabaseConfigured,
  saveSupabaseConfig,
  clearSupabaseConfig,
  getSupabaseConnectionStatus,
} from '../lib/supabase';
import {
  getPushPreferences,
  isWebPushSupported,
  registerAndSubscribePush,
  unsubscribeDevicePush,
  fetchServerPushState,
  syncPushPreferencesToServer,
  sendPushNotificationNow,
  buildPortfolioDailyAlert,
  scanSmartAlerts,
  PushPreferences,
  ServerPushState,
  SmartAlertItem,
  NotificationPrivacyMode,
} from '../lib/pushNotifications';
import {
  buildWidgetPreviewData,
  generateScriptableWidgetCode,
} from '../lib/iphoneWidget';
import { APP_VERSION, APP_UPDATED_AT, APP_CHANGELOG } from '../lib/version';
import { triggerHaptic } from '../lib/haptic';

interface SettingsModalProps {
  isOpen: boolean;
  goals: PortfolioGoals;
  positions?: FiiPosition[];
  quotes?: Record<string, QuoteData>;
  isCloudConnected: boolean;
  isSyncingCloud: boolean;
  pendingChanges?: number;
  onClose: () => void;
  onUpdateGoals: (newGoals: Partial<PortfolioGoals>) => void;
  onExportBackup: () => string;
  onImportBackup: (jsonStr: string) => Promise<boolean>;
  onResetDemo: () => void;
  onClearAll: () => void;
  onSyncCloud: () => void;
}

const IANA_TIMEZONE_OPTIONS = [
  { value: 'America/Sao_Paulo', label: 'Brasília (America/Sao_Paulo)' },
  { value: 'America/Manaus', label: 'Amazonas (America/Manaus)' },
  { value: 'America/Cuiaba', label: 'Mato Grosso (America/Cuiaba)' },
  { value: 'America/Fortaleza', label: 'Nordeste (America/Fortaleza)' },
  { value: 'America/Recife', label: 'Pernambuco (America/Recife)' },
  { value: 'America/Belem', label: 'Pará (America/Belem)' },
  { value: 'America/Rio_Branco', label: 'Acre (America/Rio_Branco)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (America/Noronha)' },
  { value: 'America/New_York', label: 'Nova York (America/New_York)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (Europe/Lisbon)' },
  { value: 'Europe/London', label: 'Londres (Europe/London)' },
  { value: 'UTC', label: 'UTC' },
];

function formatProcessStatusLabel(status?: string | null): string {
  switch (status) {
    case 'sent':
      return 'Resumo processado e enviado';
    case 'no_events':
      return 'Verificado (sem novos eventos confirmados)';
    case 'queued':
      return 'Em fila de reenvio';
    case 'partial_failure':
      return 'Enviado parcialmente entre aparelhos';
    case 'skipped_no_devices':
      return 'Sem aparelho ativo inscrito';
    case 'failed':
      return 'Falha no envio';
    case 'idle':
      return 'Aguardando próximo ciclo';
    default:
      return status || 'Ainda não processado';
  }
}

function formatDeliveryStatusLabel(status?: string | null): string {
  switch (status) {
    case 'accepted':
      return 'Envio aceito pelo serviço Push (APNs/FCM)';
    case 'retry_pending':
      return 'Falha transitória (retentativa agendada)';
    case 'expired_subscription':
      return 'Inscrição expirada (404/410) — reative neste aparelho';
    case 'failed_permanent':
      return 'Falha permanente no envio';
    case 'sending':
    case 'pending':
      return 'Envio em andamento';
    default:
      return status || 'Sem registro de envio';
  }
}

export function SettingsModal({
  isOpen,
  goals,
  positions = [],
  quotes = {},
  isCloudConnected,
  isSyncingCloud,
  pendingChanges = 0,
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
  const cloudManagedByEnvironment = isEnvironmentSupabaseConfigured();

  // Estados de Web Push API (Servidor + Dispositivo)
  const [pushPrefs, setPushPrefs] = useState<PushPreferences>(() => getPushPreferences());
  const [pushSupport, setPushSupport] = useState(() => isWebPushSupported());
  const [serverPushState, setServerPushState] = useState<ServerPushState | null>(null);
  const [isLoadingPushState, setIsLoadingPushState] = useState<boolean>(false);
  const [isEnablingPush, setIsEnablingPush] = useState<boolean>(false);
  const [isRemovingPush, setIsRemovingPush] = useState<boolean>(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState<boolean>(false);
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);

  // Estados do Widget iOS (Scriptable)
  const [widgetCopied, setWidgetCopied] = useState<boolean>(false);
  const [showWidgetSteps, setShowWidgetSteps] = useState<boolean>(false);

  const dialogRef = useModalAccessibility(isOpen, onClose);

  const refreshPushState = useCallback(async () => {
    setIsLoadingPushState(true);
    try {
      setPushSupport(isWebPushSupported());
      const state = await fetchServerPushState();
      setServerPushState(state);
      if (state.preferences) {
        setPushPrefs(getPushPreferences());
      }
    } finally {
      setIsLoadingPushState(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void fetchServerPushState().then((state) => {
      if (cancelled) return;
      setPushSupport(isWebPushSupported());
      setServerPushState(state);
      if (state.preferences) {
        setPushPrefs(getPushPreferences());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const detectedAlerts = scanSmartAlerts(positions, quotes);
  const widgetPreview = buildWidgetPreviewData(positions, goals, quotes);

  const showBanner = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 3500);
  };

  const handleCopyWidgetCode = async () => {
    try {
      const code = await generateScriptableWidgetCode(positions, goals);
      await navigator.clipboard.writeText(code);
      setWidgetCopied(true);
      showBanner('success', 'Código do Widget para iPhone copiado com sua carteira!');
      setTimeout(() => setWidgetCopied(false), 3500);
    } catch {
      showBanner('error', 'Não foi possível gerar o widget. Faça login e verifique a configuração do servidor.');
    }
  };

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    setPushStatusMsg(null);
    const result = await registerAndSubscribePush(pushPrefs);
    setPushSupport(isWebPushSupported());
    setIsEnablingPush(false);
    setPushStatusMsg(result.message);
    if (result.ok) {
      setPushPrefs(getPushPreferences());
      await refreshPushState();
      showBanner('success', result.message);
    } else {
      showBanner('error', result.message);
    }
  };

  const handleUnsubscribeDevice = async (subscriptionId?: string) => {
    setIsRemovingPush(true);
    setPushStatusMsg(null);
    const activeCount =
      serverPushState?.subscriptions.filter((s) => s.isActive).length ?? 0;
    const isLastDevice = activeCount <= 1;
    const res = await unsubscribeDevicePush({
      subscriptionId,
      disablePreferencesIfLast: isLastDevice,
    });
    setIsRemovingPush(false);
    setPushStatusMsg(res.message);
    if (res.ok) {
      setPushPrefs(getPushPreferences());
      await refreshPushState();
      showBanner('success', res.message);
    } else {
      showBanner('error', res.message);
    }
  };

  const handleUpdatePushPref = async (patch: Partial<PushPreferences>) => {
    const next: PushPreferences = { ...pushPrefs, ...patch };
    setPushPrefs(next);
    const res = await syncPushPreferencesToServer(next);
    if (res.message) {
      setPushStatusMsg(res.message);
    }
  };

  const handleTogglePushPref = (
    key:
      | 'enabled'
      | 'notifyConfirmedDividend'
      | 'notifyPaymentDay'
      | 'notifyExDate'
      | 'notifyMarketBargain'
      | 'notifyMentorConsensus'
      | 'notifyPriceOpportunity'
  ) => {
    void handleUpdatePushPref({ [key]: !pushPrefs[key] });
  };

  const handleTestLockScreenPush = async (customAlert?: SmartAlertItem) => {
    setIsSendingTestPush(true);
    setPushStatusMsg(
      '📲 Bloqueie a tela do seu aparelho agora! O alerta de teste chegará em 5 segundos...'
    );

    const sampleAlert = customAlert
      ? {
          title: customAlert.title,
          body: customAlert.body,
          tag: customAlert.id,
          url: customAlert.url,
        }
      : buildPortfolioDailyAlert(positions, quotes) || {
          title: '🔔 FII Tracker • Teste de Notificação',
          body: 'Notificação de teste enviada. Toque para abrir a aba Proventos.',
          tag: 'fii-test-lockscreen',
          url: '/?tab=proventos',
        };

    const ok = await sendPushNotificationNow(
      {
        title: sampleAlert.title,
        body: sampleAlert.body,
        tag: sampleAlert.tag,
        url: sampleAlert.url || '/?tab=proventos',
      },
      5
    );

    setIsSendingTestPush(false);
    setPushStatusMsg(
      ok
        ? '✅ Envio de teste aceito pelo serviço Push / Service Worker!'
        : 'Ative primeiro a inscrição de notificações neste aparelho.'
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

    if (!cloudManagedByEnvironment) saveSupabaseConfig(supabaseUrl, supabaseKey);

    const status = await getSupabaseConnectionStatus();
    setIsTestingCloud(false);

    if (status === 'connected') {
      setCloudTestResult('Sucesso! Conectado ao Supabase com segurança.');
      onSyncCloud();
      void refreshPushState();
    } else if (status === 'not-authenticated') {
      setCloudTestResult('Configuração encontrada. Entre na sua conta para sincronizar esta carteira.');
    } else if (status === 'missing-config') {
      setCloudTestResult('Informe a URL e a chave pública do Supabase.');
    } else {
      setCloudTestResult('Não foi possível acessar o banco. Verifique se a migração foi executada no Supabase.');
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

  const currentDeviceRecord = serverPushState?.currentDeviceSubscription || null;
  const activeDevices = (serverPushState?.subscriptions || []).filter((s) => s.isActive);
  const hasBrowserSubscription = Boolean(serverPushState?.localSubscriptionEndpoint);
  const isCurrentDeviceActiveOnServer = Boolean(currentDeviceRecord?.isActive);

  const lastProcessedAt =
    serverPushState?.preferences?.lastProcessedAt ||
    serverPushState?.statusSummary?.lastDigest?.sentAt ||
    null;
  const lastProcessStatus =
    serverPushState?.preferences?.lastProcessStatus ||
    serverPushState?.statusSummary?.lastDigest?.status ||
    null;
  const lastProcessMessage =
    serverPushState?.preferences?.lastProcessMessage ||
    serverPushState?.statusSummary?.lastDigest?.lastError ||
    null;
  const lastPushAcceptedAt =
    serverPushState?.preferences?.lastPushAcceptedAt ||
    serverPushState?.statusSummary?.lastDelivery?.acceptedAt ||
    currentDeviceRecord?.lastAcceptedAt ||
    null;
  const lastDelivery = serverPushState?.statusSummary?.lastDelivery || null;

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#121215] border border-white/[0.08] rounded-t-[28px] sm:rounded-[28px] p-6 pb-safe-modal shadow-2xl max-h-[88dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Configurações & Alertas</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-[#1c1c1f] transition-colors"
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

        {/* 0. SEÇÃO WEB PUSH API (PROCESSAMENTO NO SERVIDOR) */}
        <div className="mb-6 p-4 rounded-2xl bg-[#1c1c1f]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell className={`w-4 h-4 ${pushPrefs.enabled ? 'text-[#f5b800]' : 'text-zinc-400'}`} />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Alertas ao Longo do Dia (Web Push)
              </h3>
            </div>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                pushPrefs.enabled && isCurrentDeviceActiveOnServer
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : pushPrefs.enabled
                  ? 'bg-[#2b2512] text-[#f5b800]'
                  : 'bg-white/[0.06] text-zinc-400'
              }`}
            >
              {pushPrefs.enabled && isCurrentDeviceActiveOnServer
                ? 'Ativo no Servidor'
                : pushPrefs.enabled
                ? 'Ativo (Local)'
                : 'Desativado'}
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
            Receba alertas com o PWA fechado quando o servidor detectar eventos da carteira, como{' '}
            <strong className="text-white">novo anúncio confirmado</strong>,{' '}
            <strong className="text-white">alteração de provento</strong>,{' '}
            <strong className="text-white">Data-Com</strong> ou{' '}
            <strong className="text-white">pagamento anunciado para hoje</strong>.
          </p>

          {/* Aviso sobre carteira sincronizada */}
          <div
            className={`mb-3 p-2.5 rounded-xl border text-[11px] leading-relaxed ${
              !isCloudConnected || pendingChanges > 0
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-[#121215] border-white/[0.06] text-zinc-400'
            }`}
          >
            {!isCloudConnected ? (
              <span>
                ⚠️ <strong>Conta offline:</strong> O servidor processa exclusivamente as carteiras sincronizadas na nuvem. Conecte sua conta para receber alertas com o app fechado.
              </span>
            ) : pendingChanges > 0 ? (
              <span>
                ⚠️ <strong>{pendingChanges} alteração(ões) ainda não sincronizada(s):</strong> Lançamentos locais pendentes não participam dos alertas do servidor até a sincronização concluir.
              </span>
            ) : (
              <span>
                ☁️ O servidor processa sua carteira sincronizada na nuvem. Alterações locais ainda não sincronizadas não participam dos alertas.
              </span>
            )}
          </div>

          {pushSupport.isIosNeedInstall && (
            <div className="mb-3 p-2.5 rounded-xl bg-[#2b2512] text-[11px] text-[#f5b800]">
              📱 No iPhone, toque em <strong>Compartilhar → Adicionar à Tela de Início</strong> e abra o app pela Tela de Início para liberar o Web Push da Apple (iOS 16.4+).
            </div>
          )}

          {pushSupport.permission === 'denied' && (
            <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300">
              🚫 <strong>Permissão negada no aparelho:</strong> Abra os Ajustes do sistema ou configurações do navegador para permitir notificações deste app e toque em Revalidar Push.
            </div>
          )}

          {serverPushState?.serverWarning && (
            <div className="mb-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300">
              ⚙️ {serverPushState.serverWarning}
            </div>
          )}

          {serverPushState && !serverPushState.vapidConfigured && (
            <div className="mb-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300">
              ⚙️ <strong>Configuração ausente no servidor:</strong> Defina <code>VAPID_PRIVATE_KEY</code> no ambiente do servidor para habilitar disparos Web Push em segundo plano.
            </div>
          )}

          {/* Controle de ativação geral */}
          <label className="flex items-center justify-between gap-2 p-2.5 mb-2.5 rounded-xl bg-[#121215] border border-white/[0.06] cursor-pointer text-xs font-semibold text-white">
            <span>Receber alertas automáticos</span>
            <input
              type="checkbox"
              checked={pushPrefs.enabled}
              onChange={() => handleTogglePushPref('enabled')}
              className="accent-[#f5b800] w-4 h-4 rounded shrink-0"
            />
          </label>

          {/* Fuso horário para avaliar Data-Com e pagamento na data local */}
          <div className="mb-3 p-3 rounded-xl bg-[#121215] border border-white/[0.06] space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-[#f5b800]" />
              <span>Fuso horário dos eventos</span>
            </div>

            <div>
              <label htmlFor="push-timezone" className="text-[10px] text-zinc-400 block mb-1">
                Fuso horário (IANA)
              </label>
              <select
                id="push-timezone"
                value={pushPrefs.timezone || 'America/Sao_Paulo'}
                onChange={(e) => void handleUpdatePushPref({ timezone: e.target.value })}
                className="w-full bg-[#1c1c1f] border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs text-white outline-none focus:border-[#f5b800]/60"
              >
                {IANA_TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value} className="bg-[#121215] text-white">
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[10px] text-zinc-500 leading-relaxed">
              O servidor verifica novos eventos em cada execução do cron e envia alertas únicos para anúncios confirmados, alterações, Data-Com e pagamentos. A frequência depende do cron externo; para começar, recomendamos executá-lo a cada 30 minutos.
            </p>
          </div>

          {/* Privacidade na Tela Bloqueada */}
          <div className="mb-3 p-3 rounded-xl bg-[#121215] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
                <Lock className="w-3.5 h-3.5 text-[#f5b800]" />
                <span>Privacidade na Tela Bloqueada</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-400">
                {pushPrefs.privacyMode === 'discreet' ? 'Discreto (Padrão)' : 'Detalhado'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                {
                  mode: 'discreet' as NotificationPrivacyMode,
                  title: 'Discreto',
                  desc: 'Oculta patrimônio, cotas e valores pessoais',
                },
                {
                  mode: 'detailed' as NotificationPrivacyMode,
                  title: 'Detalhado',
                  desc: 'Exibe cotas elegíveis e total pessoal',
                },
              ]).map((item) => {
                const selected = pushPrefs.privacyMode === item.mode;
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => void handleUpdatePushPref({ privacyMode: item.mode })}
                    aria-pressed={selected}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      selected
                        ? 'bg-[#2b2512] border-[#f5b800]/50 text-white'
                        : 'bg-[#1c1c1f] border-white/[0.06] text-zinc-400'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{item.title}</div>
                    <div className="text-[10px] opacity-80 leading-tight mt-0.5">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categorias de Alerta */}
          <div className="space-y-1.5 mb-3">
            {[
              {
                key: 'notifyConfirmedDividend' as const,
                label: '📢 Novo anúncio confirmado ou alteração em anúncio de proventos da carteira',
              },
              {
                key: 'notifyPaymentDay' as const,
                label: '💰 Lembrete de pagamento anunciado para hoje (até constar recebido no extrato)',
              },
              {
                key: 'notifyExDate' as const,
                label: '⚡ Lembretes de véspera e dia de Data-Com',
              },
              {
                key: 'notifyMarketBargain' as const,
                label: '🔥 Oportunidade na B3 (FII descontado no Radar local)',
              },
              {
                key: 'notifyMentorConsensus' as const,
                label: '🏆 Consenso dos Mentores (Barsi + Buffett + Graham)',
              },
              {
                key: 'notifyPriceOpportunity' as const,
                label: '📉 FII da carteira abaixo do Preço Médio',
              },
            ].map((opt) => (
              <label
                key={opt.key}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#121215] cursor-pointer text-[11px] text-zinc-300"
              >
                <span className="leading-snug">{opt.label}</span>
                <input
                  type="checkbox"
                  checked={pushPrefs[opt.key]}
                  onChange={() => handleTogglePushPref(opt.key)}
                  className="accent-[#f5b800] w-3.5 h-3.5 rounded shrink-0"
                />
              </label>
            ))}
          </div>

          {/* Estado da Inscrição do Dispositivo e Último Processamento / Envio */}
          <div className="mb-3 p-3 rounded-xl bg-[#121215] border border-white/[0.06] space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-300">Estado deste aparelho</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isCurrentDeviceActiveOnServer
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : currentDeviceRecord && !currentDeviceRecord.isActive
                    ? 'bg-rose-500/15 text-rose-300'
                    : hasBrowserSubscription
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-white/[0.06] text-zinc-400'
                }`}
              >
                {isLoadingPushState
                  ? 'Consultando...'
                  : isCurrentDeviceActiveOnServer
                  ? 'Inscrito no servidor'
                  : currentDeviceRecord && !currentDeviceRecord.isActive
                  ? 'Inscrição expirada'
                  : hasBrowserSubscription
                  ? 'Apenas no navegador'
                  : 'Não inscrito'}
              </span>
            </div>

            <div className="text-[10px] text-zinc-400 space-y-1">
              <div>
                Permissão do navegador:{' '}
                <strong className="text-zinc-200">
                  {pushSupport.permission === 'granted'
                    ? 'Concedida'
                    : pushSupport.permission === 'denied'
                    ? 'Negada'
                    : pushSupport.permission === 'default'
                    ? 'Pendente'
                    : 'Não suportada'}
                </strong>
                {serverPushState?.authenticated && (
                  <>
                    {' • '}Aparelhos ativos na conta:{' '}
                    <strong className="text-zinc-200">{activeDevices.length}</strong>
                  </>
                )}
              </div>

              {currentDeviceRecord?.deactivatedReason && !currentDeviceRecord.isActive && (
                <div className="text-rose-300">
                  Motivo da desativação: {currentDeviceRecord.deactivatedReason}. Toque em Revalidar Push para renovar.
                </div>
              )}

              <div className="pt-1 border-t border-white/[0.05]">
                <div>
                  Último processamento:{' '}
                  <strong className="text-zinc-200">
                    {lastProcessedAt
                      ? `${new Date(lastProcessedAt).toLocaleString('pt-BR')} (${formatProcessStatusLabel(
                          lastProcessStatus
                        )})`
                      : 'Aguardando primeira execução do agendador'}
                  </strong>
                </div>
                {lastProcessMessage && (
                  <div className="text-zinc-500">Detalhe: {lastProcessMessage}</div>
                )}
              </div>

              <div className="pt-1 border-t border-white/[0.05]">
                <div>
                  Último envio:{' '}
                  <strong className="text-zinc-200">
                    {lastDelivery
                      ? `${formatDeliveryStatusLabel(lastDelivery.status)}${
                          lastPushAcceptedAt
                            ? ` em ${new Date(lastPushAcceptedAt).toLocaleString('pt-BR')}`
                            : ''
                        }`
                      : lastPushAcceptedAt
                      ? `Envio aceito pelo serviço Push em ${new Date(
                          lastPushAcceptedAt
                        ).toLocaleString('pt-BR')}`
                      : 'Nenhum envio registrado ainda'}
                  </strong>
                </div>
                {lastDelivery?.lastError && (
                  <div className="text-rose-300">Último erro: {lastDelivery.lastError}</div>
                )}
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Nota: &ldquo;Envio aceito pelo serviço Push&rdquo; indica que a fila APNs/FCM recebeu a mensagem, sem confirmar leitura ou recebimento imediato no aparelho.
                </div>
              </div>
            </div>

            {/* Lista de dispositivos inscritos na conta */}
            {serverPushState && serverPushState.subscriptions.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                <div className="text-[10px] font-semibold text-zinc-400">
                  Dispositivos vinculados a esta conta ({serverPushState.subscriptions.length})
                </div>
                {serverPushState.subscriptions.map((sub) => {
                  const isThisDevice =
                    Boolean(serverPushState.localEndpointHash) &&
                    sub.endpointHash === serverPushState.localEndpointHash;
                  return (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[#1c1c1f] px-2.5 py-1.5 text-[10px]"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-zinc-200">
                          {sub.deviceLabel || 'Dispositivo Web'}
                          {isThisDevice ? ' (Este aparelho)' : ''}
                        </span>
                        <span className="ml-1.5 text-zinc-500">
                          • {sub.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isRemovingPush}
                        onClick={() =>
                          void handleUnsubscribeDevice(isThisDevice ? undefined : sub.id)
                        }
                        className="text-rose-400 hover:text-rose-300 font-semibold shrink-0"
                      >
                        Remover
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {pushStatusMsg && (
            <div className="mb-3 p-2.5 rounded-xl bg-[#121215] text-[11px] text-[#f5b800]">
              {pushStatusMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 mb-2">
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isEnablingPush}
              className="py-2.5 px-3 rounded-full bg-[#f5b800] hover:bg-[#ffca28] disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Bell className="w-3.5 h-3.5" />
              {isEnablingPush
                ? 'Ativando...'
                : isCurrentDeviceActiveOnServer
                ? 'Revalidar Push'
                : 'Ativar neste Aparelho'}
            </button>

            <button
              type="button"
              onClick={() => handleTestLockScreenPush()}
              disabled={isSendingTestPush}
              className="py-2.5 px-3 rounded-full bg-[#2b2512] disabled:opacity-50 text-[#f5b800] font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              title="Dispara uma notificação de teste em 5 segundos para sua Tela de Bloqueio"
            >
              <Smartphone className="w-3.5 h-3.5" />
              {isSendingTestPush ? 'Aguarde 5s...' : 'Testar Bloq. (5s)'}
            </button>
          </div>

          {(hasBrowserSubscription || isCurrentDeviceActiveOnServer) && (
            <div className="mb-2 text-right">
              <button
                type="button"
                disabled={isRemovingPush}
                onClick={() => void handleUnsubscribeDevice()}
                className="text-[11px] text-zinc-400 hover:text-rose-400 underline"
              >
                {isRemovingPush
                  ? 'Removendo inscrição...'
                  : 'Desativar e remover inscrição deste aparelho'}
              </button>
            </div>
          )}

          {/* Prévia Ao Vivo dos Alertas Detectados Hoje na B3 */}
          {detectedAlerts.length > 0 && (
            <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#f5b800] uppercase tracking-wider">
                  Radar de Alertas Hoje ({detectedAlerts.length})
                </span>
                <span className="text-[11px] text-zinc-500">Toque para enviar teste</span>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                {detectedAlerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleTestLockScreenPush(alert)}
                    className="p-2.5 rounded-xl bg-[#121215] hover:border-[#f5b800]/40 border border-transparent cursor-pointer transition-all"
                  >
                    <div className="text-[11px] font-bold text-white mb-0.5">
                      {alert.title}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {alert.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 0.5. SEÇÃO WIDGET PARA TELA INICIAL E BLOQUEIO DO IPHONE */}
        <div className="mb-6 p-4 rounded-2xl bg-[#1c1c1f]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-[#f5b800]" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Widget para iPhone (Tela Inicial & Bloq.)
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800]">
              Zero Bateria
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
            Acompanhe seu patrimônio, dividendos do mês e a melhor oportunidade do dia direto na tela inicial do iPhone.
          </p>

          {/* Prévia Visual Idêntica ao Widget Médio do iPhone */}
          <div className="mb-3 p-3.5 rounded-2xl bg-[#121215] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-extrabold text-[#f5b800] tracking-wider">
                FII TRACKER
              </span>
              <span className="text-[9px] text-zinc-400 font-medium">
                Prévia Ao Vivo • iOS Widget
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <div className="text-[8px] font-bold text-zinc-500 uppercase">
                  Patrimônio Atual
                </div>
                <div className="text-base font-bold text-white leading-tight">
                  R$ {widgetPreview.equity.toFixed(2).replace('.', ',')}
                </div>
                <div
                  className={`text-[10px] font-semibold ${
                    widgetPreview.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {widgetPreview.profit >= 0 ? '▲ ' : '▼ '}
                  R$ {Math.abs(widgetPreview.profit).toFixed(2).replace('.', ',')} (
                  {widgetPreview.profitPct}%)
                </div>

                <div className="mt-2 text-[8px] font-bold text-zinc-500 uppercase">
                  Proventos Mês (YoC {widgetPreview.yocPct}%)
                </div>
                <div className="text-xs font-bold text-emerald-400">
                  R$ {widgetPreview.monthlyIncome.toFixed(2).replace('.', ',')} / R${' '}
                  {widgetPreview.incomeGoal.toFixed(0)}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="p-2.5 rounded-xl bg-[#1c1c1f]">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Próximo Provento
                  </div>
                  <div className="text-[11px] font-semibold text-white truncate">
                    {widgetPreview.nextEvent}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#1c1c1f]">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Oportunidade B3
                  </div>
                  <div className="text-[11px] font-semibold text-white truncate">
                    {widgetPreview.topBargain}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" className="text-sm text-amber-300 p-2" onClick={async () => {
              const res = await authenticatedFetch('/api/widget', { method: 'DELETE' });
              showBanner(res.ok ? 'success' : 'error', res.ok ? 'Acesso dos widgets revogado.' : 'Falha ao revogar widget.');
            }}>Revogar acesso do widget</button>
            <button
              type="button"
              onClick={handleCopyWidgetCode}
              className="py-2.5 px-3 rounded-full bg-[#f5b800] hover:bg-[#ffca28] text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              {widgetCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Widget
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowWidgetSteps((prev) => !prev)}
              className="py-2.5 px-3 rounded-full bg-[#2b2512] text-[#f5b800] font-bold text-xs transition-all"
            >
              {showWidgetSteps ? 'Ocultar Guia' : 'Como Instalar'}
            </button>
          </div>

          {showWidgetSteps && (
            <div className="mt-3 p-3.5 rounded-xl bg-[#121215] text-[11px] text-zinc-300 space-y-1.5 leading-relaxed">
              <div className="font-bold text-white">Passo a passo no iPhone (leva 1 minuto):</div>
              <div>
                1. Baixe o app gratuito <strong>Scriptable</strong> na App Store do iPhone.
              </div>
              <div>
                2. Clique em <strong>Copiar Widget</strong> acima, abra o Scriptable, toque no <strong>+</strong> e cole o código.
              </div>
              <div>
                3. Na tela inicial do iPhone, segure o dedo num espaço vazio → toque em <strong>+</strong> → escolha <strong>Scriptable</strong> (tamanho Médio) e selecione o script salvo.
              </div>
            </div>
          )}
        </div>

        {/* 1. SEÇÃO SUPABASE NA NUVEM */}
        <div className="mb-6 p-4 rounded-2xl bg-[#1c1c1f]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cloud className={`w-4 h-4 ${isCloudConnected ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Nuvem Supabase
              </h3>
            </div>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                isCloudConnected
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-white/[0.06] text-zinc-400'
              }`}
            >
              {isCloudConnected ? 'Conectado (Seguro)' : 'Modo Offline'}
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
            {cloudManagedByEnvironment
              ? 'A nuvem deste aplicativo já está configurada. Entre na sua conta para sincronizar entre iPhone e PC.'
              : 'Conecte seu banco gratuito do Supabase para que seus lançamentos sincronizem entre o iPhone e o PC.'}
          </p>

          <form onSubmit={handleConnectSupabase} className="space-y-2.5">
            {!cloudManagedByEnvironment && <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Project URL</label>
              <input
                type="text"
                placeholder="https://xyz.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full bg-[#121215] border border-white/[0.08] rounded-xl px-3 py-2 text-base sm:text-xs text-white outline-none focus:border-[#f5b800]/60 font-mono"
              />
            </div>}

            {!cloudManagedByEnvironment && <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Anon Key</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="w-full bg-[#121215] border border-white/[0.08] rounded-xl px-3 py-2 text-base sm:text-xs text-white outline-none focus:border-[#f5b800]/60 font-mono"
              />
            </div>}

            {cloudTestResult && (
              <div
                className={`text-[11px] p-2.5 rounded-xl flex items-center gap-1.5 ${
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
                disabled={isTestingCloud || (!cloudManagedByEnvironment && (!supabaseUrl || !supabaseKey))}
                className="flex-1 py-2.5 px-3 rounded-full bg-[#f5b800] hover:bg-[#ffca28] disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Cloud className="w-3.5 h-3.5" />
                {isTestingCloud ? 'Verificando...' : cloudManagedByEnvironment ? 'Verificar conexão' : 'Salvar & Conectar'}
              </button>

              {isCloudConnected && (
                <>
                  <button
                    type="button"
                    onClick={onSyncCloud}
                    disabled={isSyncingCloud}
                    className="p-2.5 rounded-full bg-[#121215] text-zinc-300 transition-all"
                    title="Sincronizar Agora"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin text-[#f5b800]' : ''}`} />
                  </button>
                  {confirmAction === 'disconnect' ? (
                    <button
                      type="button"
                      onClick={handleConfirmDisconnectSupabase}
                      className="px-3 py-2 rounded-full bg-rose-500 text-white text-[11px] font-bold transition-all"
                    >
                      Confirmar?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAction('disconnect')}
                      className="p-2.5 rounded-full bg-[#121215] text-zinc-400 hover:text-rose-400 transition-all"
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
              inputMode="decimal"
              step="any"
              min="0"
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(e.target.value)}
              className="w-full bg-[#1c1c1f] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-base sm:text-sm text-white font-bold outline-none focus:border-[#f5b800]/60 tabular-nums"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Marco Patrimonial (R$)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={milestoneEquity}
                onChange={(e) => setMilestoneEquity(e.target.value)}
                className="w-full bg-[#1c1c1f] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-base sm:text-sm text-white font-bold outline-none focus:border-[#f5b800]/60 tabular-nums"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Renda Mensal (R$/mês)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                className="w-full bg-[#1c1c1f] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-base sm:text-sm text-white font-bold outline-none focus:border-[#f5b800]/60 tabular-nums"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingGoals}
            className="w-full py-3 px-4 rounded-full bg-[#f5b800] hover:bg-[#ffca28] disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            {isSavingGoals ? 'Salvando...' : 'Salvar Metas'}
          </button>
        </form>

        {/* 3. BACKUP MANUAL */}
        <div className="space-y-3 mb-6 pt-4 border-t border-white/[0.06]">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Backup Manual em Arquivo
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExport}
              className="p-3.5 rounded-2xl bg-[#1c1c1f] hover:bg-white/[0.04] text-left transition-all"
            >
              <Download className="w-4 h-4 text-[#f5b800] mb-1" />
              <div className="text-xs font-bold text-white">Baixar Backup</div>
              <div className="text-[11px] text-zinc-500">Salvar arquivo JSON</div>
            </button>

            <label className="p-3.5 rounded-2xl bg-[#1c1c1f] hover:bg-white/[0.04] text-left transition-all cursor-pointer block">
              <Upload className="w-4 h-4 text-emerald-400 mb-1" />
              <div className="text-xs font-bold text-white">Restaurar</div>
              <div className="text-[11px] text-zinc-500">Carregar arquivo</div>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
        </div>

        {/* 4. AÇÕES AVANÇADAS */}
        <div className="space-y-2 pt-4 border-t border-white/[0.06]">
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
                  className="px-3 py-1 rounded-full bg-[#f5b800] text-zinc-950 text-xs font-bold"
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
                  className="px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold"
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

        {/* 5. ATALHO ADMIN & CONTROLE DE VERSÃO DO APP */}
        <div className="mt-6 pt-4 border-t border-white/[0.06] space-y-3">
          <a
            href="/admin"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-[#2b2512] hover:bg-[#3d3419] border border-[#f5b800]/25 text-xs font-semibold text-[#f5b800] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Painel Admin (Visão de Todas as Contas)</span>
          </a>

          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Versão do Sistema</span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#2b2512] text-[#f5b800] tabular-nums">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2b2512] text-[#f5b800] text-[11px] font-bold active:scale-95 transition-all"
              title="Recarregar o aplicativo para buscar a versão mais recente"
            >
              <RefreshCw className="w-3 h-3" />
              Recarregar App
            </button>
          </div>

          <div className="rounded-2xl bg-[#1c1c1f] p-3.5 space-y-2">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Novidades da v{APP_CHANGELOG[0]?.version}
            </div>
            <ul className="space-y-1">
              {APP_CHANGELOG[0]?.highlights.map((item, idx) => (
                <li key={idx} className="text-[11px] text-zinc-300 flex items-start gap-1.5 leading-snug">
                  <span className="text-[#f5b800] font-bold">•</span>
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
