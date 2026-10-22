"use client";

// The 6 onboarding questions, one at a time, then "Your brief is ready".
// Every answer lives in the Brief object, so Back never loses anything.
import { useEffect, useState, type ReactNode } from "react";
import {
  FOLLOWER_RANGES, GOALS, NICHES, PLATFORMS,
  goalLabel, locationLabel, nicheLabel, platformLabel, rangeLabel,
  type Brief,
} from "@/lib/brief";
import { COUNTRIES, checkPhone, dialCode } from "@/lib/phone";
import { RESEND_WAIT_SECONDS } from "@/lib/otpSettings";
import Logo from "@/components/Logo";

type StepProps = {
  brief: Brief;
  update: (patch: Partial<Brief>) => void;
  next: (patch?: Partial<Brief>) => void;
};

const TOTAL_STEPS = 6;

export default function Onboarding({ brief, setBrief }: { brief: Brief; setBrief: (b: Brief) => void }) {
  const update = (patch: Partial<Brief>) => setBrief({ ...brief, ...patch });
  const next = (patch: Partial<Brief> = {}) =>
    setBrief({ ...brief, ...patch, step: brief.returnToBrief ? 7 : brief.step + 1, returnToBrief: false });
  const back = () => setBrief({ ...brief, step: Math.max(1, brief.step - 1), returnToBrief: false });

  const props = { brief, update, next };
  if (brief.step === 7) return <BriefReady brief={brief} setBrief={setBrief} />;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 text-ink">
      <BrandHeader />
      {brief.step === 1 && (
        <div className="mt-8">
          <p className="text-3xl font-extrabold leading-tight tracking-tight">Fake followers don&apos;t buy.</p>
          <p className="brand-gradient-text text-3xl font-extrabold leading-tight tracking-tight">Real creators do.</p>
          <p className="mt-3 text-ink-soft">
            Detect fake engagement, check creator credibility, and find the right voices for your next launch.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-lavender px-3 py-1">Detect fakes</span>
            <span className="rounded-full bg-mint-tint px-3 py-1">Score credibility</span>
            <span className="rounded-full bg-lime-tint px-3 py-1">Match creators</span>
          </div>
        </div>
      )}
      <div className="mt-6">
        <p className="text-sm font-medium text-ink-soft">
          Step {brief.step} of {TOTAL_STEPS}
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200" aria-hidden>
          <div className="brand-gradient h-1.5 rounded-full" style={{ width: `${(brief.step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-zinc-200 p-6">
        {brief.step === 1 && <PhoneStep {...props} />}
        {brief.step === 2 && <CodeStep {...props} />}
        {brief.step === 3 && <BrandNameStep {...props} />}
        {brief.step === 4 && <LinkStep {...props} />}
        {brief.step === 5 && <NicheStep {...props} />}
        {brief.step === 6 && <InfluencerStep {...props} />}
      </div>
      <button
        type="button"
        onClick={back}
        disabled={brief.step === 1}
        className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm disabled:opacity-40"
      >
        ← Back
      </button>
    </main>
  );
}

// ---------- small building blocks ----------

function BrandHeader() {
  return (
    <header>
      <Logo className="h-9 w-auto" />
      <p className="mt-1 text-sm text-ink-soft">Verified creators, real results.</p>
    </header>
  );
}

function Question({ title, hint }: { title: string; hint?: string }) {
  return (
    <>
      <h1 className="text-xl font-semibold">{title}</h1>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
    </>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
      {children}
    </p>
  );
}

function Continue({ label = "Continue", busy, disabled }: { label?: string; busy?: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="mt-5 w-full rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
    >
      {busy ? "Please wait…" : label}
    </button>
  );
}

const inputClass = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-lavender";

function Choice({ name, value, checked, onChange, children }: {
  name: string; value: string; checked: boolean; onChange: (v: string) => void; children: ReactNode;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? "border-brand-purple bg-lavender" : "border-zinc-300"}`}>
      <input type="radio" className="accent-brand-purple" name={name} value={value} checked={checked} onChange={() => onChange(value)} />
      {children}
    </label>
  );
}

async function post(url: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  } catch {
    return { status: 0, data: { error: "Couldn't reach the server. Check your connection and try again." } };
  }
}

// ---------- Step 1: phone ----------

