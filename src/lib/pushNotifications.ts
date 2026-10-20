import { authenticatedFetch } from './authenticatedFetch';
import { getActiveAccount } from './authManager';
import { FiiPosition, QuoteData } from '../types/portfolio';
import { calculateMonthDividends } from '../data/fiiDividendCalendar';
import { findFiiInfo } from '../data/fiiDatabase';
import { evaluateAllFiis } from './recommendationEngine';
import { evaluateMentorsRecommendations } from './mentorEngine';
import { buildSafePushUrl } from './pushNavigation';

export type NotificationPrivacyMode = 'discreet' | 'detailed';

export interface PushPreferences {
  enabled: boolean;
  notifyPaymentDay: boolean; // Dia em que o provento está anunciado para pagamento
  notifyExDate: boolean; // Véspera e dia de Data-Com
  notifyConfirmedDividend: boolean; // Novo anúncio confirmado ou alteração confirmada de provento
  notifyImportantNews: boolean;
  notifyMacroNews: boolean;
  notifyMarketSession: boolean;
  notifyPriceOpportunity: boolean; // Quando um FII da carteira fica abaixo do Preço Médio
  notifyMarketBargain: boolean; // Oportunidade na B3
  notifyMentorConsensus: boolean; // Consenso de mentores
  dailyTime: string; // Horário diário HH:MM (inicialmente 08:00)
  timezone: string; // Fuso horário IANA (inicialmente America/Sao_Paulo)
  privacyMode: NotificationPrivacyMode; // Privacidade na tela bloqueada (padrão: 'discreet')
}

export interface ServerPushSubscriptionSummary {
  id: string;
  endpointHash: string;
  deviceLabel?: string | null;
  isActive: boolean;
  deactivatedReason?: string | null;
  lastStatusCode?: number | null;
  lastAcceptedAt?: string | null;
  lastError?: string | null;
  updatedAt?: string;
}

export interface ServerPushStatusSummary {
  lastDigest: {
    status: string;
    localDate: string;
    sentAt: string | null;
    lastError: string | null;
    eventsCount: number;
  } | null;
  lastDelivery: {
    status: string;
    acceptedAt: string | null;
    lastStatusCode: number | null;
    lastError: string | null;
    attemptCount: number;
  } | null;
}

export interface PushHistoryEvent {
  eventType: string;
  ticker: string;
  headline: string;
  source: string;
  date: string;
  sourceUrl: string | null;
}

export interface PushHistoryItem {
  id: string;
  status: string;
  localDate: string;
  createdAt: string | null;
  updatedAt: string | null;
  sentAt: string | null;
  events: PushHistoryEvent[];
  // "accepted" significa aceito pelo serviço Push; não confirma exibição no aparelho.
  deliveries: { accepted: number; failed: number; pending: number; total: number };
}

export interface PushHistoryPage {
  items: PushHistoryItem[];
  nextCursor: string | null;
}

export interface ServerPushPreferencesResponse extends PushPreferences {
  userId: string;
  lastProcessedAt?: string | null;
  lastProcessedLocalDate?: string | null;
  lastProcessStatus?: string | null;
  lastProcessMessage?: string | null;
  lastPushAcceptedAt?: string | null;
  updatedAt?: string;
}

export interface ServerPushState {
  publicKey: string;
  vapidConfigured: boolean;
  cronConfigured: boolean;
  authenticated: boolean;
  preferences: ServerPushPreferencesResponse | null;
  subscriptions: ServerPushSubscriptionSummary[];
  statusSummary: ServerPushStatusSummary | null;
  serverWarning?: string;
  localSubscriptionEndpoint: string | null;
  localEndpointHash: string | null;
  currentDeviceSubscription: ServerPushSubscriptionSummary | null;
}

export interface SmartAlertItem {
  id: string;
  category:
    | 'CONFIRMED_DIVIDEND'
    | 'MARKET_BARGAIN'
    | 'MENTOR_CONSENSUS'
    | 'BELOW_PM'
    | 'EX_DATE'
    | 'PAYMENT_DAY';
  title: string;
  body: string;
  ticker?: string;
  url: string;
  priority: number; // Maior = mais urgente
}

