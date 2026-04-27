/**
 * Best-effort SMS for OTP. Always logs; sends via Twilio when env creds are set.
 */
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER?.trim();

export async function sendOtpSms(phone: string, code: string): Promise<{ sent: boolean; provider?: string }> {
  const body = `Your MedMinder sign-in code is: ${code}. It expires in 10 minutes.`;
  console.log(`[otp-sms] to ${phone} (code hidden in prod logs: use DEV_EXPOSE_OTP=1 for API return)`);
  if (process.env.DEV_EXPOSE_OTP === '1' || process.env.NODE_ENV !== 'production') {
    console.log(`[otp-sms] dev log code for ${phone}: ${code}`);
  }

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM) {
    try {
      const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      const u = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const r = await fetch(u, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: body }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error('[otp-sms] Twilio error', r.status, t);
        return { sent: false, provider: 'twilio_error' };
      }
      return { sent: true, provider: 'twilio' };
    } catch (e) {
      console.error('[otp-sms] Twilio request failed', e);
      return { sent: false, provider: 'twilio_error' };
    }
  }

  return { sent: false };
}
