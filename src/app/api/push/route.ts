import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

// Chave VAPID P-256 padrão do projeto (pode ser sobrescrita via .env.local com NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY)
const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const DEFAULT_VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls';
const DEFAULT_VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:alertas@fiitracker.app';

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str: string): Buffer {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function createVapidJwt(audience: string, subject: string, publicKeyB64: string, privateKeyB64: string): string {
  const header = { typ: 'JWT', alg: 'ES256' };
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = { aud: audience, exp, sub: subject };

  const unsignedToken = `${base64UrlEncode(Buffer.from(JSON.stringify(header)))}.${base64UrlEncode(
    Buffer.from(JSON.stringify(payload))
  )}`;

  const pubBytes = base64UrlDecode(publicKeyB64); // 65 bytes (0x04 || x || y)
  const x = base64UrlEncode(pubBytes.subarray(1, 33));
  const y = base64UrlEncode(pubBytes.subarray(33, 65));
  const d = privateKeyB64;

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
function encryptWebPushPayload(
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

  // IKM via HKDF (WebPush info = "WebPush: info\0" + ua_public + as_public)
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'ascii'),
    clientPublicKeyBytes,
    serverPublicKey,
  ]);
  const ikm = hkdfExtractAndExpand(authSecret, sharedSecret, keyInfo, 32);

  // CEK (16 bytes) e Nonce (12 bytes)
  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'ascii');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'ascii');
  const cek = hkdfExtractAndExpand(salt, ikm, cekInfo, 16);
  const nonce = hkdfExtractAndExpand(salt, ikm, nonceInfo, 12);

  // Plaintext + delimiter 0x02
  const plaintext = Buffer.concat([Buffer.from(payloadText, 'utf8'), Buffer.from([2])]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  // Cabeçalho aes128gcm: salt (16) + rs (4, uint32BE = 4096) + idlen (1 = 65) + keyid (65 = serverPublicKey)
  const rsBuf = Buffer.alloc(4);
  rsBuf.writeUInt32BE(4096, 0);
  const idLenBuf = Buffer.from([serverPublicKey.length]);

  return Buffer.concat([salt, rsBuf, idLenBuf, serverPublicKey, encrypted]);
}

export async function GET() {
  return NextResponse.json({
    publicKey: DEFAULT_VAPID_PUBLIC_KEY,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, payload, delaySeconds } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Assinatura Web Push inválida ou ausente.' },
        { status: 400 }
      );
    }

    if (delaySeconds && Number(delaySeconds) > 0) {
      const waitMs = Math.min(10000, Number(delaySeconds) * 1000);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    const jwt = createVapidJwt(
      audience,
      DEFAULT_VAPID_SUBJECT,
      DEFAULT_VAPID_PUBLIC_KEY,
      DEFAULT_VAPID_PRIVATE_KEY
    );

    const payloadString = JSON.stringify(
      payload || {
        title: 'FII Tracker • Alerta da Carteira',
        body: 'Seus proventos e cotações da B3 foram atualizados!',
        url: '/',
      }
    );

    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    const headers: Record<string, string> = {
      TTL: '86400',
      Urgency: 'high',
      Authorization: `vapid t=${jwt}, k=${DEFAULT_VAPID_PUBLIC_KEY}`,
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

    const pushRes = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!pushRes.ok && pushRes.status !== 201) {
      const errText = await pushRes.text().catch(() => '');
      return NextResponse.json(
        {
          ok: false,
          status: pushRes.status,
          details: errText || 'Servidor APNs/FCM recusou o envio.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: pushRes.status,
    });
  } catch (err) {
    console.error('Erro no envio de Web Push:', err);
    return NextResponse.json(
      { error: 'Falha ao disparar Web Push.' },
      { status: 500 }
    );
  }
}

