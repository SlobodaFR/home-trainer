import { sanitizeErrorText } from './sanitize-error-text';

describe('sanitizeErrorText', () => {
  it('strips API keys, including masked ones', () => {
    const text = 'Incorrect API key provided: sk-proj-********WXYZ. Find yours';

    const clean = sanitizeErrorText(text);

    expect(clean).not.toContain('sk-');
    expect(clean).not.toContain('WXYZ');
  });

  it('strips email addresses', () => {
    expect(sanitizeErrorText('failed for alice@example.com now')).toBe(
      'failed for [email] now',
    );
  });

  it('truncates long text', () => {
    const clean = sanitizeErrorText('x'.repeat(500));

    expect(clean.length).toBeLessThanOrEqual(201);
  });
});
