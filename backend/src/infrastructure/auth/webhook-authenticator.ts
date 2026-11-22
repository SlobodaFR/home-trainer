import { createHash, timingSafeEqual } from 'crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  matchesWebhookSignature,
  parseWebhookSignatureHeader,
} from '../../domain/auth/webhook-signature';
import { FeatureFlags } from '../../domain/shared/feature-flags';

/** When on, the signature is mandatory and the legacy `?secret=` is ignored (code default: off). */
const REQUIRE_SIGNATURE_FLAG = 'auth-webhook-require-signature';
const MAX_CLOCK_SKEW_SECONDS = 120;
const REPLAY_WINDOW_MS = 10 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIX_SECONDS = /^[0-9]{1,15}$/;

export interface WebhookRequest {
  /** Exact bytes of the JSON body (Nest `rawBody: true`). */
  rawBody?: Buffer;
  /** X-Auth-Webhook-Id */
  id?: string;
  /** X-Auth-Webhook-Timestamp (unix seconds) */
  timestamp?: string;
  /** X-Auth-Webhook-Signature (`v1=<hex>[,v1=<hex>]`) */
  signature?: string;
  /** Legacy `?secret=` query parameter, as parsed (may be an array or an object). */
  legacySecret?: unknown;
}

/** Why a request is not authentic by signature; also the reason named in the logs. */
type SignatureProblem =
  | 'no-signature-headers'
  | 'missing-signing-secret'
  | 'format'
  | 'window'
  | 'raw-body-unavailable'
  | 'hmac';

const LOG_INTERVAL_MS = 5 * 60_000;

/** Optional injection token for the clock (epoch ms); defaults to `Date.now`. */
export const WEBHOOK_NOW = Symbol('WEBHOOK_NOW');

/**
 * Authenticates the logout webhook sent by home-auth (contract PC7), in double acceptance: a valid
 * signature OR the legacy `?secret=` compared in constant time. With the flag
 * `auth-webhook-require-signature` on, only a valid signature passes.
 *
 * As soon as a signature header is present (id, timestamp or signature non-empty) and the id was
 * already accepted in the last 10 minutes (replay), the request is refused EVEN with a valid
 * `?secret=`: that check runs first, before format, signing-secret and raw-body checks. Any other
 * signature failure (format, window, hmac) or impossibility to check (no signing secret, raw body
 * unavailable) falls back to the legacy secret while the flag is off.
 *
 * Signature: |now - timestamp| <= 120 s, HMAC-SHA256(secret, id.timestamp.rawBody) matching one of
 * the `v1=` entries, and an id not seen in the last 10 minutes (kept in memory: lost on restart,
 * per process). An id is remembered only once its signature is valid.
 *
 * Observability, to be read before turning the strict flag on: a request accepted through the
 * legacy secret always logs a WARN naming the reason (no-signature-headers, missing-signing-secret,
 * format, window, raw-body-unavailable, hmac), and a request accepted by signature logs
 * an INFO, each at most once per 5 minutes per reason (logs are throttled: judge over a day of
 * deliveries, not by counting lines). No secret, signature or id is ever logged.
 */
@Injectable()
export class WebhookAuthenticator {
  private readonly logger = new Logger(WebhookAuthenticator.name);
  /** id → expiry (ms). Insertion order is expiry order: one fixed window. */
  private readonly seenIds = new Map<string, number>();
  private readonly lastLogs = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlags,
    @Optional()
    @Inject(WEBHOOK_NOW)
    private readonly now: () => number = Date.now,
  ) {}

  async authenticate(request: WebhookRequest): Promise<boolean> {
    const signatureRequired = await this.signatureRequired();
    const problem = this.checkSignature(request);
    if (problem === 'replay') {
      this.logThrottled(
        'warn',
        'refused:replay',
        'Logout webhook refused: replayed id (signature headers present), legacy secret not considered',
      );
      return false;
    }
    if (problem === undefined) {
      this.logThrottled(
        'log',
        'signature',
        'Logout webhook accepted via signature',
      );
      return true;
    }
    if (signatureRequired) {
      this.logThrottled(
        'warn',
        `refused:${problem}`,
        `Logout webhook refused: signature not accepted (${problem}), signature required`,
      );
      return false;
    }
    if (this.legacySecretMatches(request.legacySecret)) {
      this.logThrottled(
        'warn',
        `legacy:${problem}`,
        `Logout webhook accepted via the legacy ?secret=, not via signature (${problem})`,
      );
      return true;
    }
    this.logThrottled(
      'warn',
      `refused:${problem}`,
      `Logout webhook refused: signature not accepted (${problem}), legacy secret absent or wrong`,
    );
    return false;
  }

  /** One line per key every 5 minutes: a flood of deliveries (or of attacks) cannot flood the logs. */
  private logThrottled(
    level: 'log' | 'warn',
    key: string,
    message: string,
  ): void {
    const id = `${level}:${key}`;
    const now = this.now();
    const last = this.lastLogs.get(id);
    if (last !== undefined && now - last < LOG_INTERVAL_MS) {
      return;
    }
    this.lastLogs.set(id, now);
    this.logger[level](message);
  }

  /** Never blocks nor throws: any failure to read the flag means the current behaviour. */
  private async signatureRequired(): Promise<boolean> {
    try {
      return await this.flags.isEnabled(REQUIRE_SIGNATURE_FLAG, false);
    } catch {
      return false;
    }
  }

  /** Undefined when the signature is valid (and records its id), otherwise the reason. */
  private checkSignature(
    request: WebhookRequest,
  ): SignatureProblem | 'replay' | undefined {
    const { id, timestamp, signature, rawBody } = request;
    if (!id && !timestamp && !signature) {
      return 'no-signature-headers';
    }
    const now = this.now();
    // First, whatever else is wrong: an id already accepted is a replay.
    if (id && this.wasSeen(id, now)) {
      return 'replay';
    }
    if (
      !id ||
      !timestamp ||
      !signature ||
      !UUID.test(id) ||
      !UNIX_SECONDS.test(timestamp)
    ) {
      return 'format';
    }
    const received = parseWebhookSignatureHeader(signature);
    if (!received) {
      return 'format';
    }
    if (
      Math.abs(Math.floor(now / 1000) - Number(timestamp)) >
      MAX_CLOCK_SKEW_SECONDS
    ) {
      return 'window';
    }
    const secret = this.config.get<string>('AUTH_WEBHOOK_SIGNING_SECRET');
    if (!secret) {
      return 'missing-signing-secret';
    }
    if (!rawBody) {
      return 'raw-body-unavailable';
    }
    if (!matchesWebhookSignature(secret, id, timestamp, rawBody, received)) {
      return 'hmac';
    }
    this.seenIds.set(id, now + REPLAY_WINDOW_MS);
    return undefined;
  }

  /** True when the id was accepted within the replay window (purges expired ids). */
  private wasSeen(id: string, now: number): boolean {
    for (const [seen, expiresAt] of this.seenIds) {
      if (expiresAt > now) {
        break;
      }
      this.seenIds.delete(seen);
    }
    return this.seenIds.has(id);
  }

  private legacySecretMatches(provided: unknown): boolean {
    if (typeof provided !== 'string' || provided === '') {
      return false;
    }
    const expected = this.config.getOrThrow<string>('AUTH_WEBHOOK_SECRET');
    // Digests have the same length whatever the input: no length leak, no throw.
    return timingSafeEqual(digest(provided), digest(expected));
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
