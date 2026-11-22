import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { computeWebhookSignature } from '../../domain/auth/webhook-signature';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { WebhookAuthenticator } from './webhook-authenticator';

const SIGNING_SECRET =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const PREVIOUS_SECRET =
  'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
const LEGACY_SECRET = 'legacy-query-secret';
const NOW_MS = 1_700_000_000_000;
const NOW_S = NOW_MS / 1000;
const FLAG = 'auth-webhook-require-signature';
const BODY = Buffer.from('{"userId":"u1"}', 'utf8');

class FakeFlags extends FeatureFlags {
  readonly calls: Array<[string, boolean]> = [];
  value: boolean | 'throws' = false;
  isEnabled(key: string, codeDefault: boolean): Promise<boolean> {
    this.calls.push([key, codeDefault]);
    return this.value === 'throws'
      ? Promise.reject(new Error('flags down'))
      : Promise.resolve(this.value);
  }
}

let counter = 0;
function uuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`;
}

function signed(
  secret = SIGNING_SECRET,
  overrides: {
    id?: string;
    timestamp?: number;
    body?: Buffer;
    signature?: string;
  } = {},
) {
  const id = overrides.id ?? uuid();
  const timestamp = String(overrides.timestamp ?? NOW_S);
  const body = overrides.body ?? BODY;
  return {
    rawBody: body,
    id,
    timestamp,
    signature:
      overrides.signature ??
      `v1=${computeWebhookSignature(secret, id, timestamp, BODY)}`,
  };
}

describe('WebhookAuthenticator', () => {
  let flags: FakeFlags;
  let signingSecret: string | undefined;
  let warnings: string[];
  let infos: string[];

  function authenticator(): WebhookAuthenticator {
    const values: Record<string, string | undefined> = {
      AUTH_WEBHOOK_SECRET: LEGACY_SECRET,
      AUTH_WEBHOOK_SIGNING_SECRET: signingSecret,
    };
    const config = {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        const value = values[key];
        if (value === undefined) throw new Error(`${key} missing`);
        return value;
      },
    } as unknown as ConfigService;
    return new WebhookAuthenticator(config, flags);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    flags = new FakeFlags();
    signingSecret = SIGNING_SECRET;
    warnings = [];
    infos = [];
    vi.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      infos.push(String(message));
    });
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(
      (message: unknown) => {
        warnings.push(String(message));
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('signature (PC7)', () => {
    it('accepts a valid signature', async () => {
      await expect(authenticator().authenticate(signed())).resolves.toBe(true);
    });

    it('reads the flag with code default false', async () => {
      await authenticator().authenticate(signed());
      expect(flags.calls).toEqual([[FLAG, false]]);
    });

    it('accepts a header with two v1= entries when one matches (rotation)', async () => {
      const message = signed();
      const other = computeWebhookSignature(
        PREVIOUS_SECRET,
        message.id,
        message.timestamp,
        BODY,
      );
      await expect(
        authenticator().authenticate({
          ...message,
          signature: `v1=${other},${message.signature}`,
        }),
      ).resolves.toBe(true);
    });

    it('rejects a signature made with another secret', async () => {
      await expect(
        authenticator().authenticate(signed(PREVIOUS_SECRET)),
      ).resolves.toBe(false);
    });

    it('rejects a body that was modified after signing', async () => {
      await expect(
        authenticator().authenticate(
          signed(SIGNING_SECRET, { body: Buffer.from('{"userId":"u2"}') }),
        ),
      ).resolves.toBe(false);
    });

    it.each([
      ['missing id', { id: undefined }],
      ['missing timestamp', { timestamp: undefined }],
      ['missing signature', { signature: undefined }],
      ['missing raw body', { rawBody: undefined }],
      ['id that is not a uuid', { id: 'not-a-uuid' }],
      ['timestamp that is not an integer', { timestamp: '1700000000.5' }],
      ['timestamp in hex', { timestamp: '0x65' }],
      ['malformed signature', { signature: 'v1=zz' }],
    ])('rejects a request with %s', async (_label, patch) => {
      await expect(
        authenticator().authenticate({ ...signed(), ...patch }),
      ).resolves.toBe(false);
    });

    describe('freshness: |now - timestamp| <= 120 s', () => {
      it.each([
        ['now', 0, true],
        ['120 s in the past', -120, true],
        ['120 s in the future', 120, true],
        ['121 s in the past', -121, false],
        ['121 s in the future', 121, false],
      ])('%s', async (_label, delta, accepted) => {
        await expect(
          authenticator().authenticate(
            signed(SIGNING_SECRET, { timestamp: NOW_S + delta }),
          ),
        ).resolves.toBe(accepted);
      });
    });

    it('compares whole seconds: 120 s old at 999 ms past the second is still fresh', async () => {
      vi.setSystemTime(NOW_MS + 999);
      await expect(
        authenticator().authenticate(
          signed(SIGNING_SECRET, { timestamp: NOW_S - 120 }),
        ),
      ).resolves.toBe(true);
    });

    describe('replay: an id already seen in the last 10 minutes', () => {
      it('is rejected the second time', async () => {
        const target = authenticator();
        const message = signed();
        await expect(target.authenticate(message)).resolves.toBe(true);
        await expect(target.authenticate(message)).resolves.toBe(false);
      });

      it('is shared by every request of the process (same instance)', async () => {
        const target = authenticator();
        const first = signed();
        await target.authenticate(first);
        await expect(
          target.authenticate(signed(SIGNING_SECRET, { id: first.id })),
        ).resolves.toBe(false);
      });

      it('is accepted again after 10 minutes', async () => {
        const target = authenticator();
        const id = uuid();
        await target.authenticate(signed(SIGNING_SECRET, { id }));
        vi.setSystemTime(NOW_MS + 10 * 60_000 + 1);
        await expect(
          target.authenticate(
            signed(SIGNING_SECRET, { id, timestamp: NOW_S + 600 }),
          ),
        ).resolves.toBe(true);
      });

      it('is still rejected just before 10 minutes (timestamp kept fresh)', async () => {
        const target = authenticator();
        const id = uuid();
        await target.authenticate(signed(SIGNING_SECRET, { id }));
        vi.setSystemTime(NOW_MS + 10 * 60_000 - 1);
        await expect(
          target.authenticate(
            signed(SIGNING_SECRET, { id, timestamp: NOW_S + 599 }),
          ),
        ).resolves.toBe(false);
      });

      it('is only recorded once the signature is valid (no memory fed by strangers)', async () => {
        const target = authenticator();
        const id = uuid();
        await expect(
          target.authenticate(signed(PREVIOUS_SECRET, { id })),
        ).resolves.toBe(false);
        await expect(
          target.authenticate(signed(SIGNING_SECRET, { id })),
        ).resolves.toBe(true);
      });
    });
  });

  describe('flag off: double acceptance (signature OR legacy ?secret=)', () => {
    it('accepts the legacy secret alone (no signature headers)', async () => {
      await expect(
        authenticator().authenticate({
          rawBody: BODY,
          legacySecret: LEGACY_SECRET,
        }),
      ).resolves.toBe(true);
    });

    it('rejects a wrong or missing legacy secret', async () => {
      const target = authenticator();
      await expect(
        target.authenticate({ rawBody: BODY, legacySecret: 'wrong' }),
      ).resolves.toBe(false);
      await expect(target.authenticate({ rawBody: BODY })).resolves.toBe(false);
      await expect(
        target.authenticate({ rawBody: BODY, legacySecret: '' }),
      ).resolves.toBe(false);
    });

    it('rejects a legacy secret that is not a single string (?secret=a&secret=b)', async () => {
      await expect(
        authenticator().authenticate({
          rawBody: BODY,
          legacySecret: [LEGACY_SECRET, LEGACY_SECRET],
        }),
      ).resolves.toBe(false);
    });

    it('rejects a legacy secret that only shares a prefix or differs in length', async () => {
      const target = authenticator();
      await expect(
        target.authenticate({
          rawBody: BODY,
          legacySecret: LEGACY_SECRET.slice(0, -1),
        }),
      ).resolves.toBe(false);
      await expect(
        target.authenticate({
          rawBody: BODY,
          legacySecret: `${LEGACY_SECRET}x`,
        }),
      ).resolves.toBe(false);
    });

    it('accepts a valid signature without the legacy secret', async () => {
      await expect(authenticator().authenticate(signed())).resolves.toBe(true);
    });

    it('accepts the legacy secret when the signature is invalid (double acceptance), and says so', async () => {
      await expect(
        authenticator().authenticate({
          ...signed(PREVIOUS_SECRET),
          legacySecret: LEGACY_SECRET,
        }),
      ).resolves.toBe(true);
      expect(warnings.join('\n')).toMatch(/signature/i);
      expect(warnings.join('\n')).not.toContain(LEGACY_SECRET);
      expect(warnings.join('\n')).not.toContain(SIGNING_SECRET);
    });

    it('accepts the legacy secret when no signing secret is configured, ignoring headers', async () => {
      signingSecret = undefined;
      await expect(
        authenticator().authenticate({
          ...signed(),
          legacySecret: LEGACY_SECRET,
        }),
      ).resolves.toBe(true);
      await expect(authenticator().authenticate(signed())).resolves.toBe(false);
    });

    it('treats an empty signing secret as absent', async () => {
      signingSecret = '';
      await expect(authenticator().authenticate(signed())).resolves.toBe(false);
    });
  });

  describe(`flag ${FLAG} on: signature mandatory`, () => {
    beforeEach(() => {
      flags.value = true;
    });

    it('accepts a valid signature', async () => {
      await expect(authenticator().authenticate(signed())).resolves.toBe(true);
    });

    it('ignores a correct legacy ?secret=', async () => {
      await expect(
        authenticator().authenticate({
          rawBody: BODY,
          legacySecret: LEGACY_SECRET,
        }),
      ).resolves.toBe(false);
    });

    it('ignores the legacy secret even next to an invalid signature', async () => {
      await expect(
        authenticator().authenticate({
          ...signed(PREVIOUS_SECRET),
          legacySecret: LEGACY_SECRET,
        }),
      ).resolves.toBe(false);
    });

    it('rejects everything when no signing secret is configured (fails closed)', async () => {
      signingSecret = undefined;
      await expect(authenticator().authenticate(signed())).resolves.toBe(false);
      await expect(
        authenticator().authenticate({
          rawBody: BODY,
          legacySecret: LEGACY_SECRET,
        }),
      ).resolves.toBe(false);
    });

    it('rejects a replayed id even when the replay carries the legacy secret', async () => {
      const target = authenticator();
      const message = signed();
      await expect(target.authenticate(message)).resolves.toBe(true);
      await expect(
        target.authenticate({ ...message, legacySecret: LEGACY_SECRET }),
      ).resolves.toBe(false);
    });
  });

  describe('flag evaluation never blocks nor fails', () => {
    it('a failing evaluation behaves as flag off (legacy still accepted)', async () => {
      flags.value = 'throws';
      await expect(
        authenticator().authenticate({
          rawBody: BODY,
          legacySecret: LEGACY_SECRET,
        }),
      ).resolves.toBe(true);
    });
  });

  describe('observability (read before turning the strict flag on)', () => {
    const LEGACY = { legacySecret: LEGACY_SECRET };

    /** Requests the legacy secret saves, by the reason the signature failed. */
    const CASES: Array<
      [
        string,
        () => Promise<Parameters<WebhookAuthenticator['authenticate']>[0]>,
      ]
    > = [
      ['no-signature-headers', async () => ({ rawBody: BODY, ...LEGACY })],
      [
        'missing-signing-secret',
        async () => {
          signingSecret = undefined;
          return { ...signed(), ...LEGACY };
        },
      ],
      ['format', async () => ({ ...signed(), signature: 'v1=zz', ...LEGACY })],
      [
        'window',
        async () => ({
          ...signed(SIGNING_SECRET, { timestamp: NOW_S - 600 }),
          ...LEGACY,
        }),
      ],
      ['hmac', async () => ({ ...signed(PREVIOUS_SECRET), ...LEGACY })],
      [
        'raw-body-unavailable',
        async () => ({ ...signed(), rawBody: undefined, ...LEGACY }),
      ],
    ];

    it.each(CASES)(
      'accepted through the legacy secret: WARN naming the reason %s',
      async (reason, build) => {
        const request = await build(); // may change the configuration
        await expect(authenticator().authenticate(request)).resolves.toBe(true);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('legacy');
        expect(warnings[0]).toContain(`(${reason})`);
        expect(infos).toEqual([]);
      },
    );

    it('accepted by signature: INFO, no WARN', async () => {
      await authenticator().authenticate(signed());
      expect(infos).toHaveLength(1);
      expect(infos[0]).toMatch(/via signature/);
      expect(warnings).toEqual([]);
    });

    it('is throttled: one line per reason every 5 minutes', async () => {
      const target = authenticator();
      for (let i = 0; i < 5; i += 1) {
        await target.authenticate({ rawBody: BODY, ...LEGACY });
        await target.authenticate(signed());
      }
      expect(warnings).toHaveLength(1);
      expect(infos).toHaveLength(1);

      // Another reason is a line of its own.
      await target.authenticate({ ...signed(PREVIOUS_SECRET), ...LEGACY });
      expect(warnings).toHaveLength(2);

      vi.setSystemTime(NOW_MS + 5 * 60_000 - 1);
      await target.authenticate({ rawBody: BODY, ...LEGACY });
      expect(warnings).toHaveLength(2);

      vi.setSystemTime(NOW_MS + 5 * 60_000);
      await target.authenticate({ rawBody: BODY, ...LEGACY });
      await target.authenticate(
        signed(SIGNING_SECRET, { timestamp: NOW_S + 300 }),
      );
      expect(warnings).toHaveLength(3);
      expect(infos).toHaveLength(2);
    });

    it('refusals are logged too (throttled), and name the reason', async () => {
      await authenticator().authenticate({
        rawBody: BODY,
        legacySecret: 'wrong',
      });
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('refused');
      expect(warnings[0]).toContain('(no-signature-headers)');
    });

    it('never logs a secret, a signature or an id', async () => {
      const message = signed(PREVIOUS_SECRET);
      const target = authenticator();
      await target.authenticate({ ...message, ...LEGACY });
      await target.authenticate(signed());
      flags.value = true;
      await target.authenticate({ ...message, ...LEGACY });
      const logged = [...warnings, ...infos].join('\n');
      for (const secret of [
        LEGACY_SECRET,
        SIGNING_SECRET,
        PREVIOUS_SECRET,
        message.id,
        message.signature,
        message.signature.slice(3),
      ]) {
        expect(logged).not.toContain(secret);
      }
    });
  });

  describe('replay is refused even with a valid ?secret= (flag off)', () => {
    it('refuses a replayed signed request carrying the legacy secret', async () => {
      const target = authenticator();
      const message = { ...signed(), legacySecret: LEGACY_SECRET };
      await expect(target.authenticate(message)).resolves.toBe(true);
      await expect(target.authenticate(message)).resolves.toBe(false);
    });

    it('refuses a lone seen id (no timestamp, no signature) with a valid ?secret=', async () => {
      const target = authenticator();
      const message = signed();
      await target.authenticate(message);
      await expect(
        target.authenticate({ id: message.id, legacySecret: LEGACY_SECRET }),
      ).resolves.toBe(false);
    });

    it('checks the seen id before format, signing secret and raw body', async () => {
      const target = authenticator();
      const message = signed();
      await target.authenticate(message);
      for (const patch of [
        { signature: 'v1=zz' },
        { timestamp: 'nope' },
        { rawBody: undefined },
      ]) {
        await expect(
          target.authenticate({
            ...message,
            ...patch,
            legacySecret: LEGACY_SECRET,
          }),
        ).resolves.toBe(false);
      }
    });

    it('accepts the same id again after the 10 minute window, with the legacy secret', async () => {
      const target = authenticator();
      const message = signed();
      await target.authenticate(message);
      vi.setSystemTime(NOW_MS + 10 * 60_000 + 1);
      await expect(
        target.authenticate({ id: message.id, legacySecret: LEGACY_SECRET }),
      ).resolves.toBe(true);
    });

    it('a legacy-accepted request does not record its id (only a verified signature does)', async () => {
      const target = authenticator();
      const message = {
        ...signed(PREVIOUS_SECRET),
        legacySecret: LEGACY_SECRET,
      };
      await expect(target.authenticate(message)).resolves.toBe(true);
      await expect(target.authenticate(message)).resolves.toBe(true);
    });

    it('logs a refused replay as a throttled WARN without any id', async () => {
      const target = authenticator();
      const message = { ...signed(), legacySecret: LEGACY_SECRET };
      await target.authenticate(message);
      await target.authenticate(message);
      await target.authenticate(message);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('replay');
      expect(warnings[0]).not.toContain(message.id);
    });
  });

  it('treats empty signature headers as absent (legacy path, no-signature-headers)', async () => {
    await expect(
      authenticator().authenticate({
        rawBody: BODY,
        id: '',
        timestamp: '',
        signature: '',
        legacySecret: LEGACY_SECRET,
      }),
    ).resolves.toBe(true);
    expect(warnings[0]).toContain('(no-signature-headers)');
  });

  it('throttles with the injected clock, not the system time', async () => {
    let clock = NOW_MS;
    const values: Record<string, string> = {
      AUTH_WEBHOOK_SECRET: LEGACY_SECRET,
    };
    const config = {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => values[key],
    } as unknown as ConfigService;
    const target = new WebhookAuthenticator(config, flags, () => clock);
    const request = { rawBody: BODY, legacySecret: LEGACY_SECRET };
    await target.authenticate(request);
    await target.authenticate(request);
    expect(warnings).toHaveLength(1);
    clock += 5 * 60_000;
    await target.authenticate(request);
    expect(warnings).toHaveLength(2);
  });
});
