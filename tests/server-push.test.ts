import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  verifyCronAuthorization,
  getUserLocalDateTime,
  isUserDueForDailySummary,
  evaluateUserPortfolioEvents,
  buildDailySummaryNotification,
  hasStatementDividendReceipt,
  calculateNextRetryTimestamp,
  runServerPushCron,
  type PushStorageAdapter,
  type ServerPushPreferences,
  type StoredPushSubscription,
  type StoredAlertEvent,
  type StoredDailyDigest,
  type StoredDeviceDelivery,
  type CandidateAlertEvent,
} from '../src/lib/serverPushEngine';
import {
  buildVerifiedAnnouncement,
  clearAnnouncementCache,
  fetchVerifiedAnnouncementForTicker,
  type VerifiedDividendAnnouncement,
} from '../src/lib/marketDividendSource';
import { buildSafePushUrl, parsePushNavigationUrl } from '../src/lib/pushNavigation';
import type { Transaction } from '../src/types/portfolio';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

function makeCronRequest(authHeader?: string | null): Request {
  const headers = new Headers();
  if (authHeader) {
    headers.set('authorization', authHeader);
  }
  return new Request('http://localhost:3000/api/push/cron', {
    method: 'POST',
    headers,
  });
}

async function createPgLitePushStorage(): Promise<{
  db: PGlite;
  storage: PushStorageAdapter;
}> {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    INSERT INTO auth.users VALUES ('${USER_A}'), ('${USER_B}');
  `);
  const schema = readFileSync('supabase/schema.sql', 'utf8');
  const migration = readFileSync('supabase/migrations/20261020_server_web_push.sql', 'utf8');
  const recoveryMigration = readFileSync('supabase/migrations/20261021_push_recovery_fixes.sql', 'utf8');
  await db.exec(schema);
  await db.exec(migration);
  await db.exec(recoveryMigration);
  await db.exec('SET ROLE service_role;');

  const toIsoTs = (v: unknown): string | null =>
    !v ? null : v instanceof Date ? v.toISOString() : String(v);
  const toIsoDate = (v: unknown): string | null =>
    !v ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

  const mapPrefs = (r: Record<string, unknown>): ServerPushPreferences => ({
    userId: String(r.user_id),
    enabled: Boolean(r.enabled),
    notifyConfirmedDividend: Boolean(r.notify_confirmed_dividend),
    notifyExDate: Boolean(r.notify_ex_date),
    notifyPaymentDay: Boolean(r.notify_payment_day),
    notifyPriceOpportunity: Boolean(r.notify_price_opportunity),
    notifyMarketBargain: Boolean(r.notify_market_bargain),
    notifyMentorConsensus: Boolean(r.notify_mentor_consensus),
    dailyTime: String(r.daily_time || '08:00'),
    timezone: String(r.timezone || 'America/Sao_Paulo'),
    privacyMode: r.privacy_mode === 'detailed' ? 'detailed' : 'discreet',
    lastProcessedAt: toIsoTs(r.last_processed_at),
    lastProcessedLocalDate: toIsoDate(r.last_processed_local_date),
    lastProcessStatus: (r.last_process_status as ServerPushPreferences['lastProcessStatus']) || null,
    lastProcessMessage: r.last_process_message ? String(r.last_process_message) : null,
    lastPushAcceptedAt: toIsoTs(r.last_push_accepted_at),
    updatedAt: toIsoTs(r.updated_at) || undefined,
  });

  const mapSub = (r: Record<string, unknown>): StoredPushSubscription => ({
    id: String(r.id),
    userId: String(r.user_id),
    endpoint: String(r.endpoint),
    p256dh: String(r.p256dh),
    auth: String(r.auth),
    userAgent: r.user_agent ? String(r.user_agent) : null,
    deviceLabel: r.device_label ? String(r.device_label) : null,
    isActive: Boolean(r.is_active),
    deactivatedReason: r.deactivated_reason ? String(r.deactivated_reason) : null,
    lastStatusCode: typeof r.last_status_code === 'number' ? r.last_status_code : null,
    lastAcceptedAt: toIsoTs(r.last_accepted_at),
    lastError: r.last_error ? String(r.last_error) : null,
  });

  const storage: PushStorageAdapter = {
    async listCandidateUsers() {
      const res = await db.query(
        `SELECT p.* FROM public.push_notification_preferences p
         WHERE p.enabled = true OR EXISTS (
           SELECT 1 FROM public.push_daily_digests d
           WHERE d.user_id = p.user_id AND d.status IN ('processing', 'retry_pending')
         )`
      );
      return res.rows.map((r) => mapPrefs(r as Record<string, unknown>));
    },

    async getUserPreferences(userId) {
      const res = await db.query(
        `SELECT * FROM public.push_notification_preferences WHERE user_id = $1::uuid`,
        [userId]
      );
      return res.rows[0] ? mapPrefs(res.rows[0] as Record<string, unknown>) : null;
    },

    async upsertUserPreferences(userId, prefs, options) {
      const existing = await this.getUserPreferences(userId);
      if (existing && options?.onlyIfAbsent) return existing;
      const nowIso = options?.nowIso || new Date().toISOString();
      const merged = {
        enabled: prefs.enabled ?? existing?.enabled ?? false,
        notifyConfirmedDividend:
          prefs.notifyConfirmedDividend ?? existing?.notifyConfirmedDividend ?? true,
        notifyExDate: prefs.notifyExDate ?? existing?.notifyExDate ?? true,
        notifyPaymentDay: prefs.notifyPaymentDay ?? existing?.notifyPaymentDay ?? true,
        notifyPriceOpportunity:
          prefs.notifyPriceOpportunity ?? existing?.notifyPriceOpportunity ?? true,
        notifyMarketBargain:
          prefs.notifyMarketBargain ?? existing?.notifyMarketBargain ?? true,
        notifyMentorConsensus:
          prefs.notifyMentorConsensus ?? existing?.notifyMentorConsensus ?? true,
        dailyTime: prefs.dailyTime ?? existing?.dailyTime ?? '08:00',
        timezone: prefs.timezone ?? existing?.timezone ?? 'America/Sao_Paulo',
        privacyMode: prefs.privacyMode ?? existing?.privacyMode ?? 'discreet',
      };

      const res = await db.query(
        `INSERT INTO public.push_notification_preferences (
          user_id, enabled, notify_confirmed_dividend, notify_ex_date, notify_payment_day,
          notify_price_opportunity, notify_market_bargain, notify_mentor_consensus,
          daily_time, timezone, privacy_mode, updated_at
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz)
        ON CONFLICT (user_id) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          notify_confirmed_dividend = EXCLUDED.notify_confirmed_dividend,
          notify_ex_date = EXCLUDED.notify_ex_date,
          notify_payment_day = EXCLUDED.notify_payment_day,
          daily_time = EXCLUDED.daily_time,
          timezone = EXCLUDED.timezone,
          privacy_mode = EXCLUDED.privacy_mode,
          updated_at = EXCLUDED.updated_at
        RETURNING *`,
        [
          userId,
          merged.enabled,
          merged.notifyConfirmedDividend,
          merged.notifyExDate,
          merged.notifyPaymentDay,
          merged.notifyPriceOpportunity,
          merged.notifyMarketBargain,
          merged.notifyMentorConsensus,
          merged.dailyTime,
          merged.timezone,
          merged.privacyMode,
          nowIso,
        ]
      );
      return mapPrefs(res.rows[0] as Record<string, unknown>);
    },

    async listUserSubscriptions(userId, onlyActive = false) {
      const sql = onlyActive
        ? `SELECT * FROM public.push_subscriptions WHERE user_id = $1::uuid AND is_active = true ORDER BY created_at ASC`
        : `SELECT * FROM public.push_subscriptions WHERE user_id = $1::uuid ORDER BY created_at ASC`;
      const res = await db.query(sql, [userId]);
      return res.rows.map((r) => mapSub(r as Record<string, unknown>));
    },

    async upsertUserSubscription(userId, sub, nowIso = new Date().toISOString()) {
      const res = await db.query(
        `INSERT INTO public.push_subscriptions (
          user_id, endpoint, p256dh, auth, user_agent, device_label, is_active, updated_at
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, true, $7::timestamptz)
        ON CONFLICT (user_id, endpoint) DO UPDATE SET
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          device_label = EXCLUDED.device_label,
          is_active = true,
          deactivated_reason = NULL,
          updated_at = EXCLUDED.updated_at
        RETURNING *`,
        [
          userId,
          sub.endpoint,
          sub.p256dh,
          sub.auth,
          sub.userAgent || null,
          sub.deviceLabel || null,
          nowIso,
        ]
      );
      return mapSub(res.rows[0] as Record<string, unknown>);
    },

    async deactivateUserSubscription(
      userId,
      subIdOrEndpoint,
      reason,
      statusCode = null,
      nowIso = new Date().toISOString()
    ) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(subIdOrEndpoint);
      const sql = isUuid
        ? `UPDATE public.push_subscriptions SET is_active = false, deactivated_reason = $3, last_status_code = $4, updated_at = $5::timestamptz WHERE user_id = $1::uuid AND id = $2::uuid`
        : `UPDATE public.push_subscriptions SET is_active = false, deactivated_reason = $3, last_status_code = $4, updated_at = $5::timestamptz WHERE user_id = $1::uuid AND endpoint = $2`;
      await db.query(sql, [userId, subIdOrEndpoint, reason, statusCode, nowIso]);
      return true;
    },

    async deleteUserSubscription(userId, endpointOrId) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(endpointOrId);
      const sql = isUuid
        ? `DELETE FROM public.push_subscriptions WHERE user_id = $1::uuid AND id = $2::uuid`
        : `DELETE FROM public.push_subscriptions WHERE user_id = $1::uuid AND endpoint = $2`;
      await db.query(sql, [userId, endpointOrId]);
      return true;
    },

    async getUserTransactions(userId) {
      const res = await db.query(
        `SELECT * FROM public.transactions WHERE user_id = $1::uuid ORDER BY date ASC`,
        [userId]
      );
      return res.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: String(row.id),
          ticker: String(row.ticker),
          type: (row.type as Transaction['type']) || 'BUY',
          date:
            row.date instanceof Date
              ? row.date.toISOString().slice(0, 10)
              : String(row.date).slice(0, 10),
          shares: Number(row.shares),
          price: Number(row.price),
          total: Number(row.total),
          broker: row.broker ? String(row.broker) : 'XP',
        };
      });
    },

    async claimUserLock(userId, workerId, leaseSeconds, nowIso) {
      const res = await db.query<{ locked: boolean }>(
        `SELECT public.claim_push_user_lock($1::uuid, $2, $3, $4::timestamptz) AS locked`,
        [userId, workerId, leaseSeconds, nowIso]
      );
      return res.rows[0]?.locked === true;
    },

    async releaseUserLock(userId, workerId) {
      await db.query(`SELECT public.release_push_user_lock($1::uuid, $2)`, [userId, workerId]);
    },

    async getExistingAlertEvents(userId) {
      const res = await db.query(
        `SELECT * FROM public.push_alert_events WHERE user_id = $1::uuid ORDER BY created_at ASC`,
        [userId]
      );
      return res.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: String(row.id),
          userId: String(row.user_id),
          ticker: String(row.ticker),
          eventType: row.event_type as StoredAlertEvent['eventType'],
          eventReference: String(row.event_reference),
          dataVersion: String(row.data_version),
          source: String(row.source),
          sourceEventDate: toIsoDate(row.source_event_date) || String(row.source_event_date),
          payload:
            typeof row.payload === 'string'
              ? JSON.parse(row.payload)
              : (row.payload as Record<string, unknown>) || {},
          digestId: row.digest_id ? String(row.digest_id) : null,
          status: row.status as StoredAlertEvent['status'],
        };
      });
    },

    async getRecoverableDigests(userId, nowIso) {
      const res = await db.query(
        `SELECT * FROM public.push_daily_digests WHERE user_id = $1::uuid AND status IN ('processing', 'retry_pending') ORDER BY created_at ASC`,
        [userId]
      );
      return res.rows
        .map((r) => {
          const row = r as Record<string, unknown>;
          return {
            id: String(row.id),
            userId: String(row.user_id),
            localDate: toIsoDate(row.local_date) || String(row.local_date),
            digestKey: String(row.digest_key),
            title: String(row.title),
            body: String(row.body),
            url: String(row.url),
            tag: String(row.tag),
            eventsJson:
              typeof row.events_json === 'string'
                ? JSON.parse(row.events_json)
                : (row.events_json as CandidateAlertEvent[]) || [],
            status: row.status as StoredDailyDigest['status'],
            attemptCount: Number(row.attempt_count || 0),
            nextAttemptAt: toIsoTs(row.next_attempt_at) || new Date().toISOString(),
            lockedBy: row.locked_by ? String(row.locked_by) : null,
            lockedUntil: toIsoTs(row.locked_until),
            sentAt: toIsoTs(row.sent_at),
            lastError: row.last_error ? String(row.last_error) : null,
          };
        })
        .filter((d) => {
          if (d.status === 'processing') {
            return !d.lockedUntil || d.lockedUntil <= nowIso;
          }
          return d.nextAttemptAt <= nowIso;
        });
    },

    async reserveDigestAndEvents(params) {
      const lockedUntilIso = new Date(
        new Date(params.nowIso).getTime() + params.leaseSeconds * 1000
      ).toISOString();

      const digestRes = await db.query(
        `INSERT INTO public.push_daily_digests (
          user_id, local_date, digest_key, title, body, url, tag, events_json,
          status, next_attempt_at, locked_by, locked_until, updated_at
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, 'processing', $9::timestamptz, $10, $11::timestamptz, $9::timestamptz)
        ON CONFLICT (user_id, local_date, digest_key) DO NOTHING
        RETURNING *`,
        [
          params.userId,
          params.localDate,
          params.digestKey,
          params.title,
          params.body,
          params.url,
          params.tag,
          JSON.stringify(params.events),
          params.nowIso,
          params.workerId,
          lockedUntilIso,
        ]
      );

      if (digestRes.rows.length === 0) return null;
      const dRow = digestRes.rows[0] as Record<string, unknown>;
      const digestId = String(dRow.id);

      let reservedEventsCount = 0;
      for (const ev of params.events) {
        const evRes = await db.query(
          `INSERT INTO public.push_alert_events (
            user_id, ticker, event_type, event_reference, data_version, source, source_event_date,
            payload, digest_id, status, updated_at
          ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::uuid, 'reserved', $10::timestamptz)
          ON CONFLICT (user_id, ticker, event_type, event_reference, data_version) DO NOTHING
          RETURNING id`,
          [
            params.userId,
            ev.ticker,
            ev.eventType,
            ev.eventReference,
            ev.dataVersion,
            ev.source,
            ev.sourceEventDate,
            JSON.stringify({
              amountPerShare: ev.amountPerShare,
              exDate: ev.exDate,
              paymentDate: ev.paymentDate,
              referenceCycle: ev.paymentDate.slice(0, 7),
            }),
            digestId,
            params.nowIso,
          ]
        );
        if (evRes.rows.length > 0) reservedEventsCount++;
      }

      return {
        digest: {
          id: digestId,
          userId: params.userId,
          localDate: params.localDate,
          digestKey: params.digestKey,
          title: params.title,
          body: params.body,
          url: params.url,
          tag: params.tag,
          eventsJson: params.events,
          status: 'processing',
          attemptCount: 0,
          nextAttemptAt: params.nowIso,
          lockedBy: params.workerId,
          lockedUntil: lockedUntilIso,
        },
        reservedEventsCount,
      };
    },

    async ensureDeviceDeliveries(digestId, userId, subscriptions, maxAttempts, nowIso) {
      for (const s of subscriptions) {
        await db.query(
          `INSERT INTO public.push_device_deliveries (
            digest_id, subscription_id, user_id, status, attempt_count, max_attempts, next_attempt_at, updated_at
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'pending', 0, $4, $5::timestamptz, $5::timestamptz)
          ON CONFLICT (digest_id, subscription_id) DO NOTHING`,
          [digestId, s.id, userId, maxAttempts, nowIso]
        );
      }

      const res = await db.query(
        `SELECT * FROM public.push_device_deliveries WHERE digest_id = $1::uuid ORDER BY created_at ASC`,
        [digestId]
      );
      const subMap = new Map(subscriptions.map((s) => [s.id, s]));
      return res.rows.map((r) => {
        const row = r as Record<string, unknown>;
        const subId = String(row.subscription_id);
        return {
          id: String(row.id),
          digestId: String(row.digest_id),
          subscriptionId: subId,
          userId: String(row.user_id),
          status: row.status as StoredDeviceDelivery['status'],
          attemptCount: Number(row.attempt_count || 0),
          maxAttempts: Number(row.max_attempts || maxAttempts),
          nextAttemptAt: new Date(String(row.next_attempt_at)).toISOString(),
          lastStatusCode:
            typeof row.last_status_code === 'number' ? row.last_status_code : null,
          lastError: row.last_error ? String(row.last_error) : null,
          acceptedAt: row.accepted_at ? new Date(String(row.accepted_at)).toISOString() : null,
          subscription: subMap.get(subId),
        };
      });
    },

    async markDeliverySending(deliveryId, attemptCount, nowIso) {
      const res = await db.query(
        `UPDATE public.push_device_deliveries SET status = 'sending', attempt_count = $2, updated_at = $3::timestamptz WHERE id = $1::uuid AND status IN ('pending','retry_pending') AND next_attempt_at <= $3::timestamptz RETURNING id`,
        [deliveryId, attemptCount, nowIso]
      );
      return res.rows.length > 0;
    },

    async updateDeliveryResult(deliveryId, update) {
      await db.query(
        `UPDATE public.push_device_deliveries SET
          status = $2,
          attempt_count = $3,
          next_attempt_at = COALESCE($4::timestamptz, next_attempt_at),
          last_status_code = $5,
          last_error = $6,
          accepted_at = $7::timestamptz,
          updated_at = $8::timestamptz
        WHERE id = $1::uuid`,
        [
          deliveryId,
          update.status,
          update.attemptCount,
          update.nextAttemptAt || null,
          update.lastStatusCode ?? null,
          update.lastError ?? null,
          update.acceptedAt ?? null,
          update.nowIso,
        ]
      );
    },

    async updateDigestStatus(digestId, update) {
      await db.query(
        `UPDATE public.push_daily_digests SET
          status = $2,
          attempt_count = COALESCE($3, attempt_count),
          next_attempt_at = COALESCE($4::timestamptz, next_attempt_at),
          sent_at = COALESCE($5::timestamptz, sent_at),
          last_error = $6,
          locked_by = $7,
          locked_until = $8::timestamptz,
          updated_at = $9::timestamptz
        WHERE id = $1::uuid`,
        [
          digestId,
          update.status,
          update.attemptCount ?? null,
          update.nextAttemptAt ?? null,
          update.sentAt ?? null,
          update.lastError ?? null,
          update.lockedBy ?? null,
          update.lockedUntil ?? null,
          update.nowIso,
        ]
      );
    },

    async updateAlertEventsStatus(digestId, status, nowIso) {
      await db.query(
        `UPDATE public.push_alert_events SET status = $2, updated_at = $3::timestamptz WHERE digest_id = $1::uuid`,
        [digestId, status, nowIso]
      );
    },

    async updateUserProcessStatus(userId, update) {
      await db.query(
        `UPDATE public.push_notification_preferences SET
          last_processed_at = $2::timestamptz,
          last_processed_local_date = $3,
          last_process_status = $4,
          last_process_message = $5,
          last_push_accepted_at = COALESCE($6::timestamptz, last_push_accepted_at),
          updated_at = $2::timestamptz
        WHERE user_id = $1::uuid`,
        [
          userId,
          update.lastProcessedAt,
          update.lastProcessedLocalDate,
          update.lastProcessStatus,
          update.lastProcessMessage,
          update.lastPushAcceptedAt ?? null,
        ]
      );
    },

    async getUserStatusSummary() {
      return { lastDigest: null, lastDelivery: null };
    },
  };

  return { db, storage };
}

test('cron authentication fails closed when CRON_SECRET is missing, short, reused, or mismatched', () => {
  // 1. Missing secret -> 503
  assert.deepEqual(
    verifyCronAuthorization(makeCronRequest('Bearer some-token'), {}),
    {
      ok: false,
      status: 503,
      error: 'CRON_SECRET ausente ou insuficiente no servidor.',
    }
  );

  // 2. Secret shorter than 16 chars -> 503
  assert.equal(
    verifyCronAuthorization(makeCronRequest('Bearer short'), { CRON_SECRET: 'short' }).status,
    503
  );

  // 3. Reusing SUPABASE_SERVICE_ROLE_KEY or VAPID_PRIVATE_KEY -> 503 (must be exclusive)
  const sharedSecret = 'super-secret-value-at-least-16-chars';
  assert.equal(
    verifyCronAuthorization(makeCronRequest(`Bearer ${sharedSecret}`), {
      CRON_SECRET: sharedSecret,
      SUPABASE_SERVICE_ROLE_KEY: sharedSecret,
    }).status,
    503
  );

  // 4. Invalid or missing Authorization header -> 401
  const validCronSecret = 'exclusive-cron-secret-2026-secure-key';
  assert.equal(
    verifyCronAuthorization(makeCronRequest(null), { CRON_SECRET: validCronSecret }).status,
    401
  );
  assert.equal(
    verifyCronAuthorization(makeCronRequest('Bearer wrong-secret-value-123456'), {
      CRON_SECRET: validCronSecret,
    }).status,
    401
  );

  // 5. Exact exclusive secret -> 200
  assert.deepEqual(
    verifyCronAuthorization(makeCronRequest(`Bearer ${validCronSecret}`), {
      CRON_SECRET: validCronSecret,
      SUPABASE_SERVICE_ROLE_KEY: 'different-service-role-key-12345',
    }),
    { ok: true, status: 200 }
  );
});

test('digest and alert events are reserved atomically by the recovery migration', async () => {
  const { db } = await createPgLitePushStorage();
  const validEvent = {
    ticker: 'HGLG11',
    eventType: 'DIVIDEND_ANNOUNCED',
    eventReference: 'cycle:2026-10-08:2026-10-15',
    dataVersion: 'v1',
    source: 'StatusInvest',
    sourceEventDate: '2026-10-08',
    amountPerShare: 1.1,
    exDate: '2026-10-08',
    exDateBr: '08 out',
    paymentDate: '2026-10-15',
    paymentDateBr: '15 out',
    eligibleShares: 10,
    personalTotalAmount: 11,
    priority: 80,
  };
  const baseArgs = [
    USER_A,
    '2026-10-08',
    'atomic-digest',
    'Resumo diário',
    'Há eventos na carteira.',
    '/?tab=proventos',
    'daily:2026-10-08',
    null,
    'test-worker',
    300,
    '2026-10-08T11:00:00.000Z',
  ] as const;
  const reserve = (events: unknown) =>
    db.query(
      `SELECT public.reserve_push_digest_and_events(
        $1::uuid, $2::date, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::integer, $11::timestamptz
      ) AS result`,
      [...baseArgs.slice(0, 7), JSON.stringify(events), ...baseArgs.slice(8)]
    );

  await assert.rejects(
    reserve([
      validEvent,
      { ...validEvent, eventType: 'INVALID_EVENT_TYPE', eventReference: 'invalid-cycle' },
    ])
  );
  const afterRollback = await db.query(
    `SELECT
      (SELECT count(*) FROM public.push_daily_digests WHERE digest_key = 'atomic-digest') AS digests,
      (SELECT count(*) FROM public.push_alert_events WHERE event_reference LIKE '%atomic%') AS events`
  );
  const rollbackCounts = afterRollback.rows[0] as Record<string, unknown>;
  assert.equal(Number(rollbackCounts.digests), 0);
  assert.equal(Number(rollbackCounts.events), 0);

  const successful = await reserve([validEvent]);
  assert.ok((successful.rows[0] as Record<string, unknown>).result);
  const persisted = await db.query(
    `SELECT
      (SELECT count(*) FROM public.push_daily_digests WHERE digest_key = 'atomic-digest') AS digests,
      (SELECT count(*) FROM public.push_alert_events WHERE event_reference = 'cycle:2026-10-08:2026-10-15') AS events`
  );
  const persistedCounts = persisted.rows[0] as Record<string, unknown>;
  assert.equal(Number(persistedCounts.digests), 1);
  assert.equal(Number(persistedCounts.events), 1);
  await db.close();
});

test('schedule evaluation respects user dailyTime, IANA timezone, and day rollover', () => {
  // 10:50 UTC = 07:50 America/Sao_Paulo (before 08:00)
  const before8amSp = new Date('2026-10-20T10:50:00Z');
  const checkBefore = isUserDueForDailySummary(
    before8amSp,
    '08:00',
    'America/Sao_Paulo',
    null
  );
  assert.equal(checkBefore.due, false);
  assert.equal(checkBefore.localDate, '2026-10-20');

  // 11:05 UTC = 08:05 America/Sao_Paulo (due!)
  const after8amSp = new Date('2026-10-20T11:05:00Z');
  const checkAfter = isUserDueForDailySummary(
    after8amSp,
    '08:00',
    'America/Sao_Paulo',
    null
  );
  assert.equal(checkAfter.due, true);
  assert.equal(checkAfter.localDate, '2026-10-20');

  // In America/Manaus (UTC-4), 11:05 UTC is 07:05 (not yet 08:00!)
  assert.equal(
    isUserDueForDailySummary(after8amSp, '08:00', 'America/Manaus', null).due,
    false
  );
  assert.equal(
    isUserDueForDailySummary(
      new Date('2026-10-20T12:05:00Z'),
      '08:00',
      'America/Manaus',
      null
    ).due,
    true
  );

  // Already processed on 2026-10-20 -> not due again on same local day
  assert.equal(
    isUserDueForDailySummary(after8amSp, '08:00', 'America/Sao_Paulo', '2026-10-20').due,
    false
  );

  // Next local day rollover (2026-10-21 at 08:01 BRT = 11:01 UTC) -> due again!
  const nextDay8amSp = new Date('2026-10-21T11:01:00Z');
  const checkNextDay = isUserDueForDailySummary(
    nextDay8amSp,
    '08:00',
    'America/Sao_Paulo',
    '2026-10-20'
  );
  assert.equal(checkNextDay.due, true);
  assert.equal(checkNextDay.localDate, '2026-10-21');

  // Day boundary across UTC midnight (e.g. Asia/Tokyo UTC+9):
  // 2026-10-20T23:30:00Z is already 2026-10-21 08:30 in Asia/Tokyo
  const tokyoLocal = getUserLocalDateTime(new Date('2026-10-20T23:30:00Z'), 'Asia/Tokyo');
  assert.equal(tokyoLocal.localDate, '2026-10-21');
  assert.equal(tokyoLocal.localTime, '08:30');
});

test('estimates, static catalog, Yahoo fallback, and manual dividends never generate confirmed announcements', () => {
  const refDate = '2026-10-15';

  // 1. Static catalog ('CATALOGO') -> rejected
  assert.equal(
    buildVerifiedAnnouncement({
      ticker: 'HGLG11',
      source: 'CATALOGO',
      isCurrentMonthAnnounced: true,
      amountPerShare: 1.1,
      exDate: '14/10/2026',
      paymentDate: '25/10/2026',
      referenceDateIso: refDate,
    }),
    null
  );

  // 2. Yahoo 12m average ('MERCADO') -> rejected
  assert.equal(
    buildVerifiedAnnouncement({
      ticker: 'HGLG11',
      source: 'MERCADO',
      isCurrentMonthAnnounced: true,
      amountPerShare: 1.1,
      exDate: '14/10/2026',
      paymentDate: '25/10/2026',
      referenceDateIso: refDate,
    }),
    null
  );

  // 3. Manual override ('MANUAL') -> rejected
  assert.equal(
    buildVerifiedAnnouncement({
      ticker: 'HGLG11',
      source: 'MANUAL',
      isCurrentMonthAnnounced: true,
      amountPerShare: 1.1,
      exDate: '14/10/2026',
      paymentDate: '25/10/2026',
      referenceDateIso: refDate,
    }),
    null
  );

  // 4. Missing paymentDate or exDate -> rejected
  assert.equal(
    buildVerifiedAnnouncement({
      ticker: 'HGLG11',
      source: 'STATUS_INVEST',
      isCurrentMonthAnnounced: true,
      amountPerShare: 1.1,
      exDate: '14/10/2026',
      paymentDate: null,
      referenceDateIso: refDate,
    }),
    null
  );

  // 5. Stale historical cycle -> rejected
  assert.equal(
    buildVerifiedAnnouncement({
      ticker: 'HGLG11',
      source: 'STATUS_INVEST',
      isCurrentMonthAnnounced: true,
      amountPerShare: 1.1,
      exDate: '14/06/2026',
      paymentDate: '25/06/2026',
      referenceDateIso: refDate,
    }),
    null
  );

  // 6. Verified StatusInvest announcement in current cycle -> accepted
  const verified = buildVerifiedAnnouncement({
    ticker: 'HGLG11',
    source: 'STATUS_INVEST',
    isCurrentMonthAnnounced: true,
    amountPerShare: 1.1,
    exDate: '14/10/2026',
    paymentDate: '25/10/2026',
    referenceDateIso: refDate,
  });
  assert.ok(verified);
  assert.equal(verified.source, 'STATUS_INVEST');
  assert.equal(verified.exDate, '2026-10-14');
  assert.equal(verified.paymentDate, '2026-10-25');
  assert.equal(verified.amountPerShare, 1.1);
});

test('verified market source retains multiple payout cycles and uses explicit free-source fields', async () => {
  clearAnnouncementCache();
  try {
    const rows = [
      { v: 1.1, ed: '15/10/2026', pd: '19/10/2026' },
      { v: 1.2, ed: '15/11/2026', pd: '19/11/2026' },
    ];
    const announcements = await fetchVerifiedAnnouncementForTicker('HGLG11', {
      referenceDateIso: '2026-10-19',
      bypassCache: true,
      fetchImpl: async () =>
        new Response(JSON.stringify({ assetEarningsModels: rows }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    assert.deepEqual(announcements.map((event) => event.paymentDate), [
      '2026-10-19',
      '2026-11-19',
    ]);
    const evaluation = evaluateUserPortfolioEvents({
      localDate: '2026-10-19',
      preferences: {
        notifyConfirmedDividend: true,
        notifyExDate: true,
        notifyPaymentDay: true,
      },
      transactions: [{
        id: 'tx-hglg-buy', ticker: 'HGLG11', type: 'BUY', date: '2026-10-01',
        shares: 20, price: 160, total: 3200, broker: 'XP',
      }],
      announcements: { HGLG11: announcements },
      existingEvents: [],
    });
    assert.ok(evaluation.some((event) =>
      event.eventType === 'PAYMENT_REMINDER' && event.paymentDate === '2026-10-19'
    ));

    clearAnnouncementCache();
    const fallback = await fetchVerifiedAnnouncementForTicker('HGLG11', {
      referenceDateIso: '2026-10-19',
      bypassCache: true,
      fetchImpl: async (input) => {
        if (String(input).includes('statusinvest.com.br')) {
          return new Response('unavailable', { status: 503 });
        }
        return new Response('<table id="resultado"><thead><tr><th>Última Data Com</th><th>Tipo</th><th>Data de Pagamento</th><th>Valor</th></tr></thead><tbody><tr><td>15/10/2026</td><td>Rendimento</td><td>25/10/2026</td><td>1,10</td></tr></tbody></table>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=iso-8859-1' },
        });
      },
    });
    assert.equal(fallback[0]?.source, 'FUNDAMENTUS');
    assert.equal(fallback[0]?.amountPerShare, 1.1);
    assert.equal(fallback[0]?.exDate, '2026-10-15');
    assert.equal(fallback[0]?.paymentDate, '2026-10-25');

    clearAnnouncementCache();
    let fundamentusUrl = '';
    const verifiedFallback = await fetchVerifiedAnnouncementForTicker('HGLG11', {
      referenceDateIso: '2026-10-19',
      bypassCache: true,
      fetchImpl: async (input) => {
        if (String(input).includes('statusinvest.com.br')) {
          return new Response('unavailable', { status: 503 });
        }
        fundamentusUrl = String(input);
        return new Response('<table id="resultado"><thead><tr><th>Última Data Com</th><th>Tipo</th><th>Data de Pagamento</th><th>Valor</th></tr></thead><tbody><tr><td>14/10/2026</td><td>Amortização</td><td>25/10/2026</td><td>2,00</td></tr><tr><td>14/10/2026</td><td>Rendimento</td><td>25/10/2026</td><td>1,10</td></tr></tbody></table>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=iso-8859-1' },
        });
      },
    });
    assert.equal(fundamentusUrl, 'https://www.fundamentus.com.br/fii_proventos.php?papel=HGLG11&tipo=2');
    assert.equal(verifiedFallback.length, 1);
    assert.equal(verifiedFallback[0]?.source, 'FUNDAMENTUS');
    assert.equal(verifiedFallback[0]?.exDate, '2026-10-14');
    assert.equal(verifiedFallback[0]?.paymentDate, '2026-10-25');

    clearAnnouncementCache();
    await assert.rejects(
      fetchVerifiedAnnouncementForTicker('HGLG11', {
        referenceDateIso: '2026-10-19',
        bypassCache: true,
        fetchImpl: async () => new Response('unavailable', { status: 503 }),
      }),
      /fontes de proventos indisponíveis/i
    );
  } finally {
    clearAnnouncementCache();
  }
});

test('a receipt from another payout date in the same month does not suppress the event', () => {
  const transactions: Transaction[] = [{
    id: 'tx-div-earlier',
    ticker: 'XPML11',
    type: 'DIVIDEND',
    date: '2026-10-10',
    shares: 50,
    price: 0.9,
    total: 45,
    broker: 'XP',
  }];
  assert.equal(
    hasStatementDividendReceipt(transactions, 'XPML11', '2026-10-25', '2026-09-30'),
    false
  );
  assert.equal(
    hasStatementDividendReceipt(transactions, 'XPML11', '2026-10-10', '2026-09-30'),
    true
  );
});

test('announcement modification generates DIVIDEND_UPDATED and payment reminder respects statement receipts', () => {
  const prefs: ServerPushPreferences = {
    userId: USER_A,
    enabled: true,
    notifyConfirmedDividend: true,
    notifyExDate: true,
    notifyPaymentDay: true,
    notifyPriceOpportunity: false,
    notifyMarketBargain: false,
    notifyMentorConsensus: false,
    dailyTime: '08:00',
    timezone: 'America/Sao_Paulo',
    privacyMode: 'discreet',
  };

  const txs: Transaction[] = [
    {
      id: 'tx-buy-1',
      ticker: 'XPML11',
      type: 'BUY',
      date: '2026-10-01',
      shares: 50,
      price: 100,
      total: 5000,
      broker: 'XP',
    },
  ];

  const initialAnnouncement = buildVerifiedAnnouncement({
    ticker: 'XPML11',
    source: 'STATUS_INVEST',
    isCurrentMonthAnnounced: true,
    amountPerShare: 0.9,
    exDate: '15/10/2026',
    paymentDate: '25/10/2026',
    referenceDateIso: '2026-10-10',
  })!;

  // 1. First evaluation on 2026-10-10 -> generates DIVIDEND_ANNOUNCED
  const events1 = evaluateUserPortfolioEvents({
    localDate: '2026-10-10',
    preferences: prefs,
    transactions: txs,
    announcements: { XPML11: initialAnnouncement },
    existingEvents: [],
  });
  assert.equal(events1.length, 1);
  assert.equal(events1[0].eventType, 'DIVIDEND_ANNOUNCED');
  assert.equal(events1[0].amountPerShare, 0.9);

  const storedAfter1: StoredAlertEvent[] = [
    {
      id: 'ev-1',
      userId: USER_A,
      ticker: 'XPML11',
      eventType: events1[0].eventType,
      eventReference: events1[0].eventReference,
      dataVersion: events1[0].dataVersion,
      source: events1[0].source,
      sourceEventDate: events1[0].sourceEventDate,
      payload: {
        amountPerShare: events1[0].amountPerShare,
        exDate: events1[0].exDate,
        paymentDate: events1[0].paymentDate,
        referenceCycle: '2026-10',
      },
      status: 'sent',
    },
  ];

  // 2. Re-evaluating with identical announcement -> 0 events
  const eventsDuplicate = evaluateUserPortfolioEvents({
    localDate: '2026-10-11',
    preferences: prefs,
    transactions: txs,
    announcements: { XPML11: initialAnnouncement },
    existingEvents: storedAfter1,
  });
  assert.equal(eventsDuplicate.length, 0);

  // 3. Confirmed change in amountPerShare (0.90 -> 0.95) -> generates DIVIDEND_UPDATED
  const updatedAnnouncement = buildVerifiedAnnouncement({
    ticker: 'XPML11',
    source: 'STATUS_INVEST',
    isCurrentMonthAnnounced: true,
    amountPerShare: 0.95,
    exDate: '15/10/2026',
    paymentDate: '25/10/2026',
    referenceDateIso: '2026-10-12',
  })!;

  const eventsUpdated = evaluateUserPortfolioEvents({
    localDate: '2026-10-12',
    preferences: prefs,
    transactions: txs,
    announcements: { XPML11: updatedAnnouncement },
    existingEvents: storedAfter1,
  });
  assert.equal(eventsUpdated.length, 1);
  assert.equal(eventsUpdated[0].eventType, 'DIVIDEND_UPDATED');
  assert.equal(eventsUpdated[0].amountPerShare, 0.95);
  assert.equal(eventsUpdated[0].previousAmountPerShare, 0.9);

  // 4. On paymentDate (2026-10-25), generates PAYMENT_REMINDER ("pagamento anunciado para hoje")
  const storedAfterUpdate: StoredAlertEvent[] = [
    ...storedAfter1,
    {
      id: 'ev-2',
      userId: USER_A,
      ticker: 'XPML11',
      eventType: eventsUpdated[0].eventType,
      eventReference: eventsUpdated[0].eventReference,
      dataVersion: eventsUpdated[0].dataVersion,
      source: eventsUpdated[0].source,
      sourceEventDate: eventsUpdated[0].sourceEventDate,
      payload: {
        amountPerShare: eventsUpdated[0].amountPerShare,
        exDate: eventsUpdated[0].exDate,
        paymentDate: eventsUpdated[0].paymentDate,
        referenceCycle: '2026-10',
      },
      status: 'sent',
    },
  ];

  const paymentDayEvents = evaluateUserPortfolioEvents({
    localDate: '2026-10-25',
    preferences: prefs,
    transactions: txs,
    announcements: { XPML11: updatedAnnouncement },
    existingEvents: storedAfterUpdate,
  });
  assert.equal(paymentDayEvents.length, 1);
  assert.equal(paymentDayEvents[0].eventType, 'PAYMENT_REMINDER');

  // 5. Once a DIVIDEND receipt exists in the statement (transactions), PAYMENT_REMINDER is not sent
  const txsWithReceipt: Transaction[] = [
    ...txs,
    {
      id: 'tx-div-1',
      ticker: 'XPML11',
      type: 'DIVIDEND',
      date: '2026-10-25',
      shares: 50,
      price: 0.95,
      total: 47.5,
      broker: 'XP',
    },
  ];
  const paymentDayWithReceipt = evaluateUserPortfolioEvents({
    localDate: '2026-10-25',
    preferences: prefs,
    transactions: txsWithReceipt,
    announcements: { XPML11: updatedAnnouncement },
    existingEvents: storedAfterUpdate,
  });
  assert.equal(paymentDayWithReceipt.length, 0);
});

test('discreet privacy mode hides personal quantities/values and URLs contain zero sensitive data', () => {
  const sampleEvent: CandidateAlertEvent = {
    ticker: 'HGLG11',
    eventType: 'PAYMENT_REMINDER',
    eventReference: 'pay:2026-10-15',
    dataVersion: 'v1',
    source: 'STATUS_INVEST',
    sourceEventDate: '2026-10-15',
    amountPerShare: 1.1,
    exDate: '2026-09-30',
    exDateBr: '30/09/2026',
    paymentDate: '2026-10-15',
    paymentDateBr: '15/10/2026',
    eligibleShares: 123,
    personalTotalAmount: 135.3,
    priority: 100,
  };

  const discreet = buildDailySummaryNotification([sampleEvent], '2026-10-15', 'discreet');
  assert.ok(!discreet.title.includes('135,30'));
  assert.ok(!discreet.body.includes('135,30'));
  assert.ok(!discreet.body.includes('123 cotas'));
  assert.ok(discreet.body.includes('StatusInvest'));
  assert.ok(discreet.body.includes('pagamento anunciado para hoje'));

  // URL contains only tab, ticker, date, and event type
  assert.equal(
    discreet.url,
    '/?tab=proventos&ticker=HGLG11&date=2026-10-15&event=PAYMENT_REMINDER'
  );
  const parsed = parsePushNavigationUrl(discreet.url);
  assert.ok(parsed);
  assert.equal(parsed.tab, 'proventos');
  assert.equal(parsed.ticker, 'HGLG11');
  assert.equal(parsed.date, '2026-10-15');
  assert.equal(parsed.eventType, 'PAYMENT_REMINDER');

  // Detailed mode explicitly opted-in includes eligible shares and personal amount in body, but still never in URL
  const detailed = buildDailySummaryNotification([sampleEvent], '2026-10-15', 'detailed');
  assert.ok(detailed.body.includes('123 cotas'));
  assert.equal(
    detailed.url,
    '/?tab=proventos&ticker=HGLG11&date=2026-10-15&event=PAYMENT_REMINDER'
  );
  const repeatedPayment = buildDailySummaryNotification([
    sampleEvent,
    { ...sampleEvent, eventType: 'DIVIDEND_ANNOUNCED', eventReference: 'cycle:2026-09-30:2026-10-15' },
  ], '2026-10-15', 'detailed');
  assert.ok(repeatedPayment.body.includes('R$ 135,30'));
  assert.ok(!repeatedPayment.body.includes('R$ 270,60'));

  // External or protocol-relative URLs are rejected
  assert.equal(parsePushNavigationUrl('https://evil.example/?tab=proventos'), null);
  assert.equal(parsePushNavigationUrl('//evil.example/?tab=proventos'), null);
  assert.equal(buildSafePushUrl({ tab: 'proventos', ticker: 'HGLG11' }), '/?tab=proventos&ticker=HGLG11');
});

test('server cron deduplication, multi-device 410 expiration, bounded retries, recovery, and shared market batching', async () => {
  const { db, storage } = await createPgLitePushStorage();
  try {
    // Setup User A and User B both holding HGLG11
    await db.query(
      `INSERT INTO public.transactions(id, user_id, ticker, type, date, shares, price, total)
       VALUES
         ('u1-tx1', $1::uuid, 'HGLG11', 'BUY', '2026-10-01', 20, 160, 3200),
         ('u2-tx1', $2::uuid, 'HGLG11', 'BUY', '2026-10-01', 10, 160, 1600)`,
      [USER_A, USER_B]
    );

    await storage.upsertUserPreferences(USER_A, {
      enabled: true,
      dailyTime: '08:00',
      timezone: 'America/Sao_Paulo',
      privacyMode: 'discreet',
    });
    await storage.upsertUserPreferences(USER_B, {
      enabled: true,
      dailyTime: '08:00',
      timezone: 'America/Sao_Paulo',
      privacyMode: 'discreet',
    });

    // User A has 2 devices: dev1 (will return 410 Expired) and dev2 (will return 201 Accepted)
    const subA1 = await storage.upsertUserSubscription(USER_A, {
      endpoint: 'https://fcm.googleapis.com/fcm/send/user-a-expired-410',
      p256dh: 'p256dh_key_user_a_dev_1_valid_length_1234567890',
      auth: 'auth_key_a1_123456',
      deviceLabel: 'Old iPhone',
    });
    const subA2 = await storage.upsertUserSubscription(USER_A, {
      endpoint: 'https://fcm.googleapis.com/fcm/send/user-a-active-201',
      p256dh: 'p256dh_key_user_a_dev_2_valid_length_1234567890',
      auth: 'auth_key_a2_123456',
      deviceLabel: 'Current iPhone',
    });

    // User B has 1 device that initially fails with 503 (transient_error) and succeeds on retry
    await storage.upsertUserSubscription(USER_B, {
      endpoint: 'https://fcm.googleapis.com/fcm/send/user-b-transient-503',
      p256dh: 'p256dh_key_user_b_dev_1_valid_length_1234567890',
      auth: 'auth_key_b1_123456',
      deviceLabel: 'Android PWA',
    });

    let marketBatchCalls = 0;
    const marketFetcher = async (tickers: string[], referenceDateIso: string) => {
      marketBatchCalls++;
      const record: Record<string, VerifiedDividendAnnouncement> = {};
      for (const ticker of tickers) {
        const verified = buildVerifiedAnnouncement({
          ticker,
          source: 'STATUS_INVEST',
          isCurrentMonthAnnounced: true,
          amountPerShare: 1.1,
          exDate: '14/10/2026',
          paymentDate: '25/10/2026',
          referenceDateIso,
        });
        if (verified) record[ticker] = verified;
      }
      return record;
    };

    let userBShouldFailTransient = true;
    const sentEndpoints: string[] = [];

    const pushSender = async (sub: { endpoint: string }) => {
      sentEndpoints.push(sub.endpoint);
      if (sub.endpoint.includes('expired-410')) {
        return {
          ok: false,
          statusCode: 410,
          outcome: 'expired' as const,
          errorMessage: 'HTTP 410 Gone',
        };
      }
      if (sub.endpoint.includes('transient-503') && userBShouldFailTransient) {
        return {
          ok: false,
          statusCode: 503,
          outcome: 'transient_error' as const,
          errorMessage: 'HTTP 503 Service Unavailable',
        };
      }
      return {
        ok: true,
        statusCode: 201,
        outcome: 'accepted' as const,
      };
    };

    // Run 1 at 2026-10-15 08:05 BRT (11:05 UTC)
    const run1 = await runServerPushCron({
      storage,
      marketFetcher,
      pushSender,
      now: new Date('2026-10-15T11:05:00Z'),
      workerId: 'worker-1',
      baseRetrySeconds: 300, // 5 minutes base retry
    });

    // Market query was shared across both users in a single batch call!
    assert.equal(marketBatchCalls, 1);
    assert.equal(run1.usersEvaluated, 2);
    assert.equal(run1.subscriptionsExpired, 1);
    assert.equal(run1.deliveriesAccepted, 1); // User A's 2nd device succeeded
    assert.equal(run1.deliveriesRetried, 1); // User B's device scheduled for retry

    // Verify User A's expired subscription was deactivated while the active one remained active
    const subsA = await storage.listUserSubscriptions(USER_A, false);
    const expiredSubA = subsA.find((s) => s.id === subA1.id)!;
    const activeSubA = subsA.find((s) => s.id === subA2.id)!;
    assert.equal(expiredSubA.isActive, false);
    assert.equal(activeSubA.isActive, true);

    // Run 2 immediately at 08:06 BRT:
    // - User A was already sent today -> skipped (not duplicated!)
    // - User B's retry backoff (5 minutes -> 11:10 UTC) has not elapsed yet -> 0 deliveries sent
    sentEndpoints.length = 0;
    const run2 = await runServerPushCron({
      storage,
      marketFetcher,
      pushSender,
      now: new Date('2026-10-15T11:06:00Z'),
      workerId: 'worker-2',
      baseRetrySeconds: 300,
    });
    assert.equal(run2.deliveriesAccepted, 0);
    assert.equal(sentEndpoints.length, 0);

    // Run 3 at 08:11 BRT (11:11 UTC, after 5m backoff) with User B's push service healthy:
    userBShouldFailTransient = false;
    const run3 = await runServerPushCron({
      storage,
      marketFetcher,
      pushSender,
      now: new Date('2026-10-15T11:11:00Z'),
      workerId: 'worker-3',
      baseRetrySeconds: 300,
    });
    assert.equal(run3.digestsRecovered, 1);
    assert.equal(run3.deliveriesAccepted, 1);
    assert.deepEqual(sentEndpoints, ['https://fcm.googleapis.com/fcm/send/user-b-transient-503']);

    // Verify exponential/increasing retry schedule helper
    const baseNow = new Date('2026-10-15T11:00:00Z');
    const retry1 = new Date(calculateNextRetryTimestamp(baseNow, 1, 60)).getTime() - baseNow.getTime();
    const retry2 = new Date(calculateNextRetryTimestamp(baseNow, 2, 60)).getTime() - baseNow.getTime();
    const retry3 = new Date(calculateNextRetryTimestamp(baseNow, 3, 60)).getTime() - baseNow.getTime();
    assert.ok(retry2 > retry1);
    assert.ok(retry3 > retry2);

    // Simulate an interrupted digest ('processing' with expired lock) for User A on the next day
    const recoveryEvent: CandidateAlertEvent = {
      ticker: 'HGLG11', eventType: 'DIVIDEND_ANNOUNCED',
      eventReference: 'cycle:2026-10-20:2026-10-25', dataVersion: 'v=1.1|ed=2026-10-20|pd=2026-10-25',
      source: 'STATUS_INVEST', sourceEventDate: '2026-10-20', amountPerShare: 1.1,
      exDate: '2026-10-20', exDateBr: '20/10/2026',
      paymentDate: '2026-10-25', paymentDateBr: '25/10/2026',
      eligibleShares: 20, personalTotalAmount: 22, priority: 95,
    };
    const interruptedInsert = await db.query<{ id: string }>(
      `INSERT INTO public.push_daily_digests (
        user_id, local_date, digest_key, title, body, url, tag, events_json,
        status, attempt_count, next_attempt_at, locked_by, locked_until
      ) VALUES (
        $1::uuid, '2026-10-16', 'interrupted-digest-key',
        'FII Tracker • Resumo Recuperado', 'Corpo do resumo recuperado', '/?tab=proventos&ticker=HGLG11', 'tag-rec', $2::jsonb,
        'processing', 0, '2026-10-16T11:00:00Z'::timestamptz, 'crashed-worker', '2026-10-16T11:02:00Z'::timestamptz
      ) RETURNING id`,
      [USER_A, JSON.stringify([recoveryEvent])]
    );
    assert.ok(interruptedInsert.rows[0].id);

    sentEndpoints.length = 0;
    const runRecovery = await runServerPushCron({
      storage,
      marketFetcher,
      pushSender,
      now: new Date('2026-10-16T11:05:00Z'),
      workerId: 'recovery-worker',
    });
    assert.equal(runRecovery.digestsRecovered >= 1, true);
    assert.ok(sentEndpoints.includes('https://fcm.googleapis.com/fcm/send/user-a-active-201'));
  } finally {
    await db.close();
  }
});
