// Phone number checks, shared by the browser and the server.
// The "/mobile" version only accepts mobile numbers, since the code goes by SMS.
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/mobile";

// India first (the default), then common markets.
export const COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AU", name: "Australia" },
  { code: "BD", name: "Bangladesh" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "GB", name: "United Kingdom" },
  { code: "ID", name: "Indonesia" },
  { code: "LK", name: "Sri Lanka" },
  { code: "MY", name: "Malaysia" },
  { code: "NP", name: "Nepal" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" },
  { code: "US", name: "United States" },
];

export const dialCode = (country: CountryCode) => `+${getCountryCallingCode(country)}`;

export type PhoneCheck = { ok: true; e164: string } | { ok: false; error: string };

// "98765 43210" + IN -> { ok, e164: "+919876543210" }
export function checkPhone(number: string, country: CountryCode): PhoneCheck {
  const digits = number.replace(/[^\d+]/g, "");
  if (!digits) return { ok: false, error: "Enter your phone number." };
  const parsed = parsePhoneNumberFromString(digits, country);
  if (!parsed || !parsed.isValid() || parsed.country !== country) {
    const example = country === "IN" ? " Indian mobile numbers have 10 digits and start with 6, 7, 8 or 9." : "";
    return { ok: false, error: `That doesn't look like a valid ${dialCode(country)} number.${example}` };
  }
  return { ok: true, e164: parsed.number };
}
