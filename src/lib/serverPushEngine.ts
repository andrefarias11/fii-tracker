import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Transaction } from '../types/portfolio';
import { normalizeTransactionForSplit } from '../domain/portfolioEngine';
import { normalizeB3Ticker } from './ticker';
import { unscopeIdFromUser } from './supabase';
import { buildSafePushUrl, type PushAlertEventType } from './pushNavigation';
import {
  buildVerifiedAnnouncement,
  type VerifiedDividendAnnouncement,
} from './marketDividendSource';
import type {
  WebPushPayloadInput,
  WebPushSendResult,
  WebPushSubscriptionInput,
} from './webPushCrypto';

export type NotificationPrivacyMode = 'discreet' | 'detailed';

export type UserProcessStatus =
  | 'idle'
  | 'no_events'
  | 'queued'
  | 'sent'
  | 'partial_failure'
  | 'failed'
  | 'skipped_no_devices';

export interface ServerPushPreferences {
  userId: string;
  enabled: boolean;
  notifyConfirmedDividend: boolean;
  notifyExDate: boolean;
  notifyPaymentDay: boolean;
  notifyPriceOpportunity: boolean;
  notifyMarketBargain: boolean;
  notifyMentorConsensus: boolean;
  dailyTime: string; // HH:MM
  timezone: string; // IANA
  privacyMode: NotificationPrivacyMode;
  lastProcessedAt?: string | null;
  lastProcessedLocalDate?: string | null;
  lastProcessStatus?: UserProcessStatus | null;
  lastProcessMessage?: string | null;
  lastPushAcceptedAt?: string | null;
  updatedAt?: string;
}

export interface StoredPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  deviceLabel?: string | null;
  isActive: boolean;
  deactivatedReason?: string | null;
  lastStatusCode?: number | null;
  lastAcceptedAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoredAlertEvent {
  id: string;
  userId: string;
  ticker: string;
  eventType: PushAlertEventType;
  eventReference: string;
  dataVersion: string;
  source: string;
  sourceEventDate: string;
  payload: Record<string, unknown>;
  digestId?: string | null;
  status: 'reserved' | 'sent' | 'failed';
}

export interface CandidateAlertEvent {
  ticker: string;
  eventType: PushAlertEventType;
  eventReference: string;
  dataVersion: string;
  source: 'STATUS_INVEST' | 'BRAPI';
  sourceEventDate: string;
  amountPerShare: number;
  exDate: string;
  exDateBr: string;
  paymentDate: string;
  paymentDateBr: string;
  eligibleShares: number;
  personalTotalAmount: number;
  previousAmountPerShare?: number;
  previousExDate?: string;
  previousPaymentDate?: string;
  priority: number;
}

export interface StoredDailyDigest {
  id: string;
  userId: string;
  localDate: string;
  digestKey: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  eventsJson: CandidateAlertEvent[];
  status: 'processing' | 'sent' | 'retry_pending' | 'failed' | 'skipped_no_devices';
  attemptCount: number;
  nextAttemptAt: string;
  lockedBy?: string | null;
  lockedUntil?: string | null;
  sentAt?: string | null;
  lastError?: string | null;
}

export interface StoredDeviceDelivery {
  id: string;
  digestId: string;
  subscriptionId: string;
  userId: string;
  status:
    | 'pending'
    | 'sending'
    | 'accepted'
    | 'retry_pending'
    | 'failed_permanent'
    | 'expired_subscription';
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastStatusCode?: number | null;
  lastError?: string | null;
  acceptedAt?: string | null;
  subscription?: StoredPushSubscription;
}

export interface PushStorageAdapter {
  listCandidateUsers(nowIso: string): Promise<ServerPushPreferences[]>;
  getUserPreferences(userId: string): Promise<ServerPushPreferences | null>;
  upsertUserPreferences(
    userId: string,
    prefs: Partial<ServerPushPreferences>,
    options?: { onlyIfAbsent?: boolean; nowIso?: string }
  ): Promise<ServerPushPreferences>;
  listUserSubscriptions(userId: string, onlyActive?: boolean): Promise<StoredPushSubscription[]>;
  upsertUserSubscription(
    userId: string,
    sub: {
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent?: string | null;
      deviceLabel?: string | null;
    },
    nowIso?: string
  ): Promise<StoredPushSubscription>;
  deactivateUserSubscription(
    userId: string,
    subscriptionIdOrEndpoint: string,
    reason: string,
    statusCode?: number | null,
    nowIso?: string
  ): Promise<boolean>;
  deleteUserSubscription(userId: string, endpointOrId: string): Promise<boolean>;
  getUserTransactions(userId: string): Promise<Transaction[]>;
  claimUserLock(
    userId: string,
    workerId: string,
    leaseSeconds: number,
    nowIso: string
  ): Promise<boolean>;
  releaseUserLock(userId: string, workerId: string): Promise<void>;
  getExistingAlertEvents(userId: string): Promise<StoredAlertEvent[]>;
  getRecoverableDigests(userId: string, nowIso: string): Promise<StoredDailyDigest[]>;
  reserveDigestAndEvents(params: {
    userId: string;
    localDate: string;
    digestKey: string;
    title: string;
    body: string;
    url: string;
    tag: string;
    events: CandidateAlertEvent[];
    workerId: string;
    leaseSeconds: number;
    nowIso: string;
  }): Promise<{ digest: StoredDailyDigest; reservedEventsCount: number } | null>;
  ensureDeviceDeliveries(
    digestId: string,
    userId: string,
    subscriptions: StoredPushSubscription[],
    maxAttempts: number,
    nowIso: string
  ): Promise<StoredDeviceDelivery[]>;
  markDeliverySending(deliveryId: string, attemptCount: number, nowIso: string): Promise<boolean>;
  updateDeliveryResult(
    deliveryId: string,
    update: {
      status: StoredDeviceDelivery['status'];
      attemptCount: number;
      nextAttemptAt?: string;
      lastStatusCode?: number | null;
      lastError?: string | null;
      acceptedAt?: string | null;
      nowIso: string;
    }
  ): Promise<void>;
  updateDigestStatus(
    digestId: string,
    update: {
      status: StoredDailyDigest['status'];
      attemptCount?: number;
      nextAttemptAt?: string;
      sentAt?: string | null;
      lastError?: string | null;
      lockedBy?: string | null;
      lockedUntil?: string | null;
      nowIso: string;
    }
  ): Promise<void>;
  updateAlertEventsStatus(
    digestId: string,
    status: 'reserved' | 'sent' | 'failed',
    nowIso: string
  ): Promise<void>;
  updateUserProcessStatus(
    userId: string,
    update: {
      lastProcessedAt: string;
      lastProcessedLocalDate: string;
      lastProcessStatus: UserProcessStatus;
      lastProcessMessage: string;
      lastPushAcceptedAt?: string | null;
    }
  ): Promise<void>;
  getUserStatusSummary(userId: string): Promise<{
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
  }>;
}

export const DEFAULT_SERVER_PUSH_PREFS: Omit<ServerPushPreferences, 'userId'> = {
  enabled: false,
  notifyConfirmedDividend: true,
  notifyExDate: true,
  notifyPaymentDay: true,
  notifyPriceOpportunity: true,
  notifyMarketBargain: true,
  notifyMentorConsensus: true,
  dailyTime: '08:00',
  timezone: 'America/Sao_Paulo',
  privacyMode: 'discreet',
};

export function isValidDailyTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

export function isValidIanaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}

export function sanitizePushPreferencesInput(
  input: Partial<ServerPushPreferences> | undefined,
  fallback: Omit<ServerPushPreferences, 'userId'> = DEFAULT_SERVER_PUSH_PREFS
): Omit<ServerPushPreferences, 'userId'> {
  if (!input) return { ...fallback };
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : fallback.enabled,
    notifyConfirmedDividend:
      typeof input.notifyConfirmedDividend === 'boolean'
        ? input.notifyConfirmedDividend
        : fallback.notifyConfirmedDividend,
    notifyExDate:
      typeof input.notifyExDate === 'boolean' ? input.notifyExDate : fallback.notifyExDate,
    notifyPaymentDay:
      typeof input.notifyPaymentDay === 'boolean'
        ? input.notifyPaymentDay
        : fallback.notifyPaymentDay,
    notifyPriceOpportunity:
      typeof input.notifyPriceOpportunity === 'boolean'
        ? input.notifyPriceOpportunity
        : fallback.notifyPriceOpportunity,
    notifyMarketBargain:
      typeof input.notifyMarketBargain === 'boolean'
        ? input.notifyMarketBargain
        : fallback.notifyMarketBargain,
    notifyMentorConsensus:
      typeof input.notifyMentorConsensus === 'boolean'
        ? input.notifyMentorConsensus
        : fallback.notifyMentorConsensus,
    dailyTime: isValidDailyTime(input.dailyTime) ? input.dailyTime : fallback.dailyTime,
    timezone: isValidIanaTimezone(input.timezone) ? input.timezone.trim() : fallback.timezone,
    privacyMode:
      input.privacyMode === 'detailed' || input.privacyMode === 'discreet'
        ? input.privacyMode
        : fallback.privacyMode,
  };
}