function PhoneStep({ brief, update, next }: StepProps) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const phone = checkPhone(brief.phoneNumber, brief.country);
    if (!phone.ok) return setError(phone.error);
    if (brief.verifiedPhone === phone.e164) return next({ phoneE164: phone.e164 }); // already verified
    setBusy(true);
    const { status, data } = await post("/api/otp/send", { number: brief.phoneNumber, country: brief.country });
    setBusy(false);
    if (status === 429) return next({ phoneE164: phone.e164 }); // a code was just sent; reuse it
    if (status !== 200) return setError(data.error);
    next({ phoneE164: data.e164, codeSentAt: Date.now(), smsMode: data.mode });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Question title="Enter your phone number." hint="We'll send a verification code to this number." />
      <div className="mt-4 flex gap-2">
        <select
          aria-label="Country code"
          value={brief.country}
          onChange={(e) => update({ country: e.target.value as Brief["country"] })}
          className="rounded-lg border border-zinc-300 px-2 py-2"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({dialCode(c.code)})
            </option>
          ))}
        </select>
        <input
          aria-label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={brief.phoneNumber}
          onChange={(e) => {
            setError("");
            update({ phoneNumber: e.target.value });
          }}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <Continue label="Send code" busy={busy} />
    </form>
  );
}

// ---------- Step 2: verification code ----------

function CodeStep({ brief, update, next }: StepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const verified = brief.verifiedPhone === brief.phoneE164;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const waitLeft = Math.max(0, RESEND_WAIT_SECONDS - Math.floor((now - brief.codeSentAt) / 1000));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (verified) return next();
    setBusy(true);
    const { status, data } = await post("/api/otp/verify", { phone: brief.phoneE164, code });
    setBusy(false);
    if (status !== 200) return setError(data.error);
    next({ verifiedPhone: brief.phoneE164 });
  }

  async function resend() {
    setError("");
    const { status, data } = await post("/api/otp/send", { number: brief.phoneNumber, country: brief.country });
    if (status !== 200) return setError(data.error);
    setCode("");
    update({ codeSentAt: Date.now(), smsMode: data.mode });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Question title="Enter the verification code we sent you." hint={`Sent to ${brief.phoneE164}`} />
      {brief.smsMode === "demo" && !verified && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Demo mode:</strong> no SMS is sent. Use code <strong>123456</strong>.
        </p>
      )}
      {verified ? (
        <p className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">✓ This number is verified.</p>
      ) : (
        <>
          <input
            aria-label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => {
              setError("");
              setCode(e.target.value.replace(/\D/g, ""));
            }}
            className={`${inputClass} mt-4 tracking-widest`}
          />
          <ErrorText>{error}</ErrorText>
          <button
            type="button"
            onClick={resend}
            disabled={waitLeft > 0}
            className="mt-3 text-sm font-medium text-ink underline disabled:text-zinc-400 disabled:no-underline"
          >
            {waitLeft > 0 ? `Resend code in ${waitLeft}s` : "Resend code"}
          </button>
        </>
      )}
      <Continue label={verified ? "Continue" : "Verify"} busy={busy} disabled={!verified && code.length !== 6} />
    </form>
  );
}

// ---------- Step 3: brand name ----------

function BrandNameStep({ brief, update, next }: StepProps) {
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!brief.brandName.trim()) return setError("Enter your brand's name.");
        next({ brandName: brief.brandName.trim() });
      }}
      noValidate
    >
      <Question title="What is your brand's name?" />
      <input
        aria-label="Brand name"
        placeholder="e.g. Masala Box"
        value={brief.brandName}
        onChange={(e) => {
          setError("");
          update({ brandName: e.target.value });
        }}
        className={`${inputClass} mt-4`}
      />
      <ErrorText>{error}</ErrorText>
      <Continue />
    </form>
  );
}

// ---------- Step 4: website + summary ----------

