import crypto from 'node:crypto';
import { isAllowedPushEndpoint } from './pushValidation';

export const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export const DEFAULT_VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:alertas@fiitracker.app';

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface WebPushSubscriptionInput {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
}

export interface WebPushPayloadInput {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export type WebPushDeliveryOutcome =
  | 'accepted'
  | 'expired'
  | 'transient_error'
  | 'permanent_error';

export interface WebPushSendResult {
  ok: boolean;
  outcome: WebPushDeliveryOutcome;
  statusCode: number | null;
  errorMessage?: string;
}

export function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function base64UrlDecode(str: string): Buffer {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

export function getServerVapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
  if (!privateKey) return null;
  const publicKey = (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY).trim();
  const subject = (env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT).trim();
  if (!publicKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function createVapidJwt(
  audience: string,
  subject: string,
  publicKeyB64: string,
  privateKeyB64: string
): string {
  const header = { typ: 'JWT', alg: 'ES256' };
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = { aud: audience, exp, sub: subject };

  const unsignedToken = `${base64UrlEncode(Buffer.from(JSON.stringify(header)))}.${base64UrlEncode(
    Buffer.from(JSON.stringify(payload))
  )}`;

  const pubBytes = base64UrlDecode(publicKeyB64); // 65 bytes (0x04 || x || y)
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error('Chave pública VAPID inválida.');
  }
  const x = base64UrlEncode(pubBytes.subarray(1, 33));
  const y = base64UrlEncode(pubBytes.subarray(33, 65));
  const d = base64UrlEncode(base64UrlDecode(privateKeyB64));

  const privateKey = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d,
    },
    format: 'jwk',
  });

  const signature = crypto.sign('sha256', Buffer.from(unsignedToken), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

function hkdfExtractAndExpand(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, length));
}

// Criptografia RFC 8291 (aes128gcm) exigida pelo Apple APNs (iOS Web Push) e FCM
export function encryptWebPushPayload(
  clientPublicKeyB64: string,
  clientAuthB64: string,
  payloadText: string
): Buffer {
  const clientPublicKeyBytes = base64UrlDecode(clientPublicKeyB64);
  const authSecret = base64UrlDecode(clientAuthB64);
  const salt = crypto.randomBytes(16);

  const serverECDH = crypto.createECDH('prime256v1');
  const serverPublicKey = serverECDH.generateKeys();
  const sharedSecret = serverECDH.computeSecret(clientPublicKeyBytes);

  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'ascii'),
    clientPublicKeyBytes,
    serverPublicKey,
  ]);
  const ikm = hkdfExtractAndExpand(authSecret, sharedSecret, keyInfo, 32);

  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'ascii');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'ascii');
  const cek = hkdfExtractAndExpand(salt, ikm, cekInfo, 16);
  const nonce = hkdfExtractAndExpand(salt, ikm, nonceInfo, 12);

  const plaintext = Buffer.concat([Buffer.from(payloadText, 'utf8'), Buffer.from([2])]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const rsBuf = Buffer.alloc(4);
  rsBuf.writeUInt32BE(4096, 0);
  const idLenBuf = Buffer.from([serverPublicKey.length]);

  return Buffer.concat([salt, rsBuf, idLenBuf, serverPublicKey, encrypted]);
}

export function classifyPushHttpStatus(statusCode: number): WebPushDeliveryOutcome {
  if (statusCode >= 200 && statusCode < 300) return 'accepted';
  if (statusCode === 404 || statusCode === 410) return 'expired';
  if (statusCode === 429 || statusCode >= 500) return 'transient_error';
  return 'permanent_error';
}

export async function sendWebPushMessage(
  subscription: WebPushSubscriptionInput,
  payload: WebPushPayloadInput,
  vapidConfig: VapidConfig,
  fetchImpl: typeof fetch = fetch
): Promise<WebPushSendResult> {
  if (!subscription || !isAllowedPushEndpoint(subscription.endpoint)) {
    return {
      ok: false,
      outcome: 'permanent_error',
      statusCode: 400,
      errorMessage: 'Endpoint Web Push inválido.',
    };
  }

  try {
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    const jwt = createVapidJwt(
      audience,
      vapidConfig.subject,
      vapidConfig.publicKey,
      vapidConfig.privateKey
    );

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag || 'fii-tracker-push',
      url: payload.url || '/?tab=proventos',
    });

    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    const headers: Record<string, string> = {
      TTL: '86400',
      Urgency: 'high',
      Authorization: `vapid t=${jwt}, k=${vapidConfig.publicKey}`,
    };

    let requestBody: BodyInit | undefined;
    if (p256dh && auth) {
      const encryptedBuffer = encryptWebPushPayload(p256dh, auth, payloadString);
      headers['Content-Encoding'] = 'aes128gcm';
      headers['Content-Type'] = 'application/octet-stream';
      headers['Content-Length'] = String(encryptedBuffer.length);
      requestBody = new Uint8Array(encryptedBuffer);
    } else {
      headers['Content-Length'] = '0';
    }

    const pushRes = await fetchImpl(subscription.endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers,
      body: requestBody,
    });

    const outcome = classifyPushHttpStatus(pushRes.status);
    if (outcome === 'accepted') {
      return {
        ok: true,
        outcome: 'accepted',
        statusCode: pushRes.status,
      };
    }

    return {
      ok: false,
      outcome,
      statusCode: pushRes.status,
      errorMessage:
        outcome === 'expired'
          ? `Inscrição expirada no serviço Push (HTTP ${pushRes.status}).`
          : `Serviço Push respondeu com HTTP ${pushRes.status}.`,
    };
  } catch (err) {
    const isCryptoOrKeyError =
      err instanceof Error &&
      (err.message.includes('VAPID') || err.message.includes('Invalid key') || err.message.includes('Point'));
    return {
      ok: false,
      outcome: isCryptoOrKeyError ? 'permanent_error' : 'transient_error',
      statusCode: null,
      errorMessage: isCryptoOrKeyError
        ? 'Falha na configuração criptográfica do Push.'
        : 'Falha transitória de rede ao contatar o serviço Push.',
    };
  }
}