const LEGACY_PREFS_STORAGE_KEY = 'fii_tracker_push_prefs_v2';
const SCOPED_PREFS_PREFIX = 'fii_tracker_push_prefs_v3';
const SUBSCRIPTION_STORAGE_KEY = 'fii_tracker_push_sub';

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  enabled: false,
  notifyPaymentDay: true,
  notifyExDate: true,
  notifyConfirmedDividend: true,
  notifyImportantNews: true,
  notifyMacroNews: true,
  notifyMarketSession: true,
  notifyPriceOpportunity: true,
  notifyMarketBargain: true,
  notifyMentorConsensus: true,
  dailyTime: '08:00',
  timezone: 'America/Sao_Paulo',
  privacyMode: 'discreet',
};

function resolveUserId(explicitUserId?: string | null): string | null {
  if (explicitUserId !== undefined) return explicitUserId;
  if (typeof window !== 'undefined') {
    return getActiveAccount()?.id || null;
  }
  return null;
}

function getScopedPrefsKey(userId?: string | null): string {
  const uid = resolveUserId(userId);
  return uid ? `${SCOPED_PREFS_PREFIX}_${uid}` : LEGACY_PREFS_STORAGE_KEY;
}

function normalizePreferences(raw: Partial<PushPreferences> | null | undefined): PushPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PUSH_PREFERENCES };
  const dailyTime =
    typeof raw.dailyTime === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw.dailyTime.trim())
      ? raw.dailyTime.trim()
      : DEFAULT_PUSH_PREFERENCES.dailyTime;
  const timezone =
    typeof raw.timezone === 'string' && raw.timezone.trim().length > 0
      ? raw.timezone.trim()
      : DEFAULT_PUSH_PREFERENCES.timezone;
  const privacyMode: NotificationPrivacyMode =
    raw.privacyMode === 'detailed' ? 'detailed' : 'discreet';

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_PUSH_PREFERENCES.enabled,
    notifyPaymentDay:
      typeof raw.notifyPaymentDay === 'boolean'
        ? raw.notifyPaymentDay
        : DEFAULT_PUSH_PREFERENCES.notifyPaymentDay,
    notifyExDate:
      typeof raw.notifyExDate === 'boolean'
        ? raw.notifyExDate
        : DEFAULT_PUSH_PREFERENCES.notifyExDate,
    notifyConfirmedDividend:
      typeof raw.notifyConfirmedDividend === 'boolean'
        ? raw.notifyConfirmedDividend
        : DEFAULT_PUSH_PREFERENCES.notifyConfirmedDividend,
    notifyImportantNews: typeof raw.notifyImportantNews === 'boolean' ? raw.notifyImportantNews : DEFAULT_PUSH_PREFERENCES.notifyImportantNews,
    notifyMacroNews: typeof raw.notifyMacroNews === 'boolean' ? raw.notifyMacroNews : DEFAULT_PUSH_PREFERENCES.notifyMacroNews,
    notifyMarketSession: typeof raw.notifyMarketSession === 'boolean' ? raw.notifyMarketSession : DEFAULT_PUSH_PREFERENCES.notifyMarketSession,
    notifyPriceOpportunity:
      typeof raw.notifyPriceOpportunity === 'boolean'
        ? raw.notifyPriceOpportunity
        : DEFAULT_PUSH_PREFERENCES.notifyPriceOpportunity,
    notifyMarketBargain:
      typeof raw.notifyMarketBargain === 'boolean'
        ? raw.notifyMarketBargain
        : DEFAULT_PUSH_PREFERENCES.notifyMarketBargain,
    notifyMentorConsensus:
      typeof raw.notifyMentorConsensus === 'boolean'
        ? raw.notifyMentorConsensus
        : DEFAULT_PUSH_PREFERENCES.notifyMentorConsensus,
    dailyTime,
    timezone,
    privacyMode,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function computeClientEndpointHash(endpoint: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  try {
    const encoded = new TextEncoder().encode(endpoint);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export function detectDeviceLabel(): string {
  if (typeof window === 'undefined') return 'Dispositivo Web';
  const ua = window.navigator.userAgent || '';
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
  const suffix = isStandalone ? ' (PWA)' : ' (Navegador)';

  if (/iphone/i.test(ua)) return `iPhone${suffix}`;
  if (/ipad/i.test(ua)) return `iPad${suffix}`;
  if (/android/i.test(ua)) return `Android${suffix}`;
  if (/macintosh|mac os x/i.test(ua)) return `Mac${suffix}`;
  if (/windows/i.test(ua)) return `Windows${suffix}`;
  if (/linux/i.test(ua)) return `Linux${suffix}`;
  return `Aparelho${suffix}`;
}

export function getPushPreferences(userId?: string | null): PushPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PUSH_PREFERENCES };
  try {
    const scopedKey = getScopedPrefsKey(userId);
    const scopedRaw = localStorage.getItem(scopedKey);
    if (scopedRaw) {
      return normalizePreferences(JSON.parse(scopedRaw));
    }
    const legacyRaw = localStorage.getItem(LEGACY_PREFS_STORAGE_KEY);
    if (legacyRaw) {
      return normalizePreferences(JSON.parse(legacyRaw));
    }
    return { ...DEFAULT_PUSH_PREFERENCES };
  } catch {
    return { ...DEFAULT_PUSH_PREFERENCES };
  }
}

