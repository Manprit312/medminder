/**
 * Normalizes a phone string to E.164-like form (+digits only).
 * 10-digit numbers with default country India (91) when env matches.
 */
const DEFAULT_COUNTRY = process.env.OTP_DEFAULT_COUNTRY_CODE?.replace(/\D/g, '') || '91';

export function normalizePhoneE164(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!s) {
    return null;
  }
  const hasPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }
  if (hasPlus) {
    return `+${digits}`;
  }
  if (digits.length === 10 && DEFAULT_COUNTRY === '91' && /^[6-9]/.test(digits)) {
    return `+${DEFAULT_COUNTRY}${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}
