// Checks the code the user typed. Wrong or expired codes never move them forward.
import { cookies } from "next/headers";
import { checkDemoCode, checkRealSms, smsMode, type CodeResult } from "@/lib/otp";

const MESSAGES: Record<Exclude<CodeResult, "ok">, string> = {
  wrong: "That code is wrong. Check it and try again.",
  expired: "That code has expired. Tap \"Resend code\" to get a new one.",
  no_code: "No code was sent to this number yet. Tap \"Resend code\".",
};

export async function POST(request: Request) {
  const { phone, code } = (await request.json()) as { phone: string; code: string };
  if (!/^\d{6}$/.test((code ?? "").trim())) {
    return Response.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }
  const jar = await cookies();
  let result: CodeResult;
  try {
    result =
      smsMode() === "twilio"
        ? await checkRealSms(phone, code)
        : checkDemoCode(jar.get("otp_sent")?.value, phone, code, Date.now());
  } catch {
    return Response.json({ error: "Couldn't check the code right now. Try again." }, { status: 502 });
  }
  if (result !== "ok") return Response.json({ error: MESSAGES[result], reason: result }, { status: 400 });

  jar.delete("otp_sent"); // a code works once
  return Response.json({ ok: true });
}