export function hasLocalPushPreferencesToMigrate(userId?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const scopedKey = getScopedPrefsKey(userId);
    return Boolean(
      localStorage.getItem(scopedKey) || localStorage.getItem(LEGACY_PREFS_STORAGE_KEY)
    );
  } catch {
    return false;
  }
}

export function savePushPreferences(prefs: PushPreferences, userId?: string | null): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizePreferences(prefs);
  try {
    const scopedKey = getScopedPrefsKey(userId);
    localStorage.setItem(scopedKey, JSON.stringify(normalized));
    // Mantém compatibilidade com a chave legada para leitura rápida sem escopo
    localStorage.setItem(LEGACY_PREFS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

export function isWebPushSupported(): {
  supported: boolean;
  isIosNeedInstall: boolean;
  permission: NotificationPermission | 'unsupported';
} {
  if (typeof window === 'undefined') {
    return { supported: false, isIosNeedInstall: false, permission: 'unsupported' };
  }

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

  const hasSw = 'serviceWorker' in navigator;
  const hasNotification = 'Notification' in window;

  if (!hasSw || !hasNotification) {
    return {
      supported: false,
      isIosNeedInstall: isIos && !isStandalone,
      permission: 'unsupported',
    };
  }

  return {
    supported: true,
    isIosNeedInstall: false,
    permission: Notification.permission,
  };
}

export async function getBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration || !registration.pushManager) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Consulta o estado de Web Push no servidor para o usuário autenticado e
 * migra preferências locais do localStorage de maneira compatível
 * (usando migrateOnlyIfAbsent: true para NUNCA sobrescrever preferências remotas).
 */
export async function fetchServerPushState(userId?: string | null): Promise<ServerPushState> {
  const localSub = await getBrowserPushSubscription();
  const localEndpoint = localSub?.endpoint || null;
  const localEndpointHash = localEndpoint ? await computeClientEndpointHash(localEndpoint) : null;

  const fallbackState: ServerPushState = {
    publicKey: '',
    vapidConfigured: false,
    cronConfigured: false,
    authenticated: false,
    preferences: null,
    subscriptions: [],
    statusSummary: null,
    localSubscriptionEndpoint: localEndpoint,
    localEndpointHash,
    currentDeviceSubscription: null,
  };

  if (typeof window === 'undefined') return fallbackState;

  try {
    const res = await authenticatedFetch('/api/push', { method: 'GET' });
    if (!res.ok) return fallbackState;
    const data = await res.json();

    let serverPrefs: ServerPushPreferencesResponse | null = data.preferences || null;
    const subscriptions: ServerPushSubscriptionSummary[] = Array.isArray(data.subscriptions)
      ? data.subscriptions
      : [];

    // Migração compatível: se autenticado e ainda não houver preferências remotas salvas no servidor,
    // mas o usuário já tinha preferências no localStorage, migra com migrateOnlyIfAbsent=true.
    if (data.authenticated && !serverPrefs && hasLocalPushPreferencesToMigrate(userId)) {
      const localPrefs = getPushPreferences(userId);
      const subJson = localSub?.toJSON();
      const migratePayload: Record<string, unknown> = {
        preferences: localPrefs,
        migrateOnlyIfAbsent: true,
      };
      if (
        localPrefs.enabled &&
        subJson?.endpoint &&
        subJson.keys?.p256dh &&
        subJson.keys?.auth
      ) {
        migratePayload.subscription = {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          deviceLabel: detectDeviceLabel(),
        };
      }

      const migRes = await authenticatedFetch('/api/push', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(migratePayload),
      });
      if (migRes.ok) {
        const migData = await migRes.json();
        if (migData.preferences) {
          serverPrefs = migData.preferences;
        }
        if (migData.subscription && !subscriptions.some((s) => s.id === migData.subscription.id)) {
          subscriptions.push({
            id: migData.subscription.id,
            endpointHash: migData.subscription.endpointHash,
            deviceLabel: detectDeviceLabel(),
            isActive: migData.subscription.isActive,
          });
        }
      }
    }

    // Se o servidor já possui preferências configuradas, sincroniza o cache local sem sobrescrever o servidor
    if (serverPrefs) {
      savePushPreferences(serverPrefs, userId);
    }

    const currentDeviceSubscription = localEndpointHash
      ? subscriptions.find((s) => s.endpointHash === localEndpointHash) || null
      : null;

    return {
      publicKey: data.publicKey || '',
      vapidConfigured: Boolean(data.vapidConfigured),
      cronConfigured: Boolean(data.cronConfigured),
      authenticated: Boolean(data.authenticated),
      preferences: serverPrefs,
      subscriptions,
      statusSummary: data.statusSummary || null,
      serverWarning: data.serverWarning,
      localSubscriptionEndpoint: localEndpoint,
      localEndpointHash,
      currentDeviceSubscription,
    };
  } catch {
    return fallbackState;
  }
}

