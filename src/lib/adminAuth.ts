import crypto from 'crypto';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
export function isAdminConfigured(): boolean {
  return ADMIN_SECRET.length >= 32 && ADMIN_USERNAME.length > 0 && ADMIN_PASSWORD.length >= 12;
}

export const ADMIN_COOKIE_NAME = 'fii_admin_session_token';

/**
 * Gera um token assinado com timestamp e HMAC-SHA256
 */
export function generateAdminToken(username: string): string {
  if (!isAdminConfigured()) throw new Error("Administração não configurada.");
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
  if (!isAdminConfigured() || !token || typeof token !== 'string' || token.length > 1024) return false;

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

    if (username !== ADMIN_USERNAME || !/^[a-f0-9]{64}$/.test(signature)) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) return false;

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

