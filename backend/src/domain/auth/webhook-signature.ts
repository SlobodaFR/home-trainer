import { createHmac, timingSafeEqual } from 'crypto';

/** SHA-256 output size: each `v1=` entry is exactly 32 bytes once hex-decoded. */
const SIGNATURE_BYTES = 32;
const MAX_ENTRIES = 4;
const ENTRY = /^v1=([0-9a-fA-F]{64})$/;

/**
 * Logout webhook signature (home-auth contract PC7):
 * hex = HMAC-SHA256(secret, `${id}.${timestamp}.${rawBody}`). The key is the secret string as
 * stored (64 hex characters, UTF-8), not its decoded bytes; rawBody is the exact bytes received.
 */
export function computeWebhookSignature(
  secret: string,
  id: string,
  timestamp: string,
  rawBody: string | Buffer,
): string {
  return createHmac('sha256', secret)
    .update(`${id}.${timestamp}.`)
    .update(rawBody)
    .digest('hex');
}

/**
 * Decodes `X-Auth-Webhook-Signature` (`v1=<hex>[,v1=<hex>]`, two entries during a secret
 * rotation) into 32-byte signatures. Null when the header is malformed: empty, an entry that is
 * not `v1=` plus 64 hex characters, or more entries than any rotation needs.
 */
export function parseWebhookSignatureHeader(header: string): Buffer[] | null {
  const entries = header.split(',').map((entry) => entry.trim());
  if (entries.length > MAX_ENTRIES) {
    return null;
  }
  const signatures: Buffer[] = [];
  for (const entry of entries) {
    const hex = ENTRY.exec(entry)?.[1];
    if (hex === undefined) {
      return null;
    }
    const signature = Buffer.from(hex, 'hex');
    if (signature.length !== SIGNATURE_BYTES) {
      return null;
    }
    signatures.push(signature);
  }
  return signatures;
}

/** True when one of the received signatures is the HMAC of the message under `secret`. */
export function matchesWebhookSignature(
  secret: string,
  id: string,
  timestamp: string,
  rawBody: string | Buffer,
  received: readonly Buffer[],
): boolean {
  const expected = Buffer.from(
    computeWebhookSignature(secret, id, timestamp, rawBody),
    'hex',
  );
  // No short-circuit: every entry is compared, whatever the earlier results.
  let matched = false;
  for (const signature of received) {
    if (timingSafeEqual(signature, expected)) {
      matched = true;
    }
  }
  return matched;
}
