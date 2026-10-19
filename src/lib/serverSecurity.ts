import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

export function serverDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuração segura do servidor ausente.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticateRequest(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

// Shared database counter: limits survive serverless restarts and multiple instances.
export async function consumeRateLimit(key: string, limit: number, seconds: number) {
  const { data, error } = await serverDatabase().rpc('consume_api_limit', {
    bucket_key: createHash('sha256').update(key).digest('hex'),
    max_requests: limit, window_seconds: seconds,
  });
  if (error) throw new Error('Controle de uso indisponível. Execute a migração do banco.');
  return data === true;
}

export async function protectedApi(request: Request, feature: string, limit = 20) {
  const user = await authenticateRequest(request);
  if (!user) return { response: NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 }), user: null };
  try {
    if (!await consumeRateLimit(`${feature}:${user.id}`, limit, 3600)) {
      return { response: NextResponse.json({ error: 'Limite de uso atingido. Tente mais tarde.' }, { status: 429 }), user: null };
    }
    return { response: null, user };
  } catch {
    return { response: NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 503 }), user: null };
  }
}

export async function readLimitedJson(request: Request, maxBytes = 100_000): Promise<unknown> {
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new Error('Corpo muito grande.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Corpo ausente.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new Error('Corpo muito grande.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
