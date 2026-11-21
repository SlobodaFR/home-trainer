const API_KEY = /sk-[A-Za-z0-9_.*-]+/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MAX_LENGTH = 200;

/**
 * Last line of defence for error text that ends up in logs: strips API keys (even masked
 * ones echoed by upstream 401 bodies) and email addresses, and truncates. The real control
 * is not to put upstream bodies or personal data into error messages in the first place.
 */
export function sanitizeErrorText(
  text: string,
  maxLength = MAX_LENGTH,
): string {
  const clean = text.replace(API_KEY, '[key]').replace(EMAIL, '[email]');
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}…` : clean;
}