/**
 * Autenticação estrita do endpoint de agendamento (Cron).
 * Exige CRON_SECRET exclusivo (mínimo 16 caracteres, distinto de chaves de outros serviços)
 * enviado no cabeçalho Authorization: Bearer <CRON_SECRET>.
 * Falha de forma fechada (503) quando ausente/inválido na configuração.
 */
export function verifyCronAuthorization(
  request: Request,
  env: Record<string, string | undefined> = process.env
): { ok: boolean; status: 200 | 401 | 503; error?: string } {
  const cronSecret = (env.CRON_SECRET || '').trim();
  if (!cronSecret || cronSecret.length < 16) {
    return {
      ok: false,
      status: 503,
      error: 'CRON_SECRET ausente ou insuficiente no servidor.',
    };
  }

  const forbiddenMatches = [
    (env.ADMIN_SECRET || '').trim(),
    (env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    (env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    (env.VAPID_PRIVATE_KEY || '').trim(),
  ].filter(Boolean);

  if (forbiddenMatches.includes(cronSecret)) {
    return {
      ok: false,
      status: 503,
      error: 'CRON_SECRET deve ser exclusivo e distinto de outras credenciais do servidor.',
    };
  }

  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+([^\s]+)$/);
  if (!match) {
    return {
      ok: false,
      status: 401,
      error: 'Cabeçalho Authorization Bearer ausente ou inválido.',
    };
  }

  const providedToken = match[1];
  const expectedHash = createHash('sha256').update(cronSecret, 'utf8').digest();
  const providedHash = createHash('sha256').update(providedToken, 'utf8').digest();

  if (!timingSafeEqual(expectedHash, providedHash)) {
    return {
      ok: false,
      status: 401,
      error: 'Credencial de agendamento inválida.',
    };
  }

  return { ok: true, status: 200 };
}

export interface UserLocalDateTime {
  localDate: string; // YYYY-MM-DD
  localTime: string; // HH:MM
  hour: number;
  minute: number;
  minutesSinceMidnight: number;
}

export function getUserLocalDateTime(now: Date, timezone: string): UserLocalDateTime {
  const safeTz = isValidIanaTimezone(timezone) ? timezone.trim() : 'America/Sao_Paulo';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const rawHour = Number(get('hour'));
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(get('minute'));

  const localDate = `${year}-${month}-${day}`;
  const localTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    localDate,
    localTime,
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

export function isUserDueForDailySummary(
  now: Date,
  dailyTime: string,
  timezone: string,
  lastProcessedLocalDate?: string | null
): {
  due: boolean;
  localDate: string;
  localTime: string;
  minutesSinceMidnight: number;
  scheduledMinutes: number;
  alreadyProcessedToday: boolean;
} {
  const safeTime = isValidDailyTime(dailyTime) ? dailyTime : '08:00';
  const [schedH, schedM] = safeTime.split(':').map(Number);
  const scheduledMinutes = schedH * 60 + schedM;
  const local = getUserLocalDateTime(now, timezone);
  const alreadyProcessedToday =
    Boolean(lastProcessedLocalDate) && lastProcessedLocalDate === local.localDate;

  return {
    due: local.minutesSinceMidnight >= scheduledMinutes && !alreadyProcessedToday,
    localDate: local.localDate,
    localTime: local.localTime,
    minutesSinceMidnight: local.minutesSinceMidnight,
    scheduledMinutes,
    alreadyProcessedToday,
  };
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yr = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

export function calculateEligibleSharesOnDate(
  transactions: Transaction[],
  ticker: string,
  cutoffDateIso: string
): number {
  const cleanTicker = normalizeB3Ticker(ticker);
  if (!cleanTicker) return 0;

  let shares = 0;
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    if (!tx || tx.id?.startsWith('demo-')) continue;
    if (tx.type === 'DIVIDEND') continue;
    if (normalizeB3Ticker(tx.ticker) !== cleanTicker) continue;
    if (tx.date > cutoffDateIso) continue;
    const normalized = normalizeTransactionForSplit(tx, cutoffDateIso);
    shares = Math.max(
      0,
      shares + (tx.type === 'SELL' ? -normalized.shares : normalized.shares)
    );
  }
  return Number(shares.toFixed(6));
}

export function hasStatementDividendReceipt(
  transactions: Transaction[],
  ticker: string,
  paymentDateIso: string,
  exDateIso?: string
): boolean {
  const cleanTicker = normalizeB3Ticker(ticker);
  if (!cleanTicker) return false;
  return transactions.some((tx) => {
    if (!tx || tx.id?.startsWith('demo-')) return false;
    if (tx.type !== 'DIVIDEND') return false;
    if (normalizeB3Ticker(tx.ticker) !== cleanTicker) return false;
    if (exDateIso && tx.date < exDateIso) return false;
    return tx.date === paymentDateIso;
  });
}

export function extractActivePortfolioTickers(
  transactions: Transaction[],
  asOfDateIso?: string
): string[] {
  const cutoff = asOfDateIso || '9999-12-31';
  const candidateTickers = Array.from(
    new Set(
      transactions
        .filter((tx) => tx && !tx.id?.startsWith('demo-') && tx.type !== 'DIVIDEND')
        .map((tx) => normalizeB3Ticker(tx.ticker))
        .filter(Boolean)
    )
  );

  // Inclui ativos com saldo atual > 0 ou que tinham saldo no início do mês recente
  const monthStart =
    cutoff !== '9999-12-31' ? `${cutoff.slice(0, 7)}-01` : '1970-01-01';
  return candidateTickers.filter(
    (ticker) =>
      calculateEligibleSharesOnDate(transactions, ticker, cutoff) > 0 ||
      calculateEligibleSharesOnDate(transactions, ticker, monthStart) > 0
  );
}

/**
 * Avalia os eventos de proventos elegíveis da carteira sincronizada de um usuário
 * na data local do seu fuso horário.
 * Nunca cria alertas a partir de estimativas, catálogo estático ou dividendos manuais.
 */
export function evaluateUserPortfolioEvents(params: {
  localDate: string; // YYYY-MM-DD no fuso do usuário
  preferences: Pick<
    ServerPushPreferences,
    'notifyConfirmedDividend' | 'notifyExDate' | 'notifyPaymentDay'
  >;
  transactions: Transaction[];
  announcements: Record<
    string,
    VerifiedDividendAnnouncement | VerifiedDividendAnnouncement[] | null | undefined
  >;
  existingEvents: StoredAlertEvent[];
}): CandidateAlertEvent[] {
  const { localDate, preferences, transactions, announcements, existingEvents } = params;
  const activeTickers = extractActivePortfolioTickers(transactions, localDate);
  if (activeTickers.length === 0) return [];

  const candidateEvents: CandidateAlertEvent[] = [];

  for (const ticker of activeTickers) {
    const rawValue = announcements[ticker];
    const rawAnnouncements = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];

    for (const rawAnn of rawAnnouncements) {
    // Revalidação defensiva: garante que somente anúncios oficiais completos passem
    const verified = buildVerifiedAnnouncement({
      ticker: rawAnn.ticker,
      source: rawAnn.source,
      amountPerShare: rawAnn.amountPerShare,
      exDate: rawAnn.exDate,
      paymentDate: rawAnn.paymentDate,
      isCurrentMonthAnnounced: true,
      referenceDateIso: localDate,
      fetchedAt: rawAnn.fetchedAt,
    });
    if (!verified) continue;

    // Calcula cotas elegíveis na Data-Com (ou posição atual se Data-Com for futura)
    const shareReferenceDate = verified.exDate <= localDate ? verified.exDate : localDate;
    const eligibleShares = calculateEligibleSharesOnDate(
      transactions,
      ticker,
      shareReferenceDate
    );
    if (eligibleShares <= 0) continue;

    const personalTotalAmount = Number((eligibleShares * verified.amountPerShare).toFixed(2));
    const alreadyReceivedInStatement = hasStatementDividendReceipt(
      transactions,
      ticker,
      verified.paymentDate,
      verified.exDate
    );

    // 1. Novo anúncio confirmado OU alteração confirmada de anúncio previamente conhecido
    if (preferences.notifyConfirmedDividend && verified.paymentDate >= localDate) {
      const cycleRef = `cycle:${verified.exDate}:${verified.paymentDate}`;
      const priorAnnouncements = existingEvents.filter(
        (ev) =>
          ev.ticker === ticker &&
          (ev.eventType === 'DIVIDEND_ANNOUNCED' || ev.eventType === 'DIVIDEND_UPDATED') &&
          ev.eventReference === cycleRef ||
          (ev.payload?.exDate === verified.exDate && ev.payload?.paymentDate === verified.paymentDate)
      );

      if (priorAnnouncements.length === 0) {
        if (!alreadyReceivedInStatement) {
          candidateEvents.push({
            ticker,
            eventType: 'DIVIDEND_ANNOUNCED',
            eventReference: cycleRef,
            dataVersion: verified.dataVersion,
            source: verified.source,
            sourceEventDate: verified.exDate,
            amountPerShare: verified.amountPerShare,
            exDate: verified.exDate,
            exDateBr: verified.exDateBr,
            paymentDate: verified.paymentDate,
            paymentDateBr: verified.paymentDateBr,
            eligibleShares,
            personalTotalAmount,
            priority: 95,
          });
        }
      } else {
        const exactVersionExists = priorAnnouncements.some(
          (ev) => ev.dataVersion === verified.dataVersion
        );
        if (!exactVersionExists) {
          const latestPrior = priorAnnouncements[priorAnnouncements.length - 1];
          candidateEvents.push({
            ticker,
            eventType: 'DIVIDEND_UPDATED',
            eventReference: latestPrior.eventReference,
            dataVersion: verified.dataVersion,
            source: verified.source,
            sourceEventDate: verified.exDate,
            amountPerShare: verified.amountPerShare,
            exDate: verified.exDate,
            exDateBr: verified.exDateBr,
            paymentDate: verified.paymentDate,
            paymentDateBr: verified.paymentDateBr,
            eligibleShares,
            personalTotalAmount,
            previousAmountPerShare:
              typeof latestPrior.payload?.amountPerShare === 'number'
                ? latestPrior.payload.amountPerShare
                : undefined,
            previousExDate:
              typeof latestPrior.payload?.exDate === 'string'
                ? latestPrior.payload.exDate
                : undefined,
            previousPaymentDate:
              typeof latestPrior.payload?.paymentDate === 'string'
                ? latestPrior.payload.paymentDate
                : undefined,
            priority: 98,
          });
        }
      }
    }

    // 2. Lembrete de Data-Com (véspera e próprio dia da Data-Com)
    if (preferences.notifyExDate) {
      const isExToday = verified.exDate === localDate;
      const isExTomorrow = addCalendarDays(localDate, 1) === verified.exDate;
      if (isExToday || isExTomorrow) {
        const exRef = `ex:${verified.exDate}:on:${localDate}`;
        const alreadySentEx = existingEvents.some(
          (ev) =>
            ev.ticker === ticker &&
            ev.eventType === 'EX_DATE_REMINDER' &&
            ev.eventReference === exRef &&
            ev.dataVersion === verified.dataVersion
        );
        if (!alreadySentEx) {
          candidateEvents.push({
            ticker,
            eventType: 'EX_DATE_REMINDER',
            eventReference: exRef,
            dataVersion: verified.dataVersion,
            source: verified.source,
            sourceEventDate: verified.exDate,
            amountPerShare: verified.amountPerShare,
            exDate: verified.exDate,
            exDateBr: verified.exDateBr,
            paymentDate: verified.paymentDate,
            paymentDateBr: verified.paymentDateBr,
            eligibleShares,
            personalTotalAmount,
            priority: isExToday ? 92 : 88,
          });
        }
      }
    }

    // 3. Lembrete de Pagamento ("pagamento anunciado para hoje", apenas se ainda não lançado como recebido no extrato)
    if (preferences.notifyPaymentDay && verified.paymentDate === localDate) {
      const sharesOnExDate = calculateEligibleSharesOnDate(
        transactions,
        ticker,
        verified.exDate
      );
      if (sharesOnExDate > 0 && !alreadyReceivedInStatement) {
        const payRef = `pay:${verified.exDate}:${verified.paymentDate}`;
        const alreadySentPay = existingEvents.some(
          (ev) =>
            ev.ticker === ticker &&
            ev.eventType === 'PAYMENT_REMINDER' &&
            (ev.eventReference === payRef ||
              (ev.payload?.exDate === verified.exDate &&
                ev.payload?.paymentDate === verified.paymentDate)) &&
            ev.dataVersion === verified.dataVersion
        );
        if (!alreadySentPay) {
          candidateEvents.push({
            ticker,
            eventType: 'PAYMENT_REMINDER',
            eventReference: payRef,
            dataVersion: verified.dataVersion,
            source: verified.source,
            sourceEventDate: verified.paymentDate,
            amountPerShare: verified.amountPerShare,
            exDate: verified.exDate,
            exDateBr: verified.exDateBr,
            paymentDate: verified.paymentDate,
            paymentDateBr: verified.paymentDateBr,
            eligibleShares: sharesOnExDate,
            personalTotalAmount: Number((sharesOnExDate * verified.amountPerShare).toFixed(2)),
            priority: 100,
          });
        }
      }
    }
    }
  }

  return candidateEvents.sort(
    (a, b) => b.priority - a.priority || a.ticker.localeCompare(b.ticker)
  );
}

const formatPublicBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

function formatSourceLabel(source: 'STATUS_INVEST' | 'BRAPI'): string {
  return source === 'STATUS_INVEST' ? 'StatusInvest' : 'Brapi';
}

export function computeDigestKey(events: CandidateAlertEvent[]): string {
  const canonical = events
    .map((e) => `${e.ticker}:${e.eventType}:${e.eventReference}:${e.dataVersion}`)
    .sort()
    .join('||');
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 40);
}

