import { NextRequest, NextResponse } from 'next/server';
import { serverDatabase } from '../../../../lib/serverSecurity';
import {
  createSupabasePushStorage,
  runServerPushCron,
  verifyCronAuthorization,
} from '../../../../lib/serverPushEngine';
import { fetchVerifiedAnnouncementsBatch } from '../../../../lib/marketDividendSource';
import { getServerVapidConfig, sendWebPushMessage } from '../../../../lib/webPushCrypto';

async function handleCronRequest(request: NextRequest) {
  const auth = verifyCronAuthorization(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error || 'Não autorizado.' },
      { status: auth.status, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  const vapidConfig = getServerVapidConfig();
  if (!vapidConfig) {
    return NextResponse.json(
      { ok: false, error: 'Configuração VAPID do servidor ausente.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  let db;
  try {
    db = serverDatabase();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Configuração de banco de dados do servidor ausente.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  try {
    const storage = createSupabasePushStorage(db);
    const metrics = await runServerPushCron({
      storage,
      marketFetcher: (tickers, referenceDateIso) =>
        fetchVerifiedAnnouncementsBatch(tickers, { referenceDateIso }),
      pushSender: (subscription, payload) =>
        sendWebPushMessage(subscription, payload, vapidConfig),
    });

    return NextResponse.json(metrics, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Falha ao processar alertas agendados.' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

