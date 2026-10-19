import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  protectedApi,
  readLimitedJson,
  serverDatabase,
} from '../../../lib/serverSecurity';
import { isAllowedPushEndpoint } from '../../../lib/pushValidation';
import {
  DEFAULT_VAPID_PUBLIC_KEY,
  getServerVapidConfig,
  sendWebPushMessage,
} from '../../../lib/webPushCrypto';
import {
  createSupabasePushStorage,
  type ServerPushPreferences,
} from '../../../lib/serverPushEngine';

function hashEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint, 'utf8').digest('hex');
}

function isValidPushKey(value: unknown, minLen = 16, maxLen = 256): value is string {
  return (
    typeof value === 'string' &&
    value.length >= minLen &&
    value.length <= maxLen &&
    /^[A-Za-z0-9+/=_-]+$/.test(value)
  );
}

export async function GET(request: NextRequest) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
  const vapidConfigured = Boolean(getServerVapidConfig());
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const cronConfigured = cronSecret.length >= 16;

  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json(
      {
        publicKey,
        vapidConfigured,
        cronConfigured,
        authenticated: false,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  try {
    const storage = createSupabasePushStorage(serverDatabase());
    const [preferences, subscriptions, statusSummary] = await Promise.all([
      storage.getUserPreferences(user.id),
      storage.listUserSubscriptions(user.id, false),
      storage.getUserStatusSummary(user.id),
    ]);

    return NextResponse.json(
      {
        publicKey,
        vapidConfigured,
        cronConfigured,
        authenticated: true,
        preferences,
        subscriptions: subscriptions.map((s) => ({
          id: s.id,
          endpointHash: hashEndpoint(s.endpoint),
          deviceLabel: s.deviceLabel,
          isActive: s.isActive,
          deactivatedReason: s.deactivatedReason,
          lastStatusCode: s.lastStatusCode,
          lastAcceptedAt: s.lastAcceptedAt,
          lastError: s.lastError,
          updatedAt: s.updatedAt,
        })),
        statusSummary,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json(
      {
        publicKey,
        vapidConfigured,
        cronConfigured,
        authenticated: true,
        preferences: null,
        subscriptions: [],
        statusSummary: null,
        serverWarning: 'Banco de dados de notificações indisponível ou migração pendente.',
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}

export async function PUT(request: NextRequest) {
  const access = await protectedApi(request, 'push-settings', 60);
  if (access.response) return access.response;

  try {
    const body = (await readLimitedJson(request, 16_000)) as {
      preferences?: Partial<ServerPushPreferences>;
      migrateOnlyIfAbsent?: boolean;
      subscription?: {
        endpoint: string;
        keys?: { p256dh: string; auth: string };
        deviceLabel?: string;
      };
    };

    const storage = createSupabasePushStorage(serverDatabase());

    let savedSubscription = null;
    if (body.subscription) {
      const sub = body.subscription;
      if (
        !isAllowedPushEndpoint(sub.endpoint) ||
        !isValidPushKey(sub.keys?.p256dh, 40, 200) ||
        !isValidPushKey(sub.keys?.auth, 12, 120)
      ) {
        return NextResponse.json(
          { error: 'Inscrição Web Push inválida.' },
          { status: 400 }
        );
      }

      const userAgent = (request.headers.get('user-agent') || '').slice(0, 250);
      const deviceLabel =
        typeof sub.deviceLabel === 'string' ? sub.deviceLabel.slice(0, 80) : null;

      savedSubscription = await storage.upsertUserSubscription(access.user.id, {
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
        deviceLabel,
      });
    }

    const preferences = await storage.upsertUserPreferences(
      access.user.id,
      body.preferences || {},
      { onlyIfAbsent: Boolean(body.migrateOnlyIfAbsent) }
    );

    return NextResponse.json(
      {
        ok: true,
        preferences,
        subscription: savedSubscription
          ? {
              id: savedSubscription.id,
              endpointHash: hashEndpoint(savedSubscription.endpoint),
              isActive: savedSubscription.isActive,
            }
          : null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível salvar configurações de Web Push no servidor.' },
      { status: 503 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
  }

  try {
    const body = (await readLimitedJson(request, 8_000).catch(() => ({}))) as {
      endpoint?: string;
      subscriptionId?: string;
      disablePreferences?: boolean;
    };

    const target = body.subscriptionId || body.endpoint;
    if (!target || typeof target !== 'string') {
      return NextResponse.json(
        { error: 'Informe a inscrição a remover.' },
        { status: 400 }
      );
    }

    const storage = createSupabasePushStorage(serverDatabase());
    await storage.deleteUserSubscription(user.id, target);

    if (body.disablePreferences) {
      const remaining = await storage.listUserSubscriptions(user.id, true);
      if (remaining.length === 0) {
        await storage.upsertUserPreferences(user.id, { enabled: false });
      }
    }

    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível remover a inscrição Push.' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await protectedApi(request, 'push', 30);
  if (access.response) return access.response;

  try {
    const vapidConfig = getServerVapidConfig();
    if (!vapidConfig) {
      return NextResponse.json(
        { error: 'VAPID_PRIVATE_KEY não configurada no servidor.' },
        { status: 500 }
      );
    }

    const body = (await readLimitedJson(request, 12_000)) as {
      subscription?: { endpoint: string; keys?: { p256dh: string; auth: string } };
      payload?: { title?: string; body?: string; tag?: string; url?: string };
      delaySeconds?: number;
    };
    const { subscription, payload, delaySeconds } = body;

    if (!subscription || !isAllowedPushEndpoint(subscription.endpoint)) {
      return NextResponse.json(
        { error: 'Assinatura Web Push inválida ou ausente.' },
        { status: 400 }
      );
    }

    if (
      payload &&
      (typeof payload.title !== 'string' ||
        typeof payload.body !== 'string' ||
        payload.title.length > 150 ||
        payload.body.length > 1500 ||
        (payload.url && (!payload.url.startsWith('/') || payload.url.startsWith('//'))))
    ) {
      return NextResponse.json({ error: 'Notificação inválida.' }, { status: 400 });
    }

    if (delaySeconds && Number(delaySeconds) > 0) {
      const waitMs = Math.min(10000, Number(delaySeconds) * 1000);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const finalPayload = {
      title: payload?.title || 'FII Tracker • Alerta da Carteira',
      body: payload?.body || 'Seus proventos e cotações da B3 foram atualizados!',
      tag: payload?.tag || 'fii-test-push',
      url: payload?.url || '/?tab=proventos',
    };

    const sendRes = await sendWebPushMessage(subscription, finalPayload, vapidConfig);

    // Atualiza estado da inscrição no banco caso esteja disponível
    try {
      const storage = createSupabasePushStorage(serverDatabase());
      if (sendRes.outcome === 'expired') {
        await storage.deactivateUserSubscription(
          access.user.id,
          subscription.endpoint,
          sendRes.errorMessage || `HTTP ${sendRes.statusCode ?? 410}`,
          sendRes.statusCode ?? 410
        );
      }
    } catch {
      // Banco opcional para o disparo direto de teste
    }

    if (!sendRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: sendRes.statusCode ?? 502,
          outcome: sendRes.outcome,
          details: sendRes.errorMessage || 'Servidor APNs/FCM recusou o envio.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: sendRes.statusCode ?? 201,
      deliveryState: 'accepted_by_push_service',
    });
  } catch {
    return NextResponse.json(
      { error: 'Falha ao disparar Web Push.' },
      { status: 500 }
    );
  }
}