/**
 * Monta o conteúdo do resumo diário respeitando a preferência de privacidade.
 * No modo 'discreet' (padrão), NUNCA inclui patrimônio, quantidade de cotas ou valores pessoais.
 * Também nunca coloca valores financeiros ou dados sensíveis na URL.
 */
export function buildDailySummaryNotification(
  events: CandidateAlertEvent[],
  localDate: string,
  privacyMode: NotificationPrivacyMode = 'discreet'
): {
  title: string;
  body: string;
  url: string;
  tag: string;
  digestKey: string;
} {
  if (events.length === 0) {
    throw new Error('Não é possível gerar resumo diário sem eventos.');
  }

  const primary = events[0];
  const targetDate =
    primary.eventType === 'EX_DATE_REMINDER' ? primary.exDate : primary.paymentDate;
  const url = buildSafePushUrl({
    tab: 'proventos',
    ticker: primary.ticker,
    date: targetDate,
    eventType: primary.eventType,
  });

  const digestKey = computeDigestKey(events);
  const tag = `fii-digest-${localDate}-${digestKey.slice(0, 10)}`;
  const isDetailed = privacyMode === 'detailed';

  if (events.length === 1) {
    const ev = events[0];
    const srcLabel = formatSourceLabel(ev.source);
    const perShareStr = `${formatPublicBRL(ev.amountPerShare)}/cota`;
    const personalSuffix = isDetailed
      ? ` • Sua posição elegível (${ev.eligibleShares} ${ev.eligibleShares === 1 ? 'cota' : 'cotas'}): ${formatPublicBRL(ev.personalTotalAmount)}.`
      : '';

    if (ev.eventType === 'PAYMENT_REMINDER') {
      return {
        title: `FII Tracker • Pagamento anunciado para hoje (${ev.ticker})`,
        body: `${ev.ticker} tem pagamento anunciado para hoje (${ev.paymentDateBr}, ${perShareStr} • Fonte: ${srcLabel}).${personalSuffix} Confira o lançamento no extrato.`,
        url,
        tag,
        digestKey,
      };
    }

    if (ev.eventType === 'DIVIDEND_UPDATED') {
      return {
        title: `FII Tracker • Anúncio atualizado (${ev.ticker})`,
        body: `${ev.ticker} teve alteração confirmada no provento: ${perShareStr}, Data-Com ${ev.exDateBr} e pagamento em ${ev.paymentDateBr} (Fonte: ${srcLabel}).${personalSuffix}`,
        url,
        tag,
        digestKey,
      };
    }

    if (ev.eventType === 'EX_DATE_REMINDER') {
      const whenLabel = ev.exDate === localDate ? 'hoje' : `em ${ev.exDateBr}`;
      return {
        title: `FII Tracker • Lembrete de Data-Com (${ev.ticker})`,
        body: `${ev.ticker} tem Data-Com confirmada ${whenLabel} (${perShareStr}, pagamento em ${ev.paymentDateBr} • Fonte: ${srcLabel}).${personalSuffix}`,
        url,
        tag,
        digestKey,
      };
    }

    return {
      title: `FII Tracker • Novo provento confirmado (${ev.ticker})`,
      body: `${ev.ticker} anunciou ${perShareStr} com Data-Com em ${ev.exDateBr} e pagamento em ${ev.paymentDateBr} (Fonte: ${srcLabel}).${personalSuffix}`,
      url,
      tag,
      digestKey,
    };
  }

  // Múltiplos eventos consolidados em um único Resumo Diário
  const uniqueTickers = Array.from(new Set(events.map((e) => e.ticker)));
  const sources = Array.from(new Set(events.map((e) => formatSourceLabel(e.source)))).join('/');

  const parts = events.slice(0, 4).map((ev) => {
    if (ev.eventType === 'PAYMENT_REMINDER') {
      return `${ev.ticker} (pagamento anunciado para hoje ${ev.paymentDateBr})`;
    }
    if (ev.eventType === 'DIVIDEND_UPDATED') {
      return `${ev.ticker} (anúncio atualizado ${formatPublicBRL(ev.amountPerShare)}/cota, pag. ${ev.paymentDateBr})`;
    }
    if (ev.eventType === 'EX_DATE_REMINDER') {
      return `${ev.ticker} (Data-Com ${ev.exDateBr})`;
    }
    return `${ev.ticker} (novo anúncio ${formatPublicBRL(ev.amountPerShare)}/cota, pag. ${ev.paymentDateBr})`;
  });

  const extraCount = events.length > 4 ? ` e +${events.length - 4}` : '';
  const uniquePayments = new Map<string, number>();
  for (const event of events) {
    const key = `${event.ticker}:${event.exDate}:${event.paymentDate}:${event.amountPerShare}`;
    if (!uniquePayments.has(key)) uniquePayments.set(key, event.personalTotalAmount);
  }
  const detailedSuffix = isDetailed
    ? ` • Total estimado nos pagamentos: ${formatPublicBRL(
        Array.from(uniquePayments.values()).reduce((acc, value) => acc + value, 0)
      )}.`
    : '';

  return {
    title: `FII Tracker • Resumo diário (${uniqueTickers.length} ${
      uniqueTickers.length === 1 ? 'ativo' : 'ativos'
    })`,
    body: `Eventos confirmados: ${parts.join('; ')}${extraCount} (Fonte: ${sources}).${detailedSuffix} Toque para abrir em Proventos.`,
    url,
    tag,
    digestKey,
  };
}

