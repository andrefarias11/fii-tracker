import { consumeRateLimit, readLimitedJson } from '../../../../lib/serverSecurity';
import { timingSafeEqual, createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  ADMIN_USERNAME,
  isAdminConfigured,
  ADMIN_PASSWORD,
  ADMIN_COOKIE_NAME,
  generateAdminToken,
  verifyAdminToken,
  extractAdminTokenFromRequest,
} from '../../../../lib/adminAuth';

export async function POST(request: Request) {
  try {
    if (!isAdminConfigured()) return NextResponse.json({ error: 'Administração não configurada.' }, { status: 503 });
    if (!await consumeRateLimit('admin-login', 10, 900)) return NextResponse.json({ error: 'Aguarde antes de tentar novamente.' }, { status: 429 });
    const body = await readLimitedJson(request, 4096) as { username?: unknown; password?: unknown };
    const { username, password } = body || {};

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: 'Informe usuário e senha.' },
        { status: 400 }
      );
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password);

    // Compara com as credenciais configuradas
    const isValid =
      cleanUser === ADMIN_USERNAME &&
      timingSafeEqual(createHash('sha256').update(cleanPass).digest(), createHash('sha256').update(ADMIN_PASSWORD).digest());

    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: 'Credenciais administrativas inválidas.' },
        { status: 401 }
      );
    }

    const token = generateAdminToken(cleanUser);

    const response = NextResponse.json({
      ok: true,
      message: 'Autenticado com sucesso',
      username: cleanUser,
    });

    // Define cookie HTTP-Only seguro com validade de 7 dias
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 dias
    });

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Login indisponível. Verifique a configuração do servidor.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const token = extractAdminTokenFromRequest(request);
  const isValid = verifyAdminToken(token);

  return NextResponse.json({
    authenticated: isValid,
    username: isValid ? ADMIN_USERNAME : null,
  });
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    message: 'Sessão administrativa encerrada',
  });

  // Limpa o cookie
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

