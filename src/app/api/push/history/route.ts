import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, serverDatabase } from '../../../../lib/serverSecurity';
import { createSupabasePushStorage, type PushHistoryCursor } from '../../../../lib/serverPushEngine';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' };
const PAGE_SIZE = 20;

function parseCursor(raw: string | null): PushHistoryCursor | null | false {
  if (raw === null || raw === '') return null;
  if (raw.length > 256 || !/^[A-Za-z0-9_-]+$/.test(raw)) return false;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const separator = decoded.lastIndexOf('|');
    if (separator < 0) return false;
    const createdAt = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt) || !Number.isFinite(Date.parse(createdAt)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return false;
    // Preserve database timestamp precision (Postgres may return microseconds).
    return { createdAt, id };
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Faça login para consultar seus alertas.' }, {
      status: 401,
      headers: NO_STORE_HEADERS,
    });
  }

  const cursor = parseCursor(request.nextUrl.searchParams.get('cursor'));
  if (cursor === false) {
    return NextResponse.json({ error: 'Cursor de paginação inválido.' }, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const storage = createSupabasePushStorage(serverDatabase());
    if (!storage.getUserAlertHistory) {
      return NextResponse.json({ error: 'Histórico de alertas indisponível.' }, {
        status: 503,
        headers: NO_STORE_HEADERS,
      });
    }
    const page = await storage.getUserAlertHistory(user.id, cursor, PAGE_SIZE);
    return NextResponse.json(page, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar o histórico de alertas.' }, {
      status: 503,
      headers: NO_STORE_HEADERS,
    });
  }
}