/**
 * Calcula o atraso de retentativa com intervalo crescente (exponential backoff).
 * Tentativa 1 falha -> +60s; Tentativa 2 falha -> +240s; Tentativa 3 falha -> falha definitiva.
 */
export function calculateNextRetryTimestamp(
  now: Date,
  attemptNumber: number,
  baseDelaySeconds = 60
): string {
  const multiplier = Math.pow(4, Math.max(0, attemptNumber - 1));
  const delaySeconds = Math.min(3600, baseDelaySeconds * multiplier);
  return new Date(now.getTime() + delaySeconds * 1000).toISOString();
}

export interface CronRunMetrics {
  ok: boolean;
  processedAt: string;
  usersEvaluated: number;
  usersSkippedSchedule: number;
  usersLocked: number;
  digestsCreated: number;
  digestsRecovered: number;
  deliveriesAccepted: number;
  deliveriesRetried: number;
  deliveriesFailed: number;
  subscriptionsExpired: number;
  tickersQueried: number;
}

export async function runServerPushCron(params: {
  storage: PushStorageAdapter;
  marketFetcher: (
    tickers: string[],
    referenceDateIso: string
  ) => Promise<
    Record<string, VerifiedDividendAnnouncement | VerifiedDividendAnnouncement[]>
  >;
  pushSender: (
    subscription: WebPushSubscriptionInput,
    payload: WebPushPayloadInput
  ) => Promise<WebPushSendResult>;
  now?: Date;
  workerId?: string;
  leaseSeconds?: number;
  maxAttempts?: number;
  baseRetrySeconds?: number;
}): Promise<CronRunMetrics> {
  const now = params.now || new Date();
  const nowIso = now.toISOString();
  const workerId = params.workerId || `worker-${randomUUID()}`;
  const leaseSeconds = params.leaseSeconds ?? 300;
  const maxAttempts = params.maxAttempts ?? 3;
  const baseRetrySeconds = params.baseRetrySeconds ?? 60;

  const metrics: CronRunMetrics = {
    ok: true,
    processedAt: nowIso,
    usersEvaluated: 0,
    usersSkippedSchedule: 0,
    usersLocked: 0,
    digestsCreated: 0,
    digestsRecovered: 0,
    deliveriesAccepted: 0,
    deliveriesRetried: 0,
    deliveriesFailed: 0,
    subscriptionsExpired: 0,
    tickersQueried: 0,
  };

  const candidateUsers = await params.storage.listCandidateUsers(nowIso);
  if (candidateUsers.length === 0) return metrics;

  // 1. Filtra usuários elegíveis por horário/fuso OU que tenham digest pendente de recuperação
  const dueUsers: Array<{
    prefs: ServerPushPreferences;
    localDate: string;
    isScheduleDue: boolean;
    recoverableDigests: StoredDailyDigest[];
    transactions: Transaction[];
  }> = [];

  const allTickersSet = new Set<string>();

  for (const prefs of candidateUsers) {
    const schedule = isUserDueForDailySummary(
      now,
      prefs.dailyTime,
      prefs.timezone,
      prefs.lastProcessedLocalDate
    );
    const recoverableDigests = await params.storage.getRecoverableDigests(prefs.userId, nowIso);

    if (!schedule.due && recoverableDigests.length === 0) {
      metrics.usersSkippedSchedule++;
      continue;
    }

    let transactions: Transaction[] = [];
    if ( prefs.enabled && schedule.due ) {
      transactions = await params.storage.getUserTransactions(prefs.userId);
      const activeTickers = extractActivePortfolioTickers(transactions, schedule.localDate);
      for (const ticker of activeTickers) {
        allTickersSet.add(ticker);
      }
    }

    dueUsers.push({
      prefs,
      localDate: schedule.localDate,
      isScheduleDue: prefs.enabled && schedule.due,
      recoverableDigests,
      transactions,
    });
  }

  // 2. Consulta compartilhada de dados de mercado (uma única vez por ativo no lote)
  const uniqueTickers = Array.from(allTickersSet);
  metrics.tickersQueried = uniqueTickers.length;
  const referenceDateForMarket =
    dueUsers[0]?.localDate ||
    now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const sharedAnnouncements =
    uniqueTickers.length > 0
      ? await params.marketFetcher(uniqueTickers, referenceDateForMarket)
      : {};

  // Helper interno para entregar um digest aos dispositivos ativos do usuário
  const deliverDigestToDevices = async (
    digest: StoredDailyDigest,
    prefs: ServerPushPreferences,
    localDate: string
  ) => {
    const activeSubs = await params.storage.listUserSubscriptions(digest.userId, true);
    if (activeSubs.length === 0) {
      await params.storage.updateDigestStatus(digest.id, {
        status: 'skipped_no_devices',
        lockedBy: null,
        lockedUntil: null,
        lastError: 'Nenhum dispositivo ativo inscrito.',
        nowIso,
      });
      await params.storage.updateAlertEventsStatus(digest.id, 'failed', nowIso);
      await params.storage.updateUserProcessStatus(digest.userId, {
        lastProcessedAt: nowIso,
        lastProcessedLocalDate: localDate,
        lastProcessStatus: 'skipped_no_devices',
        lastProcessMessage: 'Nenhum dispositivo ativo inscrito para receber notificações.',
      });
      return;
    }

    const deliveries = await params.storage.ensureDeviceDeliveries(
      digest.id,
      digest.userId,
      activeSubs,
      maxAttempts,
      nowIso
    );

    const subMap = new Map(activeSubs.map((s) => [s.id, s]));
    let anyAcceptedInDigest = false;
    let latestAcceptedAt: string | null = prefs.lastPushAcceptedAt || null;

    // Entregas independentes por dispositivo: falha em um aparelho não bloqueia os demais
    for (const delivery of deliveries) {
      if (delivery.status === 'accepted') {
        anyAcceptedInDigest = true;
        continue;
      }
      if (
        delivery.status === 'failed_permanent' ||
        delivery.status === 'expired_subscription'
      ) {
        continue;
      }
      if (delivery.status === 'retry_pending' && delivery.nextAttemptAt > nowIso) {
        continue;
      }

      const sub = delivery.subscription || subMap.get(delivery.subscriptionId);
      if (!sub || !sub.isActive) {
        await params.storage.updateDeliveryResult(delivery.id, {
          status: 'expired_subscription',
          attemptCount: delivery.attemptCount,
          lastError: 'Inscrição inativa.',
          nowIso,
        });
        continue;
      }

      const nextAttemptNumber = delivery.attemptCount + 1;
      // Nunca marca como enviado antes do serviço Push aceitar
      const claimedDelivery = await params.storage.markDeliverySending(
        delivery.id,
        nextAttemptNumber,
        nowIso
      );
      if (!claimedDelivery) continue;

      const sendResult = await params.pushSender(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        {
          title: digest.title,
          body: digest.body,
          tag: digest.tag,
          url: digest.url,
        }
      );

      if (sendResult.ok && sendResult.outcome === 'accepted') {
        anyAcceptedInDigest = true;
        latestAcceptedAt = nowIso;
        metrics.deliveriesAccepted++;
        await params.storage.updateDeliveryResult(delivery.id, {
          status: 'accepted',
          attemptCount: nextAttemptNumber,
          lastStatusCode: sendResult.statusCode ?? 201,
          lastError: null,
          acceptedAt: nowIso,
          nowIso,
        });
      } else if (sendResult.outcome === 'expired') {
        metrics.subscriptionsExpired++;
        metrics.deliveriesFailed++;
        await params.storage.updateDeliveryResult(delivery.id, {
          status: 'expired_subscription',
          attemptCount: nextAttemptNumber,
          lastStatusCode: sendResult.statusCode ?? 410,
          lastError: sendResult.errorMessage || 'Inscrição expirada (404/410).',
          nowIso,
        });
        await params.storage.deactivateUserSubscription(
          digest.userId,
          sub.id,
          sendResult.errorMessage || `HTTP ${sendResult.statusCode ?? 410}`,
          sendResult.statusCode ?? 410,
          nowIso
        );
      } else if (
        sendResult.outcome === 'transient_error' &&
        nextAttemptNumber < delivery.maxAttempts
      ) {
        metrics.deliveriesRetried++;
        const nextRetryIso = calculateNextRetryTimestamp(
          now,
          nextAttemptNumber,
          baseRetrySeconds
        );
        await params.storage.updateDeliveryResult(delivery.id, {
          status: 'retry_pending',
          attemptCount: nextAttemptNumber,
          nextAttemptAt: nextRetryIso,
          lastStatusCode: sendResult.statusCode,
          lastError: sendResult.errorMessage || 'Falha transitória; agendada retentativa.',
          nowIso,
        });
      } else {
        metrics.deliveriesFailed++;
        await params.storage.updateDeliveryResult(delivery.id, {
          status: 'failed_permanent',
          attemptCount: nextAttemptNumber,
          lastStatusCode: sendResult.statusCode,
          lastError: sendResult.errorMessage || 'Falha permanente no envio Push.',
          nowIso,
        });
      }
    }

    // Reavalia estado consolidado das entregas deste digest
    const refreshedDeliveries = await params.storage.ensureDeviceDeliveries(
      digest.id,
      digest.userId,
      activeSubs,
      maxAttempts,
      nowIso
    );

    const retryPendingList = refreshedDeliveries.filter(
      (d) => d.status === 'retry_pending' || d.status === 'pending' || d.status === 'sending'
    );
    const acceptedList = refreshedDeliveries.filter((d) => d.status === 'accepted');
    const failedList = refreshedDeliveries.filter(
      (d) => d.status === 'failed_permanent' || d.status === 'expired_subscription'
    );

    if (retryPendingList.length > 0) {
      const earliestNextAttempt = retryPendingList
        .map((d) => d.nextAttemptAt)
        .sort()[0] || calculateNextRetryTimestamp(now, digest.attemptCount + 1, baseRetrySeconds);

      await params.storage.updateDigestStatus(digest.id, {
        status: 'retry_pending',
        attemptCount: digest.attemptCount + 1,
        nextAttemptAt: earliestNextAttempt,
        lockedBy: null,
        lockedUntil: null,
        lastError: 'Aguardando retentativa em dispositivo(s) com falha transitória.',
        nowIso,
      });
      await params.storage.updateUserProcessStatus(digest.userId, {
        lastProcessedAt: nowIso,
        lastProcessedLocalDate: localDate,
        lastProcessStatus: anyAcceptedInDigest ? 'partial_failure' : 'queued',
        lastProcessMessage: anyAcceptedInDigest
          ? 'Envio aceito em parte dos aparelhos; retentativa agendada para os demais.'
          : 'Falha transitória no serviço Push; retentativa automática agendada.',
        lastPushAcceptedAt: latestAcceptedAt,
      });
    } else if (acceptedList.length > 0) {
      await params.storage.updateDigestStatus(digest.id, {
        status: 'sent',
        attemptCount: digest.attemptCount + 1,
        sentAt: nowIso,
        lockedBy: null,
        lockedUntil: null,
        lastError:
          failedList.length > 0
            ? 'Alguns dispositivos falharam ou estavam expirados.'
            : null,
        nowIso,
      });
      await params.storage.updateAlertEventsStatus(digest.id, 'sent', nowIso);
      await params.storage.updateUserProcessStatus(digest.userId, {
        lastProcessedAt: nowIso,
        lastProcessedLocalDate: localDate,
        lastProcessStatus: failedList.length > 0 ? 'partial_failure' : 'sent',
        lastProcessMessage:
          failedList.length > 0
            ? `Envio aceito pelo serviço Push em ${acceptedList.length} aparelho(s); ${failedList.length} com falha/expirado.`
            : `Envio aceito pelo serviço Push em ${acceptedList.length} aparelho(s).`,
        lastPushAcceptedAt: latestAcceptedAt,
      });
    } else {
      await params.storage.updateDigestStatus(digest.id, {
        status: 'failed',
        attemptCount: digest.attemptCount + 1,
        lockedBy: null,
        lockedUntil: null,
        lastError: 'Nenhum dispositivo aceitou o envio após as tentativas.',
        nowIso,
      });
      await params.storage.updateAlertEventsStatus(digest.id, 'failed', nowIso);
      await params.storage.updateUserProcessStatus(digest.userId, {
        lastProcessedAt: nowIso,
        lastProcessedLocalDate: localDate,
        lastProcessStatus: 'failed',
        lastProcessMessage:
          'Falha ao enviar para os dispositivos inscritos. Verifique a inscrição do aparelho.',
        lastPushAcceptedAt: latestAcceptedAt,
      });
    }
  };

  // 3. Processa cada usuário com reserva atômica (lock por usuário)
  for (const item of dueUsers) {
    const { prefs, localDate, isScheduleDue, transactions } = item;
    const lockNowIso = (params.now || new Date()).toISOString();
    const claimed = await params.storage.claimUserLock(
      prefs.userId,
      workerId,
      leaseSeconds,
      lockNowIso
    );
    if (!claimed) {
      metrics.usersLocked++;
      continue;
    }

    try {
      metrics.usersEvaluated++;
      const currentPrefs = (await params.storage.getUserPreferences(prefs.userId)) || prefs;

      // 3a. Recupera processamentos interrompidos ou retentativas pendentes vencidas
      const currentRecoverable = await params.storage.getRecoverableDigests(
        prefs.userId,
        nowIso
      );
      for (const digest of currentRecoverable) {
        metrics.digestsRecovered++;
        if (!currentPrefs.enabled) {
          await params.storage.updateDigestStatus(digest.id, {
            status: 'failed',
            lockedBy: null,
            lockedUntil: null,
            lastError: 'Envio cancelado porque as notificações foram desativadas.',
            nowIso,
          });
          await params.storage.updateAlertEventsStatus(digest.id, 'failed', nowIso);
          continue;
        }
        const recoveryDate = getUserLocalDateTime(now, currentPrefs.timezone).localDate;
        const recoverableEvents = digest.eventsJson.filter((event) => {
          if (
            (event.eventType === 'DIVIDEND_ANNOUNCED' || event.eventType === 'DIVIDEND_UPDATED') &&
            !currentPrefs.notifyConfirmedDividend
          ) return false;
          if (event.eventType === 'EX_DATE_REMINDER' && !currentPrefs.notifyExDate) return false;
          if (event.eventType === 'PAYMENT_REMINDER' && !currentPrefs.notifyPaymentDay) return false;
          if (event.paymentDate < recoveryDate) return false;
          if (event.eventType === 'EX_DATE_REMINDER' && event.exDate < recoveryDate) return false;
          return true;
        });
        if (recoverableEvents.length === 0) {
          await params.storage.updateDigestStatus(digest.id, {
            status: 'failed',
            lockedBy: null,
            lockedUntil: null,
            lastError: 'Resumo expirado: os eventos já passaram.',
            nowIso,
          });
          await params.storage.updateAlertEventsStatus(digest.id, 'failed', nowIso);
          continue;
        }
        const refreshedNotification = buildDailySummaryNotification(
          recoverableEvents,
          recoveryDate,
          currentPrefs.privacyMode
        );
        await deliverDigestToDevices(
          { ...digest, ...refreshedNotification, eventsJson: recoverableEvents },
          currentPrefs,
          recoveryDate
        );
      }

      if (!isScheduleDue) {
        continue;
      }

      // 3b. Avalia novos eventos para o resumo diário
      const existingEvents = await params.storage.getExistingAlertEvents(prefs.userId);
      const candidateEvents = evaluateUserPortfolioEvents({
        localDate,
        preferences: currentPrefs,
        transactions,
        announcements: sharedAnnouncements,
        existingEvents,
      });

      if (candidateEvents.length === 0) {
        if (prefs.lastProcessedLocalDate !== localDate || !prefs.lastProcessStatus) {
          await params.storage.updateUserProcessStatus(prefs.userId, {
            lastProcessedAt: nowIso,
            lastProcessedLocalDate: localDate,
            lastProcessStatus: 'no_events',
            lastProcessMessage: 'Carteira sincronizada verificada; sem novos eventos hoje.',
            lastPushAcceptedAt: prefs.lastPushAcceptedAt || null,
          });
        }
        continue;
      }

      const activeSubs = await params.storage.listUserSubscriptions(prefs.userId, true);
      if (activeSubs.length === 0) {
        await params.storage.updateUserProcessStatus(prefs.userId, {
          lastProcessedAt: nowIso,
          lastProcessedLocalDate: localDate,
          lastProcessStatus: 'skipped_no_devices',
          lastProcessMessage:
            'Eventos detectados, mas nenhum dispositivo ativo está inscrito nesta conta.',
          lastPushAcceptedAt: prefs.lastPushAcceptedAt || null,
        });
        continue;
      }

      const summaryNotif = buildDailySummaryNotification(
        candidateEvents,
        localDate,
        prefs.privacyMode
      );

      const reserved = await params.storage.reserveDigestAndEvents({
        userId: prefs.userId,
        localDate,
        digestKey: summaryNotif.digestKey,
        title: summaryNotif.title,
        body: summaryNotif.body,
        url: summaryNotif.url,
        tag: summaryNotif.tag,
        events: candidateEvents,
        workerId,
        leaseSeconds,
        nowIso,
      });

      if (!reserved || reserved.reservedEventsCount === 0) {
        continue;
      }

      metrics.digestsCreated++;
      await deliverDigestToDevices(reserved.digest, prefs, localDate);
    } finally {
      await params.storage.releaseUserLock(prefs.userId, workerId);
    }
  }

  return metrics;
}

