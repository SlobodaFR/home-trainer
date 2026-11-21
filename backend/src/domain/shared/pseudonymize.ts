import { createHmac } from 'crypto';

/**
 * Stable, non-reversible identifier for personal data (user ids and emails in logs): HMAC-SHA256 of the trimmed, lowercased value, first 16 hex characters.
 *
 * The normalization and output format are frozen: changing them, or rotating the secret,
 * re-keys every pseudonym (log correlation starts over).
 */
export function pseudonymize(value: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(value.trim().toLowerCase())
    .digest('hex')
    .slice(0, 16);
}
