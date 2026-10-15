import crypto from 'crypto';

const ADMIN_SECRET =
  process.env.ADMIN_SECRET ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'fii-tracker-admin-secret-key-2026';

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export const ADMIN_COOKIE_NAME = 'fii_admin_session_token';

/**
 * Gera um token assinado com timestamp e HMAC-SHA256
 */
export function generateAdminToken(username: string): string {
  const timestamp = Date.now();
  const payload = `${username}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Valida a integridade da assinatura do token e a expiração (7 dias)
 */
export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;

    const [username, timestampStr, signature] = parts;
    if (!username || !timestampStr || !signature) return false;

    // Verifica assinatura HMAC
    const expectedSignature = crypto
      .createHmac('sha256', ADMIN_SECRET)
      .update(`${username}:${timestampStr}`)
      .digest('hex');

    if (signature !== expectedSignature) return false;

    // Valida tempo de vida (7 dias de expiração máxima)
    const timestamp = Number(timestampStr);
    const age = Date.now() - timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000;

    return age >= 0 && age < maxAge;
  } catch {
    return false;
  }
}

/**
 * Extrai o token de admin dos cookies ou do header Authorization da requisição
 */
export function extractAdminTokenFromRequest(request: Request): string | null {
  // 1. Tenta extrair do header Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // 2. Tenta extrair do header Cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    if (c.startsWith(`${ADMIN_COOKIE_NAME}=`)) {
      return c.substring(ADMIN_COOKIE_NAME.length + 1).trim();
    }
  }

  return null;
}

