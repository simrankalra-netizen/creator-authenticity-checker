// Sends a verification code (demo mode: pretends to, see lib/otp.ts).
import { cookies } from "next/headers";
import { checkPhone } from "@/lib/phone";
import { makeSentToken, readSentToken, RESEND_WAIT_MS, sendRealSms, smsMode } from "@/lib/otp";
import type { CountryCode } from "libphonenumber-js";

export async function POST(request: Request) {
  const { number, country } = (await request.json()) as { number: string; country: CountryCode };
  const phone = checkPhone(number ?? "", country ?? "IN");
  if (!phone.ok) return Response.json({ error: phone.error }, { status: 400 });

  const jar = await cookies();
  const now = Date.now();
  const previous = readSentToken(jar.get("otp_sent")?.value);
  if (previous && previous.phone === phone.e164 && now - previous.sentAt < RESEND_WAIT_MS) {
    const wait = Math.ceil((RESEND_WAIT_MS - (now - previous.sentAt)) / 1000);
    return Response.json({ error: `Please wait ${wait} seconds before asking for a new code.` }, { status: 429 });
  }

  const mode = smsMode();
  if (mode === "twilio") {
    try {
      await sendRealSms(phone.e164);
    } catch {
      return Response.json({ error: "Couldn't send the SMS. Check the number and try again." }, { status: 502 });
    }
  }
  // Remember when the code was sent (both modes), for the resend wait and demo expiry.
  jar.set("otp_sent", makeSentToken(phone.e164, now), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return Response.json({ ok: true, mode, e164: phone.e164 });
}