function LinkStep({ brief, update, next }: StepProps) {
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState("");
  const [error, setError] = useState("");
  // Show the description box once there is a summary, a read error, or the user chose to type
  const [showBox, setShowBox] = useState(Boolean(brief.summary));

  async function readWebsite() {
    setReadError("");
    setError("");
    if (!brief.link.trim()) return setError("Enter your website address, or describe your brand instead.");
    setBusy(true);
    const { status, data } = await post("/api/brand-summary", { link: brief.link });
    setBusy(false);
    if (status === 200) {
      update({ summary: data.summary, summarySource: "website" });
    } else {
      setReadError(data.error);
      update({ summary: "", summarySource: "manual" });
    }
    setShowBox(true);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!showBox) return void readWebsite();
        if (brief.summary.trim().length < 10) return setError("Write at least a short sentence about what your brand sells.");
        next({ summary: brief.summary.trim() });
      }}
      noValidate
    >
      <Question
        title="Share your brand's website or Instagram link."
        hint="So we can read what your brand is about. Your website works best: Instagram pages can't be read automatically."
      />
      <input
        aria-label="Website or Instagram link"
        placeholder="e.g. masalabox.in"
        value={brief.link}
        onChange={(e) => update({ link: e.target.value })}
        className={`${inputClass} mt-4`}
      />
      <button
        type="button"
        onClick={readWebsite}
        disabled={busy}
        className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {busy ? "Reading your website…" : showBox ? "Read again" : "Read my website"}
      </button>
      {!showBox && (
        <button
          type="button"
          onClick={() => {
            setShowBox(true);
            update({ summarySource: "manual" });
          }}
          className="ml-3 text-sm text-ink-soft underline"
        >
          No website? Describe your brand instead
        </button>
      )}
      <ErrorText>{readError}</ErrorText>

      {showBox && (
        <div className="mt-4">
          <label className="text-sm font-medium" htmlFor="summary">
            {brief.summarySource === "website" ? "Here's what we understood. Confirm or edit it:" : "Describe your brand in a sentence or two:"}
          </label>
          <textarea
            id="summary"
            rows={4}
            placeholder="e.g. We sell ready-to-cook spice kits to busy young professionals in Indian cities."
            value={brief.summary}
            onChange={(e) => {
              setError("");
              update({ summary: e.target.value, summarySource: brief.summarySource || "manual" });
            }}
            className={inputClass}
          />
          {brief.summarySource === "website" && (
            <p className="text-xs text-zinc-500">Written by AI from your website&apos;s text only.</p>
          )}
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      <Continue label={showBox ? (brief.summarySource === "website" ? "Looks right, continue" : "Continue") : "Read my website"} busy={busy} />
    </form>
  );
}

// ---------- Step 5: brand niche ----------

function NicheStep({ brief, update, next }: StepProps) {
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!brief.niche) return setError("Choose your brand's niche.");
        if (brief.niche === "Other" && !brief.nicheOther.trim()) return setError("Type your niche.");
        next();
      }}
      noValidate
    >
      <Question title="What is your brand's niche?" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {NICHES.map((n) => (
          <Choice key={n} name="niche" value={n} checked={brief.niche === n} onChange={(v) => { setError(""); update({ niche: v }); }}>
            {n}
          </Choice>
        ))}
      </div>
      {brief.niche === "Other" && (
        <input
          aria-label="Your niche"
          placeholder="e.g. Pet care"
          value={brief.nicheOther}
          onChange={(e) => update({ nicheOther: e.target.value })}
          className={`${inputClass} mt-3`}
        />
      )}
      <ErrorText>{error}</ErrorText>
      <Continue />
    </form>
  );
}

// ---------- Step 6: influencer questionnaire ----------

