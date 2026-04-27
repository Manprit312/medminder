import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

const PEPPER = process.env.OTP_PEPPER?.trim() || 'medminder-otp-dev-change-in-prod';

function hash(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

export function randomOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(phone: string, code: string): string {
  return hash(`${PEPPER}|${phone}|${code}`);
}

export function verifyOtp(phone: string, code: string, storedHash: string): boolean {
  const h = hashOtp(phone, code);
  try {
    return timingSafeEqual(Buffer.from(h, 'utf8'), Buffer.from(storedHash, 'utf8'));
  } catch {
    return false;
  }
}
