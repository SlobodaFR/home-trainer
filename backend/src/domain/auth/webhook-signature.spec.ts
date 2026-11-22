import {
  computeWebhookSignature,
  matchesWebhookSignature,
  parseWebhookSignatureHeader,
} from './webhook-signature';

/**
 * FIXED test vectors (contract PC7), copied verbatim from home-auth
 * (backend/src/domain/shared/webhook-signer.spec.ts, PR SlobodaFR/home-auth#83): any change is a
 * change of the contract. Cross-checked with
 * `printf '%s' '<id>.<timestamp>.<body>' | openssl dgst -sha256 -hmac <secret>`: the key is the
 * secret string itself (its 64 hex characters, UTF-8), NOT its decoded bytes.
 */
const SECRET_1 =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const SECRET_2 =
  'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
const ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const BODY = '{"userId":"u1"}';
const SIG_1 =
  '41294c53497c1d18871786b2d5c3ec091e6b357638e7104d826de50af8813242';
const SIG_2 =
  '89de6c4652b33d864427b3091771ed8b9266a99b3bf915b126eb4655a2dce09f';

describe('webhook signature test vectors (contract PC7)', () => {
  it('vector 1: HMAC-SHA256(secret, id.timestamp.rawBody)', () => {
    expect(computeWebhookSignature(SECRET_1, ID, '1700000000', BODY)).toBe(
      SIG_1,
    );
  });

  it('vector 2: another secret, same message', () => {
    expect(computeWebhookSignature(SECRET_2, ID, '1700000000', BODY)).toBe(
      SIG_2,
    );
  });

  it('vector 3: body hashed as UTF-8 bytes (non-ASCII user id)', () => {
    const id = '9b2f0f6e-8d3a-4f6b-9c1e-2a7d5e4c1b30';
    const expected =
      'd9a2c8cec34058ebb100f8b454ba46b1214cf777000d9aab00dda91205d5a3ac';
    expect(
      computeWebhookSignature(
        SECRET_1,
        id,
        '1700000123',
        '{"userId":"4b8f-é"}',
      ),
    ).toBe(expected);
    // The raw bytes received on the wire give the same result as the decoded string.
    expect(
      computeWebhookSignature(
        SECRET_1,
        id,
        '1700000123',
        Buffer.from('{"userId":"4b8f-é"}', 'utf8'),
      ),
    ).toBe(expected);
  });

  it('vector 4 (overlap): a header with the two entries, current secret first', () => {
    const header = `v1=${SIG_1},v1=${SIG_2}`;
    const entries = parseWebhookSignatureHeader(header);
    expect(entries).not.toBeNull();
    // Either secret authenticates the message.
    expect(
      matchesWebhookSignature(SECRET_1, ID, '1700000000', BODY, entries!),
    ).toBe(true);
    expect(
      matchesWebhookSignature(SECRET_2, ID, '1700000000', BODY, entries!),
    ).toBe(true);
  });
});

describe('parseWebhookSignatureHeader', () => {
  it('decodes each v1= entry from hex into 32 bytes', () => {
    const entries = parseWebhookSignatureHeader(`v1=${SIG_1}`);
    expect(entries).toHaveLength(1);
    expect(entries![0]).toHaveLength(32);
    expect(entries![0].toString('hex')).toBe(SIG_1);
  });

  it('accepts several entries, with optional spaces after the comma', () => {
    expect(
      parseWebhookSignatureHeader(`v1=${SIG_1}, v1=${SIG_2}`),
    ).toHaveLength(2);
  });

  it('accepts upper-case hex', () => {
    expect(
      parseWebhookSignatureHeader(`v1=${SIG_1.toUpperCase()}`)![0].toString(
        'hex',
      ),
    ).toBe(SIG_1);
  });

  it.each([
    ['empty', ''],
    ['no version prefix', SIG_1],
    ['unknown version', `v2=${SIG_1}`],
    ['too short', `v1=${SIG_1.slice(0, 62)}`],
    ['too long', `v1=${SIG_1}00`],
    ['not hex', `v1=${'z'.repeat(64)}`],
    ['one bad entry among good ones', `v1=${SIG_1},v1=nope`],
    ['empty entry', `v1=${SIG_1},`],
    ['too many entries', Array(5).fill(`v1=${SIG_1}`).join(',')],
  ])('rejects a malformed header (%s)', (_label, header) => {
    expect(parseWebhookSignatureHeader(header)).toBeNull();
  });
});

describe('matchesWebhookSignature', () => {
  const entries = parseWebhookSignatureHeader(`v1=${SIG_1}`)!;

  it('rejects another secret, another body, another id, another timestamp', () => {
    expect(
      matchesWebhookSignature(SECRET_2, ID, '1700000000', BODY, entries),
    ).toBe(false);
    expect(
      matchesWebhookSignature(
        SECRET_1,
        ID,
        '1700000000',
        '{"userId":"u2"}',
        entries,
      ),
    ).toBe(false);
    expect(
      matchesWebhookSignature(
        SECRET_1,
        ID.replace('3', '4'),
        '1700000000',
        BODY,
        entries,
      ),
    ).toBe(false);
    expect(
      matchesWebhookSignature(SECRET_1, ID, '1700000001', BODY, entries),
    ).toBe(false);
  });

  it('accepts when any entry matches, wherever it is', () => {
    const other = parseWebhookSignatureHeader(`v1=${SIG_2},v1=${SIG_1}`)!;
    expect(
      matchesWebhookSignature(SECRET_1, ID, '1700000000', BODY, other),
    ).toBe(true);
  });
});