function InfluencerStep({ brief, update, next }: StepProps) {
  const [error, setError] = useState("");
  // Start with the brand's own niche as the influencer niche
  useEffect(() => {
    if (!brief.influencerNiche) update({ influencerNiche: nicheLabel(brief) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = [
      !brief.influencerNiche.trim() && "the influencer's niche",
      brief.locationMode === "specific" && !brief.location.trim() && "a location",
      !brief.goal && "your main goal",
      !brief.followerRange && "a follower range",
      !brief.platform && "a platform",
      brief.platform === "Other" && !brief.platformOther.trim() && "the platform name",
    ].filter(Boolean);
    if (missing.length) return setError(`Please add ${missing.join(", ")}.`);
    if (brief.budget.trim() && !/^[\d,]+$/.test(brief.budget.trim())) return setError("Budget should be a number in rupees, e.g. 15000.");
    next();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Question title="Tell us about the influencers you want to work with." />

      <fieldset>
        <legend className="text-sm font-medium">Which niche should the influencer be in?</legend>
        <input aria-label="Influencer niche" value={brief.influencerNiche} onChange={(e) => update({ influencerNiche: e.target.value })} className={inputClass} />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Do you want creators from a specific location, or anywhere?</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Choice name="loc" value="anywhere" checked={brief.locationMode === "anywhere"} onChange={() => update({ locationMode: "anywhere" })}>Anywhere</Choice>
          <Choice name="loc" value="specific" checked={brief.locationMode === "specific"} onChange={() => update({ locationMode: "specific" })}>A specific place</Choice>
        </div>
        {brief.locationMode === "specific" && (
          <input aria-label="Location" placeholder="City, state or country, e.g. Mumbai" value={brief.location} onChange={(e) => update({ location: e.target.value })} className={`${inputClass} mt-2`} />
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">What is your main goal?</legend>
        <div className="mt-1 space-y-2">
          {GOALS.map((g) => (
            <Choice key={g.value} name="goal" value={g.value} checked={brief.goal === g.value} onChange={(v) => update({ goal: v })}>{g.label}</Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">What follower range suits your category?</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {FOLLOWER_RANGES.map((r) => (
            <Choice key={r.value} name="range" value={r.value} checked={brief.followerRange === r.value} onChange={(v) => update({ followerRange: v })}>
              {r.label} <span className="text-zinc-500">({r.detail})</span>
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">What is your budget per creator? <span className="font-normal text-zinc-500">(optional)</span></legend>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-ink-soft">₹</span>
          <input aria-label="Budget per creator in rupees" inputMode="numeric" placeholder="e.g. 15000" value={brief.budget} onChange={(e) => update({ budget: e.target.value })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Which platform matters most?</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {PLATFORMS.map((p) => (
            <Choice key={p} name="platform" value={p} checked={brief.platform === p} onChange={(v) => update({ platform: v })}>{p}</Choice>
          ))}
        </div>
        {brief.platform === "Other" && (
          <input aria-label="Other platform" placeholder="e.g. Moj, LinkedIn" value={brief.platformOther} onChange={(e) => update({ platformOther: e.target.value })} className={`${inputClass} mt-2`} />
        )}
      </fieldset>

      <ErrorText>{error}</ErrorText>
      <Continue label="Finish" />
    </form>
  );
}

// ---------- "Your brief is ready" ----------

export function briefRows(b: Brief): [string, string, number][] {
  return [
    ["Phone", `${b.phoneE164} (verified${b.smsMode === "demo" ? " in demo mode" : ""})`, 1],
    ["Brand", b.brandName, 3],
    ["Website or link", b.link || "Not given", 4],
    ["About the brand", b.summary + (b.summarySource === "website" ? " (from your website)" : ""), 4],
    ["Brand niche", nicheLabel(b), 5],
    ["Influencer niche", b.influencerNiche, 6],
    ["Location", locationLabel(b), 6],
    ["Main goal", goalLabel(b), 6],
    ["Follower range", rangeLabel(b), 6],
    ["Budget per creator", b.budget.trim() ? `₹${b.budget.trim()}` : "Not set", 6],
    ["Platform", platformLabel(b), 6],
  ];
}

function BriefReady({ brief, setBrief }: { brief: Brief; setBrief: (b: Brief) => void }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 text-ink">
      <BrandHeader />
      <h1 className="mt-6 text-2xl font-semibold">Your brief is ready</h1>
      <p className="mt-1 text-sm text-ink-soft">Check your answers. You can edit any of them.</p>
      <dl className="mt-5 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
        {briefRows(brief).map(([label, value, step]) => (
          <div key={label} className="flex gap-3 p-3 text-sm">
            <dt className="w-36 shrink-0 font-medium text-ink-soft">{label}</dt>
            <dd className="flex-1 whitespace-pre-line">{value}</dd>
            <button type="button" onClick={() => setBrief({ ...brief, step, returnToBrief: true })} className="text-xs text-ink-soft underline">
              Edit
            </button>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => setBrief({ ...brief, step: 8 })}
        className="mt-5 w-full rounded-lg bg-ink px-4 py-2.5 font-medium text-white"
      >
        Continue to creator check
      </button>
    </main>
  );
}