export async function fetchServerPushHistory(cursor?: string | null): Promise<PushHistoryPage> {
  const safeCursor = typeof cursor === 'string' && cursor.length <= 256 ? cursor : '';
  if (typeof window === 'undefined') return { items: [], nextCursor: null };

  const query = safeCursor ? `?cursor=${encodeURIComponent(safeCursor)}` : '';
  const response = await authenticatedFetch(`/api/push/history${query}`, { method: 'GET' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Não foi possível carregar o histórico de alertas.');
  }

  const payload = await response.json();
  return {
    items: Array.isArray(payload.items) ? payload.items as PushHistoryItem[] : [],
    nextCursor: typeof payload.nextCursor === 'string' && payload.nextCursor.length <= 256 ? payload.nextCursor : null,
  };
}

export async function syncPushPreferencesToServer(
  prefs: PushPreferences,
  options?: { migrateOnlyIfAbsent?: boolean; userId?: string | null }
): Promise<{
  ok: boolean;
  syncedRemotely: boolean;
  preferences: PushPreferences;
  message?: string;
}> {
  const normalized = normalizePreferences(prefs);
  savePushPreferences(normalized, options?.userId);

  if (typeof window === 'undefined') {
    return { ok: true, syncedRemotely: false, preferences: normalized };
  }

  try {
    const res = await authenticatedFetch('/api/push', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: normalized,
        migrateOnlyIfAbsent: Boolean(options?.migrateOnlyIfAbsent),
      }),
    });

    if (res.status === 401) {
      return {
        ok: true,
        syncedRemotely: false,
        preferences: normalized,
        message:
          'Preferências salvas neste aparelho. Conecte sua conta na nuvem para ativar o envio automático pelo servidor.',
      };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        ok: false,
        syncedRemotely: false,
        preferences: normalized,
        message:
          errData.error || 'Preferências salvas localmente, mas houve falha ao atualizar o servidor.',
      };
    }

    const data = await res.json();
    const remotePrefs = data.preferences
      ? normalizePreferences(data.preferences)
      : normalized;
    savePushPreferences(remotePrefs, options?.userId);

    return {
      ok: true,
      syncedRemotely: true,
      preferences: remotePrefs,
    };
  } catch {
    return {
      ok: false,
      syncedRemotely: false,
      preferences: normalized,
      message: 'Sem conexão com o servidor no momento. Preferências salvas localmente.',
    };
  }
}