// ============================================================================
// Implementação do Storage Adapter para Supabase (Produção)
// ============================================================================

function toIsoTimestampOrNull(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function toIsoDateOrNull(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function mapDbRowToServerPrefs(row: Record<string, unknown>): ServerPushPreferences {
  return {
    userId: String(row.user_id),
    enabled: Boolean(row.enabled),
    notifyConfirmedDividend: row.notify_confirmed_dividend !== false,
    notifyExDate: row.notify_ex_date !== false,
    notifyPaymentDay: row.notify_payment_day !== false,
    notifyPriceOpportunity: row.notify_price_opportunity !== false,
    notifyMarketBargain: row.notify_market_bargain !== false,
    notifyMentorConsensus: row.notify_mentor_consensus !== false,
    dailyTime: isValidDailyTime(row.daily_time) ? row.daily_time : '08:00',
    timezone: isValidIanaTimezone(row.timezone) ? String(row.timezone) : 'America/Sao_Paulo',
    privacyMode: row.privacy_mode === 'detailed' ? 'detailed' : 'discreet',
    lastProcessedAt: toIsoTimestampOrNull(row.last_processed_at),
    lastProcessedLocalDate: toIsoDateOrNull(row.last_processed_local_date),
    lastProcessStatus: (row.last_process_status as UserProcessStatus) || null,
    lastProcessMessage: row.last_process_message ? String(row.last_process_message) : null,
    lastPushAcceptedAt: toIsoTimestampOrNull(row.last_push_accepted_at),
    updatedAt: toIsoTimestampOrNull(row.updated_at) || undefined,
  };
}

function mapDbRowToSubscription(row: Record<string, unknown>): StoredPushSubscription {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
    userAgent: row.user_agent ? String(row.user_agent) : null,
    deviceLabel: row.device_label ? String(row.device_label) : null,
    isActive: Boolean(row.is_active),
    deactivatedReason: row.deactivated_reason ? String(row.deactivated_reason) : null,
    lastStatusCode:
      typeof row.last_status_code === 'number' ? row.last_status_code : null,
    lastAcceptedAt: toIsoTimestampOrNull(row.last_accepted_at),
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: toIsoTimestampOrNull(row.created_at) || undefined,
    updatedAt: toIsoTimestampOrNull(row.updated_at) || undefined,
  };
}

export function mapDbRowToTransaction(
  row: Record<string, unknown>,
  userId?: string | null
): Transaction {
  const rawShares = Number(row.shares || 0);
  const notesStr = String(row.notes || '');
  const idStr = String(row.id || '');
  const dbType = row.type as 'BUY' | 'SELL' | 'DIVIDEND' | undefined;
  const isDividend =
    dbType === 'DIVIDEND' ||
    idStr.includes('b3-div-') ||
    notesStr.startsWith('[PROVENTO B3]');
  const isSell = dbType === 'SELL' || (!isDividend && rawShares < 0);
  const absShares = Math.abs(rawShares);
  const absPrice = Math.abs(Number(row.price || 0));
  const absTotal = Math.abs(Number(row.total || 0));

  return {
    id: unscopeIdFromUser(idStr, userId),
    ticker: normalizeB3Ticker(String(row.ticker || '')),
    type:
      dbType === 'BUY' || dbType === 'SELL' || dbType === 'DIVIDEND'
        ? dbType
        : isDividend
        ? 'DIVIDEND'
        : isSell
        ? 'SELL'
        : 'BUY',
    date:
      row.date instanceof Date
        ? row.date.toISOString().slice(0, 10)
        : String(row.date || '').slice(0, 10),
    splitAdjustment: (row.split_adjustment ||
      row.splitAdjustment ||
      undefined) as Transaction['splitAdjustment'],
    shares: absShares,
    price: absPrice,
    total: absTotal,
    broker: String(row.broker || 'XP Investimentos'),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

export function createSupabasePushStorage(db: SupabaseClient): PushStorageAdapter {
  return {
    async listCandidateUsers(nowIso: string) {
      const [{ data: enabledRows, error: err1 }, { data: pendingDigests, error: err2 }] =
        await Promise.all([
          db.from('push_notification_preferences').select('*').eq('enabled', true),
          db
            .from('push_daily_digests')
            .select('user_id')
            .in('status', ['processing', 'retry_pending'])
            .lte('next_attempt_at', nowIso),
        ]);
      if (err1) {
        console.error('[push-cron] Falha ao consultar preferências.', {
          code: err1.code,
          message: err1.message.slice(0, 300),
        });
        throw new Error('Falha ao listar preferências de Push.');
      }
      if (err2) {
        console.error('[push-cron] Falha ao consultar resumos pendentes.', {
          code: err2.code,
          message: err2.message.slice(0, 300),
        });
        throw new Error('Falha ao listar resumos pendentes.');
      }

      const map = new Map<string, ServerPushPreferences>();
      for (const row of enabledRows || []) {
        const mapped = mapDbRowToServerPrefs(row as Record<string, unknown>);
        map.set(mapped.userId, mapped);
      }

      const missingUserIds = Array.from(
        new Set(
          (pendingDigests || [])
            .map((d) => String((d as Record<string, unknown>).user_id))
            .filter((uid) => !map.has(uid))
        )
      );

      if (missingUserIds.length > 0) {
        const { data: extraRows } = await db
          .from('push_notification_preferences')
          .select('*')
          .in('user_id', missingUserIds);
        for (const row of extraRows || []) {
          const mapped = mapDbRowToServerPrefs(row as Record<string, unknown>);
          map.set(mapped.userId, mapped);
        }
      }

      return Array.from(map.values());
    },

    async getUserPreferences(userId: string) {
      const { data, error } = await db
        .from('push_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error || !data) return null;
      return mapDbRowToServerPrefs(data as Record<string, unknown>);
    },

    async upsertUserPreferences(userId, prefs, options) {
      const nowIso = options?.nowIso || new Date().toISOString();
      const existing = await this.getUserPreferences(userId);
      if (existing && options?.onlyIfAbsent) {
        return existing;
      }

      const merged = sanitizePushPreferencesInput(prefs, existing || DEFAULT_SERVER_PUSH_PREFS);
      const row = {
        user_id: userId,
        enabled: merged.enabled,
        notify_confirmed_dividend: merged.notifyConfirmedDividend,
        notify_ex_date: merged.notifyExDate,
        notify_payment_day: merged.notifyPaymentDay,
        notify_price_opportunity: merged.notifyPriceOpportunity,
        notify_market_bargain: merged.notifyMarketBargain,
        notify_mentor_consensus: merged.notifyMentorConsensus,
        daily_time: merged.dailyTime,
        timezone: merged.timezone,
        privacy_mode: merged.privacyMode,
        updated_at: nowIso,
      };

      const { data, error } = await db
        .from('push_notification_preferences')
        .upsert(row, {
          onConflict: 'user_id',
          ignoreDuplicates: Boolean(options?.onlyIfAbsent),
        })
        .select('*')
        .maybeSingle();

      if (error) throw new Error('Falha ao salvar preferências de Push.');
      if (!data) {
        const current = await this.getUserPreferences(userId);
        if (current) return current;
        throw new Error('Preferências não encontradas após salvar.');
      }
      return mapDbRowToServerPrefs(data as Record<string, unknown>);
    },

    async listUserSubscriptions(userId: string, onlyActive = false) {
      let query = db
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (onlyActive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (error) throw new Error('Falha ao consultar inscrições Push.');
      return (data || []).map((r) => mapDbRowToSubscription(r as Record<string, unknown>));
    },

    async upsertUserSubscription(userId, sub, nowIso = new Date().toISOString()) {
      const row = {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        user_agent: sub.userAgent || null,
        device_label: sub.deviceLabel || null,
        is_active: true,
        deactivated_reason: null,
        last_error: null,
        updated_at: nowIso,
      };
      const { data, error } = await db
        .from('push_subscriptions')
        .upsert(row, { onConflict: 'user_id,endpoint' })
        .select('*')
        .single();
      if (error || !data) throw new Error('Falha ao registrar dispositivo Push.');
      return mapDbRowToSubscription(data as Record<string, unknown>);
    },

    async deactivateUserSubscription(
      userId,
      subscriptionIdOrEndpoint,
      reason,
      statusCode = null,
      nowIso = new Date().toISOString()
    ) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        subscriptionIdOrEndpoint
      );
      let query = db
        .from('push_subscriptions')
        .update({
          is_active: false,
          deactivated_reason: reason,
          last_status_code: statusCode,
          updated_at: nowIso,
        })
        .eq('user_id', userId);

      query = isUuid
        ? query.eq('id', subscriptionIdOrEndpoint)
        : query.eq('endpoint', subscriptionIdOrEndpoint);

      const { error } = await query;
      return !error;
    },

    async deleteUserSubscription(userId: string, endpointOrId: string) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        endpointOrId
      );
      let query = db.from('push_subscriptions').delete().eq('user_id', userId);
      query = isUuid ? query.eq('id', endpointOrId) : query.eq('endpoint', endpointOrId);
      const { error } = await query;
      return !error;
    },

    async getUserTransactions(userId: string) {
      const transactions: Transaction[] = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await db
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('id')
          .range(offset, offset + 999);
        if (page.error) throw new Error('Falha ao ler transações sincronizadas.');
        for (const row of page.data || []) {
          transactions.push(mapDbRowToTransaction(row as Record<string, unknown>, userId));
        }
        if ((page.data?.length || 0) < 1000) break;
      }
      return transactions;
    },

    async claimUserLock(userId, workerId, leaseSeconds, nowIso) {
      const { data, error } = await db.rpc('claim_push_user_lock', {
        p_user_id: userId,
        p_worker_id: workerId,
        p_lease_seconds: leaseSeconds,
        p_now: nowIso,
      });
      if (error) return false;
      return data === true;
    },

    async releaseUserLock(userId, workerId) {
      await db.rpc('release_push_user_lock', {
        p_user_id: userId,
        p_worker_id: workerId,
      });
    },

    async getExistingAlertEvents(userId: string) {
      const { data, error } = await db
        .from('push_alert_events')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['reserved', 'sent', 'failed'])
        .order('created_at', { ascending: true });
      if (error) throw new Error('Falha ao ler histórico de eventos Push.');
      return (data || []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          userId: String(r.user_id),
          ticker: String(r.ticker),
          eventType: r.event_type as PushAlertEventType,
          eventReference: String(r.event_reference),
          dataVersion: String(r.data_version),
          source: String(r.source),
          sourceEventDate: toIsoDateOrNull(r.source_event_date) || String(r.source_event_date),
          payload: (r.payload as Record<string, unknown>) || {},
          digestId: r.digest_id ? String(r.digest_id) : null,
          status: r.status as 'reserved' | 'sent' | 'failed',
        };
      });
    },

    async getRecoverableDigests(userId: string, nowIso: string) {
      const { data, error } = await db
        .from('push_daily_digests')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['processing', 'retry_pending'])
        .order('created_at', { ascending: true });
      if (error) throw new Error('Falha ao consultar resumos Push recuperáveis.');
      if (!data) return [];

      return data
        .map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id),
            userId: String(r.user_id),
            localDate: toIsoDateOrNull(r.local_date) || String(r.local_date),
            digestKey: String(r.digest_key),
            title: String(r.title),
            body: String(r.body),
            url: String(r.url),
            tag: String(r.tag),
            eventsJson: (r.events_json as CandidateAlertEvent[]) || [],
            status: r.status as StoredDailyDigest['status'],
            attemptCount: Number(r.attempt_count || 0),
            nextAttemptAt: toIsoTimestampOrNull(r.next_attempt_at) || String(r.next_attempt_at),
            lockedBy: r.locked_by ? String(r.locked_by) : null,
            lockedUntil: toIsoTimestampOrNull(r.locked_until),
            sentAt: toIsoTimestampOrNull(r.sent_at),
            lastError: r.last_error ? String(r.last_error) : null,
          };
        })
        .filter((d) => {
          if (d.status === 'processing') {
            return !d.lockedUntil || d.lockedUntil <= nowIso;
          }
          if (d.status === 'retry_pending') {
            return d.nextAttemptAt <= nowIso;
          }
          return false;
        });
    },

    async reserveDigestAndEvents(params) {
      const { data, error } = await db.rpc('reserve_push_digest_and_events', {
        p_user_id: params.userId,
        p_local_date: params.localDate,
        p_digest_key: params.digestKey,
        p_title: params.title,
        p_body: params.body,
        p_url: params.url,
        p_tag: params.tag,
        p_events: params.events,
        p_worker_id: params.workerId,
        p_lease_seconds: params.leaseSeconds,
        p_now: params.nowIso,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object') return null;
      const result = data as {
        digest?: Record<string, unknown>;
        reservedEventsCount?: number;
      };
      const dRow = result.digest;
      if (!dRow) return null;
      const digestId = String(dRow.id);

      return {
        digest: {
          id: digestId,
          userId: String(dRow.user_id),
          localDate: toIsoDateOrNull(dRow.local_date) || String(dRow.local_date),
          digestKey: String(dRow.digest_key),
          title: String(dRow.title),
          body: String(dRow.body),
          url: String(dRow.url),
          tag: String(dRow.tag),
          eventsJson: (dRow.events_json as CandidateAlertEvent[]) || [],
          status: dRow.status as StoredDailyDigest['status'],
          attemptCount: Number(dRow.attempt_count || 0),
          nextAttemptAt: toIsoTimestampOrNull(dRow.next_attempt_at) || String(dRow.next_attempt_at),
          lockedBy: dRow.locked_by ? String(dRow.locked_by) : null,
          lockedUntil: toIsoTimestampOrNull(dRow.locked_until),
          sentAt: toIsoTimestampOrNull(dRow.sent_at),
          lastError: dRow.last_error ? String(dRow.last_error) : null,
        },
        reservedEventsCount: Number(result.reservedEventsCount || 0),
      };
    },

    async ensureDeviceDeliveries(digestId, userId, subscriptions, maxAttempts, nowIso) {
      if (subscriptions.length > 0) {
        const rows = subscriptions.map((s) => ({
          digest_id: digestId,
          subscription_id: s.id,
          user_id: userId,
          status: 'pending',
          attempt_count: 0,
          max_attempts: maxAttempts,
          next_attempt_at: nowIso,
          updated_at: nowIso,
        }));
        const { error: upsertError } = await db
          .from('push_device_deliveries')
          .upsert(rows, { onConflict: 'digest_id,subscription_id', ignoreDuplicates: true });
        if (upsertError) throw upsertError;
      }

      const staleSendingBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { error: staleError } = await db
        .from('push_device_deliveries')
        .update({ status: 'retry_pending', next_attempt_at: nowIso })
        .eq('digest_id', digestId)
        .eq('status', 'sending')
        .lt('updated_at', staleSendingBefore);
      if (staleError) throw staleError;

      const { data, error } = await db
        .from('push_device_deliveries')
        .select('*')
        .eq('digest_id', digestId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!data) return [];

      const subMap = new Map(subscriptions.map((s) => [s.id, s]));
      return data.map((row) => {
        const r = row as Record<string, unknown>;
        const subId = String(r.subscription_id);
        return {
          id: String(r.id),
          digestId: String(r.digest_id),
          subscriptionId: subId,
          userId: String(r.user_id),
          status: r.status as StoredDeviceDelivery['status'],
          attemptCount: Number(r.attempt_count || 0),
          maxAttempts: Number(r.max_attempts || maxAttempts),
          nextAttemptAt: toIsoTimestampOrNull(r.next_attempt_at) || String(r.next_attempt_at),
          lastStatusCode:
            typeof r.last_status_code === 'number' ? r.last_status_code : null,
          lastError: r.last_error ? String(r.last_error) : null,
          acceptedAt: toIsoTimestampOrNull(r.accepted_at),
          subscription: subMap.get(subId),
        };
      });
    },

    async markDeliverySending(deliveryId, attemptCount, nowIso) {
      const { data, error } = await db
        .from('push_device_deliveries')
        .update({
          status: 'sending',
          attempt_count: attemptCount,
          updated_at: nowIso,
        })
        .eq('id', deliveryId)
        .in('status', ['pending', 'retry_pending'])
        .lte('next_attempt_at', nowIso)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },

    async updateDeliveryResult(deliveryId, update) {
      const patch: Record<string, unknown> = {
        status: update.status,
        attempt_count: update.attemptCount,
        updated_at: update.nowIso,
      };
      if (update.nextAttemptAt !== undefined) patch.next_attempt_at = update.nextAttemptAt;
      if (update.lastStatusCode !== undefined) patch.last_status_code = update.lastStatusCode;
      if (update.lastError !== undefined) patch.last_error = update.lastError;
      if (update.acceptedAt !== undefined) patch.accepted_at = update.acceptedAt;

      const { error: deliveryError } = await db
        .from('push_device_deliveries')
        .update(patch)
        .eq('id', deliveryId);
      if (deliveryError) throw deliveryError;

      if (update.status === 'accepted' && update.acceptedAt) {
        const { data: deliv, error: readError } = await db
          .from('push_device_deliveries')
          .select('subscription_id')
          .eq('id', deliveryId)
          .maybeSingle();
        if (readError) throw readError;
        if (deliv) {
          const { error: subscriptionError } = await db
            .from('push_subscriptions')
            .update({
              last_accepted_at: update.acceptedAt,
              last_status_code: update.lastStatusCode ?? 201,
              last_error: null,
              updated_at: update.nowIso,
            })
            .eq('id', String((deliv as Record<string, unknown>).subscription_id));
          if (subscriptionError) throw subscriptionError;
        }
      }
    },

    async updateDigestStatus(digestId, update) {
      const patch: Record<string, unknown> = {
        status: update.status,
        updated_at: update.nowIso,
      };
      if (update.attemptCount !== undefined) patch.attempt_count = update.attemptCount;
      if (update.nextAttemptAt !== undefined) patch.next_attempt_at = update.nextAttemptAt;
      if (update.sentAt !== undefined) patch.sent_at = update.sentAt;
      if (update.lastError !== undefined) patch.last_error = update.lastError;
      if (update.lockedBy !== undefined) patch.locked_by = update.lockedBy;
      if (update.lockedUntil !== undefined) patch.locked_until = update.lockedUntil;

      const { error } = await db
        .from('push_daily_digests')
        .update(patch)
        .eq('id', digestId);
      if (error) throw error;
    },

    async updateAlertEventsStatus(digestId, status, nowIso) {
      const { error } = await db
        .from('push_alert_events')
        .update({ status, updated_at: nowIso })
        .eq('digest_id', digestId);
      if (error) throw error;
    },

    async updateUserProcessStatus(userId, update) {
      const patch: Record<string, unknown> = {
        last_processed_at: update.lastProcessedAt,
        last_processed_local_date: update.lastProcessedLocalDate,
        last_process_status: update.lastProcessStatus,
        last_process_message: update.lastProcessMessage,
        updated_at: update.lastProcessedAt,
      };
      if (update.lastPushAcceptedAt !== undefined) {
        patch.last_push_accepted_at = update.lastPushAcceptedAt;
      }
      const { error } = await db
        .from('push_notification_preferences')
        .update(patch)
        .eq('user_id', userId);
      if (error) throw error;
    },

    async getUserStatusSummary(userId: string) {
      const [{ data: digestRow }, { data: deliveryRow }] = await Promise.all([
        db
          .from('push_daily_digests')
          .select('status,local_date,sent_at,last_error,events_json')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        db
          .from('push_device_deliveries')
          .select('status,accepted_at,last_status_code,last_error,attempt_count')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const d = digestRow as Record<string, unknown> | null;
      const dl = deliveryRow as Record<string, unknown> | null;

      return {
        lastDigest: d
          ? {
              status: String(d.status),
              localDate: toIsoDateOrNull(d.local_date) || String(d.local_date),
              sentAt: toIsoTimestampOrNull(d.sent_at),
              lastError: d.last_error ? String(d.last_error) : null,
              eventsCount: Array.isArray(d.events_json) ? d.events_json.length : 0,
            }
          : null,
        lastDelivery: dl
          ? {
              status: String(dl.status),
              acceptedAt: toIsoTimestampOrNull(dl.accepted_at),
              lastStatusCode:
                typeof dl.last_status_code === 'number' ? dl.last_status_code : null,
              lastError: dl.last_error ? String(dl.last_error) : null,
              attemptCount: Number(dl.attempt_count || 0),
            }
          : null,
      };
    },
  };
}
