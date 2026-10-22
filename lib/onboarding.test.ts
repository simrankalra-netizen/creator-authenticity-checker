// Automatic checks for the onboarding flow. Run with: npm test
import { describe, expect, it } from "vitest";
import { checkPhone } from "./phone";
import { checkDemoCode, makeSentToken, readSentToken, CODE_LIFETIME_MS, DEMO_CODE } from "./otp";
import { extractText, isPrivateAddress, normaliseUrl, readPage } from "./readPage";

describe("phone numbers", () => {
  it("accepts a valid Indian mobile number in any spacing", () => {
    expect(checkPhone("98765 43210", "IN")).toEqual({ ok: true, e164: "+919876543210" });
    expect(checkPhone("+91 98765-43210", "IN")).toEqual({ ok: true, e164: "+919876543210" });
  });

  it("rejects too short, wrong-start and empty numbers with a clear message", () => {
    expect(checkPhone("98765", "IN")).toMatchObject({ ok: false });
    expect(checkPhone("1234567890", "IN")).toMatchObject({ ok: false, error: expect.stringContaining("start with 6, 7, 8 or 9") });
    expect(checkPhone("", "IN")).toEqual({ ok: false, error: "Enter your phone number." });
  });

  it("rejects a number from a different country than the one chosen", () => {
    expect(checkPhone("+1 415 555 2671", "IN").ok).toBe(false);
  });
});

describe("demo verification codes", () => {
  const key = "test-secret";
  const phone = "+919876543210";
  const sentAt = 1_000_000;
  const token = makeSentToken(phone, sentAt, key);

  it("accepts the demo code within 5 minutes", () => {
    expect(checkDemoCode(token, phone, DEMO_CODE, sentAt + 60_000, key)).toBe("ok");
  });

  it("rejects a wrong code", () => {
    expect(checkDemoCode(token, phone, "000000", sentAt + 1000, key)).toBe("wrong");
  });

  it("rejects an expired code, even if it's right", () => {
    expect(checkDemoCode(token, phone, DEMO_CODE, sentAt + CODE_LIFETIME_MS + 1, key)).toBe("expired");
  });

  it("rejects a tampered cookie or a different phone", () => {
    const [body] = token.split(".");
    expect(readSentToken(`${body}.forged`, key)).toBeNull();
    expect(checkDemoCode(token, "+919999999999", DEMO_CODE, sentAt + 1000, key)).toBe("no_code");
    expect(checkDemoCode(undefined, phone, DEMO_CODE, sentAt + 1000, key)).toBe("no_code");
  });
});

describe("reading a brand website", () => {
  it("cleans up typed addresses", () => {
    expect(normaliseUrl("masalabox.in")?.toString()).toBe("https://masalabox.in/");
    expect(normaliseUrl("not a site")).toBeNull();
    expect(normaliseUrl("ftp://masalabox.in")).toBeNull();
  });

  it("keeps the visible text, title and description, drops scripts", () => {
    const { title, text } = extractText(
      `<html><head><title>Masala Box</title><meta name="description" content="Spice kits &amp; more"><script>var x=1</script></head><body><h1>Ready-to-cook spice kits</h1><style>p{}</style></body></html>`,
    );
    expect(title).toBe("Masala Box");
    expect(text).toContain("Spice kits & more");
    expect(text).toContain("Ready-to-cook spice kits");
    expect(text).not.toContain("var x");
  });

  it("treats private and local addresses as off-limits", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });

  it("refuses Instagram, local addresses and nonsense with a clear message, never a summary", async () => {
    expect(await readPage("instagram.com/masalabox")).toMatchObject({ ok: false, reason: "instagram" });
    expect(await readPage("http://localhost:3000")).toMatchObject({ ok: false, reason: "invalid" });
    expect(await readPage("http://127.0.0.1")).toMatchObject({ ok: false, reason: "blocked" });
    expect(await readPage("hello")).toMatchObject({ ok: false, reason: "invalid" });
    expect(await readPage("this-brand-does-not-exist-collabgram.invalid")).toMatchObject({ ok: false, reason: "not_found" });
  });
});