export async function registerAndSubscribePush(
  customPrefs?: Partial<PushPreferences>,
  userId?: string | null
): Promise<{
  ok: boolean;
  syncedRemotely?: boolean;
  message: string;
}> {
  const status = isWebPushSupported();
  if (!status.supported) {
    if (status.isIosNeedInstall) {
      return {
        ok: false,
        message:
          'No iPhone, adicione primeiro o app à Tela de Início (Compartilhar -> Adicionar à Tela de Início) para liberar notificações da Apple.',
      };
    }
    return {
      ok: false,
      message: 'Este navegador não suporta notificações Web Push.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        ok: false,
        message: 'Permissão de notificação negada nas configurações do aparelho.',
      };
    }

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;

    const keyRes = await authenticatedFetch('/api/push', { method: 'GET' });
    const keyData = await keyRes.json();
    const publicKey = keyData.publicKey;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription && publicKey) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey.buffer as ArrayBuffer,
      });
    }

    if (!subscription) {
      return {
        ok: false,
        message: 'Não foi possível obter a inscrição Push do navegador.',
      };
    }

    const subJson = subscription.toJSON();
    try {
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(subJson));
    } catch {
      // ignore
    }

    const currentPrefs = getPushPreferences(userId);
    const updatedPrefs = normalizePreferences({
      ...currentPrefs,
      ...customPrefs,
      enabled: true,
    });
    savePushPreferences(updatedPrefs, userId);

    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return {
        ok: false,
        message: 'Chaves de criptografia Web Push ausentes neste navegador.',
      };
    }

    const saveRes = await authenticatedFetch('/api/push', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: updatedPrefs,
        subscription: {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          deviceLabel: detectDeviceLabel(),
        },
      }),
    });

    if (saveRes.status === 401) {
      return {
        ok: true,
        syncedRemotely: false,
        message:
          'Permissão concedida neste aparelho! Faça login na Nuvem para receber alertas em segundo plano com o app fechado.',
      };
    }

    if (!saveRes.ok) {
      const errBody = await saveRes.json().catch(() => ({}));
      return {
        ok: false,
        syncedRemotely: false,
        message:
          errBody.error ||
          'Inscrição criada no navegador, mas não foi possível registrá-la no servidor.',
      };
    }

    const saveData = await saveRes.json();
    if (saveData.preferences) {
      savePushPreferences(saveData.preferences, userId);
    }

    return {
      ok: true,
      syncedRemotely: true,
      message: 'Inscrição Web Push registrada no servidor para este aparelho!',
    };
  } catch (err) {
    console.error('Erro ao ativar Web Push:', err);
    return {
      ok: false,
      message: 'Não foi possível registrar o Push. Verifique se o app está na Tela de Início.',
    };
  }
}

export async function unsubscribeDevicePush(options?: {
  subscriptionId?: string;
  disablePreferencesIfLast?: boolean;
  userId?: string | null;
}): Promise<{
  ok: boolean;
  message: string;
}> {
  if (typeof window === 'undefined') {
    return { ok: false, message: 'Ambiente inválido.' };
  }

  try {
    let targetEndpoint: string | undefined;
    if (!options?.subscriptionId) {
      const sub = await getBrowserPushSubscription();
      if (sub) {
        targetEndpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
      }
      try {
        localStorage.removeItem(SUBSCRIPTION_STORAGE_KEY);
      } catch {
        // ignore
      }
    }

    const target = options?.subscriptionId || targetEndpoint;
    if (target) {
      const res = await authenticatedFetch('/api/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: options?.subscriptionId,
          endpoint: targetEndpoint,
          disablePreferences: Boolean(options?.disablePreferencesIfLast),
        }),
      });

      if (!res.ok && res.status !== 401) {
        const errData = await res.json().catch(() => ({}));
        return {
          ok: false,
          message: errData.error || 'Não foi possível remover a inscrição no servidor.',
        };
      }
    }

    if (options?.disablePreferencesIfLast) {
      const prefs = getPushPreferences(options?.userId);
      savePushPreferences({ ...prefs, enabled: false }, options?.userId);
    }

    return {
      ok: true,
      message: 'Inscrição deste aparelho removida com sucesso.',
    };
  } catch {
    return {
      ok: false,
      message: 'Falha ao remover inscrição Web Push.',
    };
  }
}

export async function sendPushNotificationNow(
  payload: {
    title: string;
    body: string;
    tag?: string;
    url?: string;
  },
  delaySeconds = 0
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const res = await authenticatedFetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          payload,
          delaySeconds,
        }),
      });
      if (res.ok) return true;
    }

    // Fallback via Service Worker local para teste imediato quando sem sessão de nuvem
    if (registration.active) {
      registration.active.postMessage({
        type: 'SHOW_NOTIFICATION',
        delayMs: delaySeconds * 1000,
        payload,
      });
      return true;
    }
  } catch (err) {
    console.warn('Falha ao disparar notificação Push:', err);
  }
  return false;
}

const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

