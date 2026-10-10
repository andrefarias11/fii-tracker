import { FiiPosition } from '../types/portfolio';
import { calculateMonthDividends } from '../data/fiiDividendCalendar';
import { findFiiInfo } from '../data/fiiDatabase';

export interface PushPreferences {
  enabled: boolean;
  notifyExDate: boolean;
  notifyPaymentDay: boolean;
  notifyPriceOpportunity: boolean;
}

const PREFS_STORAGE_KEY = 'fii_tracker_push_prefs';
const SUBSCRIPTION_STORAGE_KEY = 'fii_tracker_push_sub';
const LAST_AUTO_ALERT_KEY = 'fii_tracker_last_auto_alert_date';

const DEFAULT_PREFS: PushPreferences = {
  enabled: false,
  notifyExDate: true,
  notifyPaymentDay: true,
  notifyPriceOpportunity: true,
};

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

export function getPushPreferences(): PushPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePushPreferences(prefs: PushPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
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

export async function registerAndSubscribePush(): Promise<{
  ok: boolean;
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

    // Busca chave pública VAPID no servidor
    const keyRes = await fetch('/api/push');
    const { publicKey } = await keyRes.json();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription && publicKey) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey.buffer as ArrayBuffer,
      });
    }

    if (subscription) {
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(subscription.toJSON()));
    }

    const prefs = getPushPreferences();
    savePushPreferences({ ...prefs, enabled: true });

    return {
      ok: true,
      message: 'Notificações Web Push ativadas com sucesso neste aparelho!',
    };
  } catch (err) {
    console.error('Erro ao ativar Web Push:', err);
    return {
      ok: false,
      message: 'Não foi possível registrar o Push. Verifique se o app está na Tela de Início.',
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
      const res = await fetch('/api/push', {
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

    // Fallback via Service Worker local (funciona mesmo sem conexão externa)
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

// Gera o resumo inteligente de alertas do dia com base na carteira real da B3
export function buildPortfolioDailyAlert(positions: FiiPosition[]): {
  title: string;
  body: string;
  tag: string;
} | null {
  if (positions.length === 0) return null;

  const prefs = getPushPreferences();
  const now = new Date();
  const todayDay = now.getDate();
  const { events, summary } = calculateMonthDividends(positions, now);

  // 1. Verifica se hoje algum FII paga dividendos na conta
  if (prefs.notifyPaymentDay) {
    const payingToday = events.filter((ev) => ev.paymentDay === todayDay);
    if (payingToday.length > 0) {
      const totalToday = payingToday.reduce((acc, e) => acc + e.totalValue, 0);
      const tickers = payingToday.map((e) => e.ticker).join(', ');
      return {
        title: `💰 Dividendos na Conta Hoje (${formatBRL(totalToday)})`,
        body: `${tickers} ${
          payingToday.length === 1 ? 'paga' : 'pagam'
        } ${formatBRL(totalToday)} isentos de IR hoje! Toque para ver o calendário.`,
        tag: `fii-pay-${todayDay}`,
      };
    }
  }

  // 2. Verifica se hoje ou amanhã é Data-Com de algum FII da carteira
  if (prefs.notifyExDate) {
    const getExDay = (ticker: string, announcementDate?: string) => {
      if (announcementDate && /^\d{2}\/\d{2}/.test(announcementDate)) {
        return parseInt(announcementDate.slice(0, 2), 10);
      }
      return findFiiInfo(ticker).announcementDay ?? 30;
    };

    const exSoon = events.filter((ev) => {
      const exDay = getExDay(ev.ticker, ev.announcementDate);
      return exDay === todayDay || exDay === todayDay + 1;
    });

    if (exSoon.length > 0) {
      const tickers = exSoon.map((e) => e.ticker).join(', ');
      const isToday = exSoon.some(
        (e) => getExDay(e.ticker, e.announcementDate) === todayDay
      );
      return {
        title: `⚡ ${isToday ? 'Data-Com Hoje na B3!' : 'Data-Com Amanhã na B3!'}`,
        body: `Fique atento: ${tickers} ${
          isToday ? 'define hoje' : 'define amanhã'
        } a lista de cotistas que recebem os proventos do mês.`,
        tag: `fii-ex-${todayDay}`,
      };
    }
  }

  // 3. Verifica se há FIIs negociando abaixo do Preço Médio do usuário
  if (prefs.notifyPriceOpportunity) {
    const discounted = positions.filter((p) => p.currentPrice < p.averagePrice * 0.99);
    if (discounted.length > 0) {
      const top = discounted[0];
      return {
        title: `📉 ${top.ticker} abaixo do seu Preço Médio`,
        body: `${top.ticker} está cotado a ${formatBRL(
          top.currentPrice
        )} na B3 (seu PM é ${formatBRL(top.averagePrice)}). Renda prevista no mês: ${formatBRL(
          summary.totalExpected
        )}.`,
        tag: `fii-pm-${top.ticker}`,
      };
    }
  }

  return {
    title: `📊 Resumo FII Tracker • ${formatBRL(summary.totalExpected)}/mês`,
    body: `Sua carteira de ${positions.length} FIIs projeta ${formatBRL(
      summary.totalExpected
    )} de dividendos isentos neste mês.`,
    tag: 'fii-summary-daily',
  };
}

export async function runAutoDailyPushCheck(positions: FiiPosition[]): Promise<void> {
  if (typeof window === 'undefined' || positions.length === 0) return;

  const prefs = getPushPreferences();
  if (!prefs.enabled) return;

  const todayKey = new Date().toISOString().slice(0, 10);
  const lastSent = localStorage.getItem(LAST_AUTO_ALERT_KEY);
  if (lastSent === todayKey) return;

  const alertData = buildPortfolioDailyAlert(positions);
  if (!alertData) return;

  // Só dispara automaticamente se for um evento relevante (pagamento hoje, data-com ou oportunidade)
  if (alertData.tag !== 'fii-summary-daily') {
    const sent = await sendPushNotificationNow(alertData, 0);
    if (sent) {
      localStorage.setItem(LAST_AUTO_ALERT_KEY, todayKey);
    }
  }
}
