import { FiiPosition, QuoteData } from '../types/portfolio';
import { calculateMonthDividends } from '../data/fiiDividendCalendar';
import { findFiiInfo } from '../data/fiiDatabase';
import { evaluateAllFiis } from './recommendationEngine';
import { evaluateMentorsRecommendations } from './mentorEngine';

export interface PushPreferences {
  enabled: boolean;
  notifyPaymentDay: boolean; // Dia em que o dividendo cai na conta
  notifyExDate: boolean; // Véspera e dia de Data-Com (Carteira + Oportunidades)
  notifyConfirmedDividend: boolean; // Quando o FII confirma oficialmente o valor e Data-Com na B3
  notifyPriceOpportunity: boolean; // Quando um FII da carteira fica abaixo do seu Preço Médio
  notifyMarketBargain: boolean; // Super oportunidade na B3 (P/VP muito descontado mesmo após bater a meta)
  notifyMentorConsensus: boolean; // Quando um FII entra no Consenso de Barsi / Buffett / Graham
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

const PREFS_STORAGE_KEY = 'fii_tracker_push_prefs_v2';
const SUBSCRIPTION_STORAGE_KEY = 'fii_tracker_push_sub';
const SENT_ALERTS_STORAGE_KEY = 'fii_tracker_sent_alerts_v2';

const DEFAULT_PREFS: PushPreferences = {
  enabled: false,
  notifyPaymentDay: true,
  notifyExDate: true,
  notifyConfirmedDividend: true,
  notifyPriceOpportunity: true,
  notifyMarketBargain: true,
  notifyMentorConsensus: true,
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

    // Fallback via Service Worker local
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

// Escaneia tanto a Carteira do usuário quanto todas as Oportunidades da B3 em tempo real
export function scanSmartAlerts(
  positions: FiiPosition[],
  quotes: Record<string, QuoteData> = {}
): SmartAlertItem[] {
  const prefs = getPushPreferences();
  const alerts: SmartAlertItem[] = [];
  const now = new Date();
  const todayDay = now.getDate();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { events } = calculateMonthDividends(positions, now);
  const evaluatedMarket = evaluateAllFiis(quotes, positions);
  const { consensus } = evaluateMentorsRecommendations(quotes, positions, 400);

  // 1. PAGAMENTO HOJE NA CONTA
  if (prefs.notifyPaymentDay && events.length > 0) {
    const payingToday = events.filter((ev) => ev.paymentDay === todayDay);
    if (payingToday.length > 0) {
      const totalToday = payingToday.reduce((acc, e) => acc + e.totalValue, 0);
      const tickers = payingToday.map((e) => e.ticker).join(', ');
      alerts.push({
        id: `pay-${yearMonth}-${todayDay}`,
        category: 'PAYMENT_DAY',
        title: `💰 Dividendos na Conta Hoje (${formatBRL(totalToday)})`,
        body: `${tickers} ${
          payingToday.length === 1 ? 'paga' : 'pagam'
        } ${formatBRL(totalToday)} isentos de IR hoje na sua corretora!`,
        url: '/?tab=proventos',
        priority: 100,
      });
    }
  }

  // 2. ANÚNCIO OFICIAL DE DIVIDENDO E DATA-COM CONFIRMADA NA B3
  if (prefs.notifyConfirmedDividend) {
    // Checa primeiro os FIIs da carteira que confirmaram comunicado oficial no mês
    const confirmedPositions = positions.filter(
      (p) => p.isCurrentMonthAnnounced && p.monthlyDividendPerShare > 0
    );

    for (const pos of confirmedPositions) {
      alerts.push({
        id: `confirmed-div-${yearMonth}-${pos.ticker}-${pos.monthlyDividendPerShare}`,
        category: 'CONFIRMED_DIVIDEND',
        ticker: pos.ticker,
        title: `📢 ${pos.ticker} Confirmou Rendimento: ${formatBRL(pos.monthlyDividendPerShare)}/cota`,
        body: `Comunicado B3 confirmado! Data-Com: ${
          pos.dividendExDate || 'neste mês'
        } • Pagamento: ${
          pos.dividendPaymentDate || `dia ${pos.dividendPaymentDay || 15}`
        }. Você receberá ${formatBRL(pos.totalMonthlyDividend)}.`,
        url: '/?tab=proventos',
        priority: 92,
      });
    }

    // Checa também FIIs do Radar que anunciaram dividendo oficial na B3
    for (const [ticker, q] of Object.entries(quotes)) {
      const alreadyInCarteira = confirmedPositions.some((p) => p.ticker === ticker);
      if (!alreadyInCarteira && q.isCurrentMonthAnnounced && q.lastDividend && q.lastDividend > 0) {
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

  // 3. DATA-COM PRÓXIMA (Carteira + FIIs Descontados no Radar para dar tempo de comprar!)
  if (prefs.notifyExDate) {
    const getExDay = (ticker: string, announcementDate?: string) => {
      if (announcementDate && /^\d{2}\/\d{2}/.test(announcementDate)) {
        return parseInt(announcementDate.slice(0, 2), 10);
      }
      return findFiiInfo(ticker).announcementDay ?? 30;
    };

    const exSoonCarteira = events.filter((ev) => {
      const exDay = getExDay(ev.ticker, ev.announcementDate);
      return exDay >= todayDay && exDay <= todayDay + 2;
    });

    if (exSoonCarteira.length > 0) {
      const tickers = exSoonCarteira.map((e) => e.ticker).join(', ');
      const isToday = exSoonCarteira.some(
        (e) => getExDay(e.ticker, e.announcementDate) === todayDay
      );
      alerts.push({
        id: `ex-carteira-${yearMonth}-${todayDay}`,
        category: 'EX_DATE',
        title: `⚡ ${isToday ? 'Data-Com Hoje na B3!' : 'Data-Com nos Próximos Dias!'}`,
        body: `Quem comprar cotas de ${tickers} até o fechamento da Data-Com já garante o próximo dividendo isento!`,
        url: '/?tab=radar',
        priority: 90,
      });
    } else {
      // Verifica se há algum FII barato no Radar com Data-Com em até 3 dias
      const radarExSoon = evaluatedMarket.filter(
        (f) => f.daysUntilExDate <= 3 && f.pvp <= 1.0 && f.monthlyYieldPercent >= 0.85
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

  // 4. SUPER OPORTUNIDADE / BARGANHA NA B3 (Mesmo com meta batida, avisa quando um FII fica muito barato!)
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
        }% a.a. isento). Preço-Teto: ${formatBRL(b.ceilingPrice)}.`,
        url: '/?tab=radar',
        priority: 88,
      });
    }
  }

  // 5. CONSENSO DOS MENTORES (Aprovado simultaneamente por Barsi / Buffett / Graham / Baroni)
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

  // 6. QUEDA ABAIXO DO SEU PREÇO MÉDIO NA CARTEIRA
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
        title: `📉 ${top.ticker} está ${dropPct}% abaixo do seu Preço Médio`,
        body: `Cotado hoje a ${formatBRL(top.currentPrice)} na B3 (seu PM é ${formatBRL(
          top.averagePrice
        )}). Ótima janela para reduzir seu custo médio!`,
        url: '/?tab=portfolio',
        priority: 85,
      });
    }
  }

  return alerts.sort((a, b) => b.priority - a.priority);
}

// Retorna o alerta mais importante do momento para disparo imediato ou teste na Tela Bloqueada
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
  const { summary } = calculateMonthDividends(positions, new Date());
  return {
    title: `📊 Resumo FII Tracker • ${formatBRL(summary.totalExpected)}/mês`,
    body: `Sua carteira de ${positions.length} FIIs projeta ${formatBRL(
      summary.totalExpected
    )} de dividendos isentos neste mês.`,
    tag: 'fii-summary-daily',
    url: '/?tab=proventos',
  };
}

// Verifica automaticamente novas oportunidades ou anúncios de Data-Com e envia Push se ainda não enviou
export async function runAutoDailyPushCheck(
  positions: FiiPosition[],
  quotes: Record<string, QuoteData> = {}
): Promise<void> {
  if (typeof window === 'undefined') return;

  const prefs = getPushPreferences();
  if (!prefs.enabled) return;

  const alerts = scanSmartAlerts(positions, quotes);
  if (alerts.length === 0) return;

  let sentMap: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(SENT_ALERTS_STORAGE_KEY);
    if (raw) sentMap = JSON.parse(raw);
  } catch {
    sentMap = {};
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  // Procura o alerta de maior prioridade que ainda não foi notificado hoje
  const nextAlert = alerts.find((a) => sentMap[a.id] !== todayIso);
  if (!nextAlert) return;

  const sent = await sendPushNotificationNow(
    {
      title: nextAlert.title,
      body: nextAlert.body,
      tag: nextAlert.id,
      url: nextAlert.url,
    },
    0
  );

  if (sent) {
    sentMap[nextAlert.id] = todayIso;
    try {
      localStorage.setItem(SENT_ALERTS_STORAGE_KEY, JSON.stringify(sentMap));
    } catch {
      // ignore
    }
  }
}