// Escaneia a Carteira e o Radar para visualização local e botão de teste
export function scanSmartAlerts(
  positions: FiiPosition[],
  quotes: Record<string, QuoteData> = {}
): SmartAlertItem[] {
  const prefs = getPushPreferences();
  const isDetailed = prefs.privacyMode === 'detailed';
  const alerts: SmartAlertItem[] = [];
  const now = new Date();
  const todayDay = now.getDate();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { events } = calculateMonthDividends(positions, now);
  const evaluatedMarket = evaluateAllFiis(quotes, positions).filter(
    (f) => !f.isDistressedWarning && f.qualityTier !== 'ALERTA_RISCO' && Boolean(quotes[f.ticker]?.price)
  );
  const { consensus } = evaluateMentorsRecommendations(quotes, positions, 400);

  // 1. PAGAMENTO ANUNCIADO PARA HOJE
  if (prefs.notifyPaymentDay && events.length > 0) {
    const payingToday = events.filter((ev) => ev.paymentDay === todayDay && ev.isOfficial);
    if (payingToday.length > 0) {
      const totalToday = payingToday.reduce((acc, e) => acc + e.totalValue, 0);
      const tickers = payingToday.map((e) => e.ticker).join(', ');
      const firstTicker = payingToday[0].ticker;
      alerts.push({
        id: `pay-${yearMonth}-${todayDay}`,
        category: 'PAYMENT_DAY',
        ticker: firstTicker,
        title: isDetailed
          ? `💰 Pagamento anunciado para hoje (${formatBRL(totalToday)})`
          : `💰 Pagamento anunciado para hoje (${tickers})`,
        body: isDetailed
          ? `${tickers} ${
              payingToday.length === 1 ? 'tem' : 'têm'
            } ${formatBRL(totalToday)} anunciados para hoje. Confira o lançamento no extrato.`
          : `${tickers} ${
              payingToday.length === 1 ? 'tem' : 'têm'
            } pagamento de proventos anunciado para hoje. Confira o lançamento no extrato.`,
        url: buildSafePushUrl({
          tab: 'proventos',
          ticker: firstTicker,
          eventType: 'PAYMENT_REMINDER',
        }),
        priority: 100,
      });
    }
  }

  // 2. ANÚNCIO OFICIAL DE DIVIDENDO E DATA-COM CONFIRMADA NA B3
  if (prefs.notifyConfirmedDividend) {
    const confirmedPositions = positions.filter(
      (p) =>
        p.dividendSource === 'B3_OFICIAL' &&
        p.isCurrentMonthAnnounced &&
        p.monthlyDividendPerShare > 0
    );

    for (const pos of confirmedPositions) {
      alerts.push({
        id: `confirmed-div-${yearMonth}-${pos.ticker}-${pos.monthlyDividendPerShare}`,
        category: 'CONFIRMED_DIVIDEND',
        ticker: pos.ticker,
        title: `📢 ${pos.ticker} Confirmou Rendimento: ${formatBRL(pos.monthlyDividendPerShare)}/cota`,
        body: `Comunicado confirmado! Data-Com: ${
          pos.dividendExDate || 'neste mês'
        } • Pagamento: ${
          pos.dividendPaymentDate || `dia ${pos.dividendPaymentDay || 15}`
        }. Toque para abrir em Proventos.`,
        url: buildSafePushUrl({
          tab: 'proventos',
          ticker: pos.ticker,
          eventType: 'DIVIDEND_ANNOUNCED',
        }),
        priority: 92,
      });
    }

    for (const [ticker, q] of Object.entries(quotes)) {
      const alreadyInCarteira = confirmedPositions.some((p) => p.ticker === ticker);
      if (
        !alreadyInCarteira &&
        q.dividendSource === 'B3_OFICIAL' &&
        q.isCurrentMonthAnnounced &&
        q.lastDividend &&
        q.lastDividend > 0
      ) {
        const yieldPct = q.price > 0 ? ((q.lastDividend / q.price) * 100).toFixed(2) : '0.90';
        alerts.push({
          id: `confirmed-radar-${yearMonth}-${ticker}-${q.lastDividend}`,
          category: 'CONFIRMED_DIVIDEND',
          ticker,
          title: `📢 Dividendo Anunciado na B3: ${ticker} (${formatBRL(q.lastDividend)}/cota)`,
          body: `Yield de ${yieldPct}% no mês! Data-Com: ${
            q.dividendExDate || 'confira no Radar'
          } • Pagamento: ${q.dividendPaymentDate || 'próximos dias'}.`,
          url: '/?tab=radar',
          priority: 82,
        });
      }
    }
  }

  // 3. DATA-COM PRÓXIMA
  if (prefs.notifyExDate) {
    const getExDay = (ticker: string, announcementDate?: string) => {
      if (announcementDate && /^\d{2}\/\d{2}/.test(announcementDate)) {
        return parseInt(announcementDate.slice(0, 2), 10);
      }
      return findFiiInfo(ticker).announcementDay ?? 30;
    };

    const exSoonCarteira = events.filter((ev) => {
      const exDay = getExDay(ev.ticker, ev.announcementDate);
      return ev.isOfficial && exDay >= todayDay && exDay <= todayDay + 2;
    });

    if (exSoonCarteira.length > 0) {
      const tickers = exSoonCarteira.map((e) => e.ticker).join(', ');
      const firstTicker = exSoonCarteira[0].ticker;
      const isToday = exSoonCarteira.some(
        (e) => getExDay(e.ticker, e.announcementDate) === todayDay
      );
      alerts.push({
        id: `ex-carteira-${yearMonth}-${todayDay}`,
        category: 'EX_DATE',
        ticker: firstTicker,
        title: `⚡ ${isToday ? 'Data-Com Hoje na B3!' : 'Data-Com nos Próximos Dias!'}`,
        body: `FIIs da carteira (${tickers}) com Data-Com próxima. Confira as datas de corte e pagamento em Proventos.`,
        url: buildSafePushUrl({
          tab: 'proventos',
          ticker: firstTicker,
          eventType: 'EX_DATE_REMINDER',
        }),
        priority: 90,
      });
    } else {
      const radarExSoon = evaluatedMarket.filter(
        (f) =>
          Boolean(quotes[f.ticker]?.isCurrentMonthAnnounced && quotes[f.ticker]?.dividendExDate) &&
          f.daysUntilExDate <= 3 &&
          f.pvp <= 1.0 &&
          f.monthlyYieldPercent >= 0.85
      );
      if (radarExSoon.length > 0) {
        const top = radarExSoon[0];
        alerts.push({
          id: `ex-radar-${yearMonth}-${top.ticker}-${todayDay}`,
          category: 'EX_DATE',
          ticker: top.ticker,
          title: `⚡ Oportunidade c/ Data-Com Próxima: ${top.ticker}`,
          body: `${top.ticker} fecha Data-Com ${
            top.daysUntilExDate === 0 ? 'hoje' : `em ${top.daysUntilExDate} dias`
          } (dia ${top.announcementDay})! Cotado a ${formatBRL(top.currentPrice)} (P/VP ${
            top.pvp
          }) e pagando ${formatBRL(top.monthlyDividend)}/cota.`,
          url: '/?tab=radar',
          priority: 86,
        });
      }
    }
  }

  // 4. SUPER OPORTUNIDADE / BARGANHA NA B3
  if (prefs.notifyMarketBargain) {
    const bargains = evaluatedMarket
      .filter(
        (f) =>
          (f.pvp <= 0.96 && f.monthlyYieldPercent >= 0.85) ||
          (f.currentPrice <= f.ceilingPrice * 0.95 && f.pvp <= 1.0)
      )
      .sort((a, b) => a.pvp - b.pvp);

    for (const b of bargains.slice(0, 2)) {
      alerts.push({
        id: `bargain-${yearMonth}-${b.ticker}-${b.currentPrice.toFixed(1)}`,
        category: 'MARKET_BARGAIN',
        ticker: b.ticker,
        title: `🔥 Oportunidade na B3: ${b.ticker} com ${b.discountPercent}% de Desconto!`,
        body: `Cotado a ${formatBRL(b.currentPrice)} (abaixo do VP de ${formatBRL(
          b.vp
        )}, P/VP ${b.pvp}) e entregando ${b.monthlyYieldPercent}% a.m. (${
          b.annualYieldPercent
        }% a.a. estimado). Preço-Teto: ${formatBRL(b.ceilingPrice)}.`,
        url: '/?tab=radar',
        priority: 88,
      });
    }
  }

  // 5. CONSENSO DOS MENTORES
  if (prefs.notifyMentorConsensus && consensus.length > 0) {
    const topConsensus = consensus[0];
    const mentorNames = topConsensus.mentors
      .map((m) => (m.name.startsWith('Prof.') ? 'Prof. Baroni' : m.name.split(' ')[1] || m.name))
      .join(' + ');

    alerts.push({
      id: `consensus-${yearMonth}-${topConsensus.fii.ticker}`,
      category: 'MENTOR_CONSENSUS',
      ticker: topConsensus.fii.ticker,
      title: `🏆 Consenso dos Mentores: ${topConsensus.fii.ticker} a ${formatBRL(
        topConsensus.fii.currentPrice
      )}`,
      body: `Indicado hoje por ${mentorNames}! P/VP ${topConsensus.fii.pvp} • Yield ${
        topConsensus.fii.monthlyYieldPercent
      }% a.m. (${formatBRL(topConsensus.fii.monthlyDividend)}/cota).`,
      url: '/?tab=mentors',
      priority: 84,
    });
  }

  // 6. QUEDA ABAIXO DO PREÇO MÉDIO NA CARTEIRA (respeita privacidade discreta)
  if (prefs.notifyPriceOpportunity && positions.length > 0) {
    const belowPm = positions
      .filter((p) => p.currentPrice < p.averagePrice * 0.995)
      .sort(
        (a, b) =>
          (a.currentPrice - a.averagePrice) / a.averagePrice -
          (b.currentPrice - b.averagePrice) / b.averagePrice
      );

    if (belowPm.length > 0) {
      const top = belowPm[0];
      const dropPct = Math.abs(
        Number((((top.currentPrice - top.averagePrice) / top.averagePrice) * 100).toFixed(1))
      );
      alerts.push({
        id: `below-pm-${yearMonth}-${top.ticker}-${top.currentPrice.toFixed(1)}`,
        category: 'BELOW_PM',
        ticker: top.ticker,
        title: `📉 ${top.ticker} está abaixo da sua referência de preço`,
        body: isDetailed
          ? `Cotado hoje a ${formatBRL(top.currentPrice)} na B3 (${dropPct}% abaixo do seu PM de ${formatBRL(
              top.averagePrice
            )}).`
          : `${top.ticker} é negociado hoje a ${formatBRL(
              top.currentPrice
            )} na B3. Abra o app para revisar os fundamentos.`,
        url: '/?tab=portfolio',
        priority: 85,
      });
    }
  }

  return alerts.sort((a, b) => b.priority - a.priority);
}

