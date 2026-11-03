import 'server-only';
import {
  createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign,
} from 'node:crypto';

/**
 * Minimal RFC 8291 / RFC 8188 Web Push encryption using Node's native crypto.
 * No third-party queue, Firebase account, dependency or additional client bundle.
 * Application private keys stay in encrypted Vercel environment variables.
 */
export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};
export type WebPushOutcome = { outcome: 'delivered' | 'revoked' | 'retry' | 'failed'; code: string };

const b64url = (v: Buffer | string) =>
  Buffer.from(v).toString('base64url');
const fromB64 = (v: string) => Buffer.from(v, 'base64url');

function allowedEndpoint(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.port || url.username || url.password ||
        url.hash || raw.length > 2048) return null;
    const host = url.hostname.toLowerCase();
    if (!['fcm.googleapis.com', 'updates.push.services.mozilla.com',
      'web.push.apple.com'].includes(host) &&
      !/^wns[0-9]*\.notify\.windows\.com$/.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

function configuredVapid() {
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (!privateKey) return null;
  const bytes = fromB64(privateKey);
  if (bytes.length !== 32) return null;
  const ecdh = createECDH('prime256v1');
  try { ecdh.setPrivateKey(bytes); } catch { return null; }
  const publicKey = ecdh.getPublicKey(undefined, 'uncompressed');
  const configuredPublic = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  if (!configuredPublic || configuredPublic !== b64url(publicKey)) return null;
  const privateJwk = createPrivateKey({
    key: {
      kty: 'EC', crv: 'P-256',
      d: b64url(bytes),
      x: b64url(publicKey.subarray(1, 33)),
      y: b64url(publicKey.subarray(33, 65)),
    },
    format: 'jwk',
  });
  return { privateJwk, publicKey, publicString: configuredPublic };
}

export function pushConfigured(): boolean {
  return configuredVapid() !== null;
}

function encryptPayload(subscription: PushSubscriptionKeys, payload: string): Buffer {
  const receiverPublicKey = fromB64(subscription.p256dh);
  const authenticationSecret = fromB64(subscription.auth_secret);
  if (receiverPublicKey.length !== 65 || receiverPublicKey[0] !== 4 ||
      authenticationSecret.length < 16 || authenticationSecret.length > 32) {
    throw new Error('INVALID_SUBSCRIPTION_KEY');
  }

  const sender = createECDH('prime256v1');
  sender.generateKeys();
  const senderPublicKey = sender.getPublicKey(undefined, 'uncompressed');
  const sharedSecret = sender.computeSecret(receiverPublicKey);
  const info = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'), receiverPublicKey, senderPublicKey,
  ]);
  const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authenticationSecret, info, 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt,
    Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt,
    Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12));
  // RFC 8188 final record delimiter: 0x02.
  const text = Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])]);
  if (text.length > 3500) throw new Error('PUSH_PAYLOAD_TOO_LARGE');
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(text), cipher.final()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([
    salt, recordSize, Buffer.from([senderPublicKey.length]), senderPublicKey,
    ciphertext, cipher.getAuthTag(),
  ]);
}

export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  message: { title: string; body: string; url: string; tag: string },
): Promise<WebPushOutcome> {
  const endpoint = allowedEndpoint(subscription.endpoint);
  if (!endpoint) return { outcome: 'revoked', code: 'UNSAFE_ENDPOINT' };
  const vapid = configuredVapid();
  if (!vapid) return { outcome: 'retry', code: 'PUSH_NOT_CONFIGURED' };
  let encrypted: Buffer;
  try {
    encrypted = encryptPayload(subscription, JSON.stringify(message));
  } catch {
    return { outcome: 'revoked', code: 'INVALID_KEYS' };
  }
  const jwtHeader = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const jwtClaims = b64url(JSON.stringify({
    aud: endpoint.origin,
    exp: Math.floor(Date.now() / 1000) + 6 * 60 * 60,
    sub: 'https://www.aurotap.in',
  }));
  const jwtInput = jwtHeader + '.' + jwtClaims;
  const signature = sign('sha256', Buffer.from(jwtInput), {
    key: vapid.privateJwk, dsaEncoding: 'ieee-p1363',
  });
  try {
    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: {
        'Authorization': 'vapid t=' + jwtInput + '.' + b64url(signature) +
          ', k=' + vapid.publicString,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': '300',
        'Urgency': 'normal',
      },
      body: new Uint8Array(encrypted),
      signal: AbortSignal.timeout(7000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (response.ok) return { outcome: 'delivered', code: String(response.status) };
    if (response.status === 404 || response.status === 410)
      return { outcome: 'revoked', code: String(response.status) };
    if (response.status === 429 || response.status >= 500)
      return { outcome: 'retry', code: String(response.status) };
    return { outcome: 'failed', code: String(response.status) };
  } catch {
    return { outcome: 'retry', code: 'NETWORK_ERROR' };
  }
}
