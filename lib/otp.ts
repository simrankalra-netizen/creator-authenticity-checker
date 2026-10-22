// Verification codes. Runs on the server only.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ DEMO MODE (the default): no SMS is sent. The code is always DEMO_CODE,   │
// │ and the screen says so. To send real SMS later, set SMS_MODE=twilio and  │
// │ the three TWILIO_* values in .env.local; see sendRealSms / checkRealSms. │
// └─────────────────────────────────────────────────────────────────────────┘
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { CODE_LIFETIME_MINUTES, RESEND_WAIT_SECONDS } from "./otpSettings";

export const DEMO_CODE = "123456";
export const CODE_LIFETIME_MS = CODE_LIFETIME_MINUTES * 60_000;
export const RESEND_WAIT_MS = RESEND_WAIT_SECONDS * 1000;

export const smsMode = () => (process.env.SMS_MODE === "twilio" ? "twilio" : "demo");

// Signs the demo cookie so it can't be edited in the browser. The secret comes
// from .env.local; without one, a random secret is made for this server run.
const fallbackSecret = randomBytes(32).toString("hex");
const secret = () => process.env.OTP_COOKIE_SECRET || fallbackSecret;

const sign = (body: string, key: string) => createHmac("sha256", key).update(body).digest("base64url");

// A small tamper-proof note: "a code was sent to this phone at this time".
export function makeSentToken(phone: string, sentAt: number, key = secret()) {
  const body = Buffer.from(JSON.stringify({ phone, sentAt })).toString("base64url");
  return `${body}.${sign(body, key)}`;
}

export function readSentToken(token: string | undefined, key = secret()): { phone: string; sentAt: number } | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body, key));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof data.phone === "string" && typeof data.sentAt === "number" ? data : null;
  } catch {
    return null;
  }
}

export type CodeResult = "ok" | "wrong" | "expired" | "no_code";

// Demo-mode check. `now` is passed in so tests can move the clock.
export function checkDemoCode(token: string | undefined, phone: string, code: string, now: number, key = secret()): CodeResult {
  const sent = readSentToken(token, key);
  if (!sent || sent.phone !== phone) return "no_code";
  if (now - sent.sentAt > CODE_LIFETIME_MS) return "expired";
  return code.trim() === DEMO_CODE ? "ok" : "wrong";
}

// ---- REAL SMS (Twilio Verify). Not used in demo mode; untested until set up. ----
// Needs in .env.local: SMS_MODE=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_VERIFY_SERVICE_SID. Twilio then creates, sends and expires the code.
function twilio(path: string, form: Record<string, string>) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: auth, TWILIO_VERIFY_SERVICE_SID: service } = process.env;
  if (!sid || !auth || !service) throw new Error("Twilio is not set up in .env.local");
  return fetch(`https://verify.twilio.com/v2/Services/${service}/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}` },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000),
  });
}

export async function sendRealSms(phone: string) {
  const res = await twilio("Verifications", { To: phone, Channel: "sms" });
  if (!res.ok) throw new Error(`Twilio error ${res.status}`);
}

export async function checkRealSms(phone: string, code: string): Promise<CodeResult> {
  const res = await twilio("VerificationCheck", { To: phone, Code: code.trim() });
  if (res.status === 404) return "expired"; // Twilio forgets a code once it expires
  if (!res.ok) throw new Error(`Twilio error ${res.status}`);
  const { status } = (await res.json()) as { status: string };
  return status === "approved" ? "ok" : "wrong";
}