// Retorna o alerta para teste manual do botão de notificações (respeitando o modo discreto por padrão)
export function buildPortfolioDailyAlert(
  positions: FiiPosition[],
  quotes: Record<string, QuoteData> = {}
): {
  title: string;
  body: string;
  tag: string;
  url?: string;
} | null {
  const smartAlerts = scanSmartAlerts(positions, quotes);
  if (smartAlerts.length > 0) {
    const best = smartAlerts[0];
    return {
      title: best.title,
      body: best.body,
      tag: best.id,
      url: best.url,
    };
  }

  if (positions.length === 0) return null;
  const prefs = getPushPreferences();
  const firstTicker = positions[0]?.ticker;
  const targetUrl = buildSafePushUrl({
    tab: 'proventos',
    ticker: firstTicker,
  });

  if (prefs.privacyMode === 'detailed') {
    const { summary } = calculateMonthDividends(positions, new Date());
    return {
      title: `📊 Teste FII Tracker • ${formatBRL(summary.totalExpected)}/mês`,
      body: `Sua carteira de ${positions.length} FIIs projeta ${formatBRL(
        summary.totalExpected
      )} no calendário atual. Toque para abrir em Proventos.`,
      tag: 'fii-summary-daily-test',
      url: targetUrl,
    };
  }

  return {
    title: '📊 Teste FII Tracker • Notificação Discreta',
    body: 'Seus alertas de proventos estão configurados. Toque para abrir o calendário de Proventos.',
    tag: 'fii-summary-daily-test',
    url: targetUrl,
  };
}

/**
 * O envio automático diário foi transferido para o servidor (/api/push/cron)
 * para funcionar com o PWA fechado e evitar disparos duplicados pelo cliente.
 * Mantido como no-op por compatibilidade de assinatura.
 */
export async function runAutoDailyPushCheck(
  _positions?: FiiPosition[],
  _quotes?: Record<string, QuoteData>
): Promise<void> {
  void _positions;
  void _quotes;
  return;
}
