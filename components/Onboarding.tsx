"use client";

// The 6 onboarding questions, one at a time, then "Your brief is ready".
// Every answer lives in the Brief object, so Back never loses anything.
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AGE_RANGES, FOLLOWER_RANGES, GOALS, NICHES, PLATFORMS,
  goalLabel, locationLabel, nicheLabel, platformLabel, rangeLabel,
  type Brief,
} from "@/lib/brief";
import { COUNTRIES, checkPhone, dialCode } from "@/lib/phone";
import { RESEND_WAIT_SECONDS } from "@/lib/otpSettings";
import { WEBSITE_PROFILE_ENABLED } from "@/lib/features";
import { looksLikeLink, suggestNicheFromText } from "@/lib/nicheSuggest";
import Logo from "@/components/Logo";
import { Confetti, DoneArt, PhoneArt, ShieldArt, StoreArt, TagArt, TargetArt, WriteArt } from "@/components/StepArt";
import { prefersReducedMotion } from "@/components/motion";
import {
  NOT_CLEAR, PROFILE_FIELDS, nicheName, suggestFollowerRange, suggestNiche,
  type BrandProfile, type Confidence, type FieldKey,
} from "@/lib/brandProfile";

type StepProps = {
  brief: Brief;
  update: (patch: Partial<Brief>) => void;
  next: (patch?: Partial<Brief>) => void;
};

const TOTAL_STEPS = 6;

type SetBrief = (change: Brief | ((latest: Brief) => Brief)) => void;

export default function Onboarding({ brief, setBrief }: { brief: Brief; setBrief: SetBrief }) {
  // Always build on the latest answers, so a slow website read never overwrites newer typing
  const update = (patch: Partial<Brief>) => setBrief((b) => ({ ...b, ...patch }));
  const next = (patch: Partial<Brief> = {}) =>
    setBrief((b) => ({ ...b, ...patch, step: b.returnToBrief ? 7 : b.step + 1, returnToBrief: false }));
  const back = () => setBrief((b) => ({ ...b, step: Math.max(1, b.step - 1), returnToBrief: false }));

  const props = { brief, update, next };
  if (brief.step === 7) return <BriefReady brief={brief} setBrief={setBrief} />;

  return (
    <Page wide>
      <BrandHeader />
      {brief.step === 1 && (
        <div className="cg-rise mx-auto mt-10 max-w-xl text-center sm:mt-12">
          <p className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">Fake followers don&apos;t buy.</p>
          <p className="brand-gradient-text font-display text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">Real creators do.</p>
          <p className="mx-auto mt-4 max-w-md text-ink-soft">
            Detect fake engagement, check creator credibility, and find the right voices for your next launch.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm font-medium">
            <span className="rounded-full bg-lavender px-3 py-1 text-fit">Detect fakes</span>
            <span className="rounded-full bg-mint-tint px-3 py-1 text-reach">Score credibility</span>
            <span className="rounded-full bg-lime-tint px-3 py-1 text-ink">Match creators</span>
          </div>
        </div>
      )}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        {/* Illustration: beside the card on a laptop, above it on a phone */}
        <div key={`art-${brief.step}`} className="cg-fade mx-auto h-36 w-36 sm:h-44 sm:w-44 lg:sticky lg:top-24 lg:mt-12 lg:h-80 lg:w-80">
          <StepIllustration brief={brief} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center justify-between text-sm">
            <p className="font-medium text-ink-soft">
              Step {brief.step} of {TOTAL_STEPS}
            </p>
            <p className="text-ink-muted">{Math.round((brief.step / TOTAL_STEPS) * 100)}%</p>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-line" aria-hidden>
            <div className="brand-gradient cg-progress-bar h-full rounded-full" style={{ width: `${(brief.step / TOTAL_STEPS) * 100}%` }} />
          </div>
          <div key={brief.step} className="cg-card cg-step-in mt-6 p-6 sm:p-8">
            {brief.step === 1 && <PhoneStep {...props} />}
            {brief.step === 2 && <CodeStep {...props} />}
            {brief.step === 3 && <BrandNameStep {...props} />}
            {brief.step === 4 && (WEBSITE_PROFILE_ENABLED ? <LinkStep {...props} /> : <BrandAboutStep {...props} />)}
            {brief.step === 5 && <NicheStep {...props} />}
            {brief.step === 6 && <InfluencerStep {...props} />}
          </div>
          <button type="button" onClick={back} disabled={brief.step === 1} className="cg-btn-secondary mt-5 text-sm">
            ← Back
          </button>
        </div>
      </div>
    </Page>
  );
}

// Each step's illustration (decoration only)
function StepIllustration({ brief }: { brief: Brief }) {
  switch (brief.step) {
    case 1: return <PhoneArt />;
    case 2: return <ShieldArt verified={Boolean(brief.verifiedPhone) && brief.verifiedPhone === brief.phoneE164} />;
    case 3: return <StoreArt name={brief.brandName} />;
    case 4: return <WriteArt />;
    case 5: return <TagArt />;
    default: return <TargetArt />;
  }
}

// The soft background and centred column every onboarding screen sits in
function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="header-band min-h-screen w-full">
      <main className={`mx-auto w-full px-4 pb-16 pt-8 text-ink sm:pt-12 ${wide ? "max-w-xl lg:max-w-5xl" : "max-w-xl"}`}>{children}</main>
    </div>
  );
}

// ---------- small building blocks ----------

function BrandHeader() {
  return (
    <header className="flex flex-col items-center text-center">
      <Logo />
      <p className="mt-1 text-sm text-ink-soft">Verified creators, real results.</p>
    </header>
  );
}

function Question({ title, hint }: { title: string; hint?: string }) {
  return (
    <>
      <h1 className="text-2xl font-extrabold leading-tight sm:text-[1.75rem]">{title}</h1>
      {hint && <p className="mt-2 text-ink-soft">{hint}</p>}
    </>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="cg-rise mt-4 flex gap-2 rounded-xl border border-bad/20 bg-bad-bg p-3 text-sm text-bad">
      <span aria-hidden>⚠</span>
      <span>{children}</span>
    </p>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />;
}

function Continue({ label = "Continue", busy, disabled }: { label?: string; busy?: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={busy || disabled} className="cg-btn-primary mt-6 w-full text-base">
      {busy ? (
        <>
          <Spinner /> Please wait…
        </>
      ) : (
        <>
          {label} <span aria-hidden>→</span>
        </>
      )}
    </button>
  );
}

const inputClass = "cg-input mt-2";

function Choice({ name, value, checked, onChange, children }: {
  name: string; value: string; checked: boolean; onChange: (v: string) => void; children: ReactNode;
}) {
  return (
    <label className="cg-choice" data-checked={checked}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} />
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
          className="cg-input w-auto max-w-[45%] shrink-0 px-3 text-base sm:max-w-none"
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
          className="cg-input min-w-0 flex-1"
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
  // The short "verified" pause before moving on; cancelled if the user moves on first
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearTimeout(advanceTimer.current);
    };
  }, []);
  const waitLeft = Math.max(0, RESEND_WAIT_SECONDS - Math.floor((now - brief.codeSentAt) / 1000));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (verified) {
      clearTimeout(advanceTimer.current);
      return next();
    }
    setBusy(true);
    const { status, data } = await post("/api/otp/verify", { phone: brief.phoneE164, code });
    setBusy(false);
    if (status !== 200) return setError(data.error);
    // Mark verified first so the shield turns green with its tick, then move on.
    // The short pause is skipped when motion is reduced; "Continue" also works at once.
    update({ verifiedPhone: brief.phoneE164 });
    advanceTimer.current = setTimeout(() => next({ verifiedPhone: brief.phoneE164 }), prefersReducedMotion() ? 0 : 600);
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
        <p className="mt-4 rounded-xl border border-check/20 bg-check-bg p-3 text-sm text-check">
          <strong>Demo mode:</strong> no SMS is sent. Use code <strong>123456</strong>.
        </p>
      )}
      {verified ? (
        <p className="mt-4 rounded-xl border border-good/20 bg-good-bg p-3 text-sm font-medium text-good">✓ This number is verified.</p>
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
            className="cg-link mt-4 text-sm disabled:cursor-not-allowed disabled:text-ink-muted disabled:no-underline"
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

// ---------- Step 4: describe your brand (required) + website link (optional, saved only) ----------

const DESCRIPTION_MIN = 30;
const DESCRIPTION_MAX = 600;
const DESCRIPTION_EXAMPLES = [
  { label: "Skincare for students", text: "We sell minimal, affordable skincare for college students in India. Gentle face wash, serum and sunscreen. Our vibe is clean and honest." },
  { label: "Protein snacks", text: "We make high-protein snacks and bars for people who work out at home or go to the gym. Our vibe is energetic, fun and no-nonsense." },
  { label: "Streetwear label", text: "We design oversized streetwear tees and hoodies for young men and women in Indian cities. Our vibe is bold, playful and loud." },
];

function BrandAboutStep({ brief, update, next }: StepProps) {
  const [error, setError] = useState("");
  const length = brief.summary.trim().length;
  const tooShort = length < DESCRIPTION_MIN;
  const linkOk = looksLikeLink(brief.link);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tooShort) {
      return setError(
        length === 0
          ? "Describe your brand to continue: what you sell, who it's for, and its vibe."
          : `Add a little more: at least ${DESCRIPTION_MIN} characters (you have ${length}).`,
      );
    }
    // Suggest a niche for Step 5, unless the user already picked one themselves
    const suggestion = suggestNicheFromText(brief.summary);
    const userPicked = brief.niche !== "" && brief.niche !== brief.nicheSuggested;
    const nichePatch = userPicked
      ? {}
      : { niche: suggestion?.niche ?? "", nicheSuggested: suggestion?.niche ?? "" };
    next({ summary: brief.summary.trim(), summarySource: "manual", profile: null, link: brief.link.trim(), ...nichePatch });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Question title="Tell us about your brand" hint="This helps us match you with the right creators." />
      <div className="relative mt-4">
        <textarea
          aria-label="Describe your brand"
          aria-describedby="description-count"
          rows={6}
          maxLength={DESCRIPTION_MAX}
          placeholder="What do you sell? Who is it for? What is your brand's vibe? (for example: We sell minimal, affordable skincare for college students in India.)"
          value={brief.summary}
          onChange={(e) => {
            setError("");
            update({ summary: e.target.value });
          }}
          className={`${inputClass} mt-0 min-h-40 resize-y leading-relaxed`}
        />
      </div>
      <div id="description-count" className="mt-1.5 flex items-center justify-between text-xs" aria-live="polite">
        <span className={tooShort ? "text-ink-muted" : "font-medium text-good"}>
          {tooShort ? `At least ${DESCRIPTION_MIN} characters` : "✓ Looks good"}
        </span>
        <span className={length >= DESCRIPTION_MAX ? "font-semibold text-check" : "text-ink-muted"}>
          {length} / {DESCRIPTION_MAX}
        </span>
      </div>

      <p className="mt-4 text-xs font-medium text-ink-muted">Stuck? Start from an example and edit it:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DESCRIPTION_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => {
              setError("");
              update({ summary: ex.text });
            }}
            className="rounded-full border border-line bg-lavender/60 px-3 py-1.5 text-sm text-fit transition-colors hover:border-brand-purple hover:bg-lavender"
          >
            ✨ {ex.label}
          </button>
        ))}
      </div>

      <label className="mt-6 block text-sm font-medium" htmlFor="website">
        Website link <span className="font-normal text-ink-muted">(optional)</span>
      </label>
      <input
        id="website"
        type="url"
        inputMode="url"
        placeholder="yourbrand.in"
        value={brief.link}
        onChange={(e) => update({ link: e.target.value })}
        className={`${inputClass} py-2.5 text-base`}
      />
      {!linkOk && <p className="mt-1 text-xs text-ink-muted">That doesn&apos;t look like a web address, but you can still continue.</p>}

      <ErrorText>{error}</ErrorText>
      <Continue />
    </form>
  );
}

// ---------- Step 4: website -> Brand Profile (paused: see lib/features.ts) ----------

const PROFILE_TIMEOUT_MS = 45_000;

function LinkStep({ brief, update, next }: StepProps) {
  const [busy, setBusy] = useState("");
  const [readError, setReadError] = useState("");
  const [error, setError] = useState("");
  // Typing a description: when the user chose to, or the website couldn't be read
  const [describing, setDescribing] = useState(brief.summarySource === "manual" && !brief.profile);

  async function buildProfile(body: { link: string } | { description: string }) {
    setReadError("");
    setError("");
    setBusy("link" in body ? "Reading your website (up to 5 pages)…" : "Building your brand profile…");
    const later = setTimeout(() => setBusy("Building your brand profile…"), 6_000);
    let result: { status: number; data: { profile?: BrandProfile; error?: string } };
    try {
      const res = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
      });
      result = { status: res.status, data: await res.json() };
    } catch {
      result = { status: 0, data: { error: "That took too long. Try again, or describe your brand instead." } };
    }
    clearTimeout(later);
    setBusy("");
    if (result.status === 200 && result.data.profile) {
      update({ profile: result.data.profile, summarySource: "link" in body ? "website" : "manual" });
      setDescribing(false);
    } else {
      setReadError(result.data.error ?? "Something went wrong. Describe your brand instead.");
      update({ profile: null, summarySource: "manual" });
      setDescribing(true); // never show a made-up profile: ask for a description instead
    }
  }

  function confirm() {
    if (!brief.profile) return;
    // Pre-fill Step 5 from the profile, unless the user already chose a niche
    const suggested = brief.niche ? null : suggestNiche(brief.profile);
    next({ ...(suggested ?? {}) });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        if (brief.profile) return confirm();
        if (describing) return void buildProfile({ description: brief.summary });
        if (!brief.link.trim()) return setError("Enter your website address, or describe your brand instead.");
        void buildProfile({ link: brief.link });
      }}
      noValidate
    >
      <Question
        title="Share your brand's website or Instagram link."
        hint="We read your website to build a Brand Profile. Your website works best: Instagram pages can't be read automatically."
      />
      <input
        aria-label="Website or Instagram link"
        placeholder="e.g. masalabox.in"
        value={brief.link}
        onChange={(e) => {
          setError("");
          update({ link: e.target.value });
        }}
        className={`${inputClass} mt-4`}
      />
      {(brief.profile || describing) && (
        <button
          type="button"
          onClick={() => {
            if (!brief.link.trim()) return setError("Enter your website address first.");
            update({ profile: null });
            void buildProfile({ link: brief.link });
          }}
          disabled={Boolean(busy)}
          className="cg-btn-secondary mt-3 text-sm"
        >
          Read my website again
        </button>
      )}
      {!brief.profile && !describing && (
        <button type="button" onClick={() => setDescribing(true)} className="cg-link mt-3 block text-sm">
          No website? Describe your brand instead
        </button>
      )}
      <ErrorText>{readError}</ErrorText>

      {describing && !brief.profile && (
        <div className="mt-4">
          <label className="text-sm font-medium" htmlFor="summary">
            Describe your brand in a sentence or two: what you sell, and who buys it.
          </label>
          <textarea
            id="summary"
            rows={4}
            placeholder="e.g. We sell ready-to-cook spice kits to busy young professionals in Indian cities."
            value={brief.summary}
            onChange={(e) => {
              setError("");
              update({ summary: e.target.value });
            }}
            className={inputClass}
          />
          <p className="text-xs text-ink-muted">We&apos;ll build your Brand Profile from these words only.</p>
        </div>
      )}

      {busy && <p className="mt-4 text-sm text-ink-soft" role="status">{busy} This usually takes 10–20 seconds.</p>}

      {brief.profile && <ProfileCard profile={brief.profile} onChange={(profile) => update({ profile })} />}

      <ErrorText>{error}</ErrorText>
      <Continue
        label={brief.profile ? "Confirm profile" : describing ? "Build profile from my description" : "Read my website"}
        busy={Boolean(busy)}
      />
    </form>
  );
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: "bg-mint-tint text-brand-teal",
  medium: "bg-lavender text-brand-purple",
  low: "bg-check-bg text-check",
};

function ProfileCard({ profile, onChange }: { profile: BrandProfile; onChange: (p: BrandProfile) => void }) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState("");
  const notClearText = profile.source === "website" ? NOT_CLEAR : "Not clear from your description";

  function save(key: FieldKey) {
    const value = draft.trim();
    const field = value
      ? { value, evidence: "Edited by you", confidence: "high" as Confidence, clear: true, edited: true }
      : { value: NOT_CLEAR, evidence: "Cleared by you", confidence: "low" as Confidence, clear: false, edited: true };
    onChange({ ...profile, fields: { ...profile.fields, [key]: field } });
    setEditing(null);
  }

  return (
    <section className="mt-5 rounded-xl border border-brand-purple/30 bg-white" aria-label="Brand Profile">
      <div className="rounded-t-xl bg-lavender px-4 py-3">
        <p className="font-semibold">Your Brand Profile</p>
        <p className="text-xs text-ink-soft">
          {profile.source === "website" ? `Built from your website: ${profile.pagesRead.join(", ")}.` : "Built from your description."}{" "}
          Check each answer, edit anything that&apos;s wrong, then confirm.
        </p>
      </div>
      {profile.thin && (
        <p className="border-b border-check/20 bg-check-bg px-4 py-2 text-xs text-check">
          Thin website: we could only read a little, so some answers are low confidence. Please check them.
        </p>
      )}
      <dl className="divide-y divide-line">
        {PROFILE_FIELDS.map(({ key, label }) => {
          const f = profile.fields[key];
          return (
            <div key={key} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="font-medium">{label}</dt>
                <div className="flex shrink-0 items-center gap-2">
                  {f.edited ? (
                    <span className="rounded-full bg-none-bg px-2 py-0.5 text-[11px] font-medium text-none">Edited by you</span>
                  ) : f.clear ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_STYLE[f.confidence]}`}>
                      {f.confidence[0].toUpperCase() + f.confidence.slice(1)} confidence
                    </span>
                  ) : null}
                  {editing !== key && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(key);
                        setDraft(f.clear ? f.value : "");
                      }}
                      className="text-xs text-ink-soft underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
              {editing === key ? (
                <div className="mt-2">
                  <textarea aria-label={label} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputClass} />
                  <div className="mt-1 flex gap-3 text-xs">
                    <button type="button" onClick={() => save(key)} className="font-medium text-brand-purple underline">Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="text-ink-soft underline">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <dd className={`mt-1 ${f.clear ? "" : "italic text-ink-muted"}`}>{f.clear ? f.value : notClearText}</dd>
                  {!f.edited && <dd className="mt-0.5 text-xs text-ink-muted">{f.evidence}</dd>}
                </>
              )}
            </div>
          );
        })}
      </dl>
    </section>
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
      {brief.nicheSuggested && brief.niche === brief.nicheSuggested && (
        <p className="cg-rise mt-3 rounded-xl bg-lavender px-3 py-2 text-sm text-fit">
          ✨ Suggested from your description: <strong>{brief.nicheSuggested}</strong>
          {(() => {
            const words = suggestNicheFromText(brief.summary)?.matched ?? [];
            return words.length ? ` (you mentioned ${words.slice(0, 3).map((w) => `“${w}”`).join(", ")})` : "";
          })()}
          . Keep it or pick another.
        </p>
      )}
      {brief.profile && nicheName(brief.profile) && (
        <p className="mt-3 rounded-xl bg-lavender px-3 py-2 text-sm text-fit">
          Suggested from your Brand Profile: <strong>{brief.profile.fields.niche.value}</strong>. Confirm it or pick another.
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {NICHES.map((n) => (
          <Choice
            key={n}
            name="niche"
            value={n}
            checked={brief.niche === n}
            onChange={(v) => {
              setError("");
              // Picking a different niche makes it the user's own choice, so it's never overwritten later
              update({ niche: v, nicheSuggested: v === brief.nicheSuggested ? brief.nicheSuggested : "" });
            }}
          >
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
  const profile = brief.profile;
  // Pre-fill from the Brand Profile (or the chosen niche) where it makes sense; the user can change anything
  useEffect(() => {
    const patch: Partial<Brief> = {};
    if (!brief.influencerNiche) patch.influencerNiche = (profile && nicheName(profile)) || nicheLabel(brief);
    if (!brief.followerRange && profile && suggestFollowerRange(profile)) {
      patch.followerRange = suggestFollowerRange(profile);
      patch.followerRangeSuggested = true;
    }
    if (Object.keys(patch).length) update(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const audience = profile
    ? [profile.fields.age, profile.fields.gender].filter((f) => f.clear).map((f) => f.value).join(" · ")
    : "";

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
      {audience && (
        <p className="rounded-xl bg-mint-tint px-3 py-2 text-sm text-reach">
          Your audience (from your Brand Profile): <strong>{audience}</strong>. Pick creators who reach these people.
        </p>
      )}

      <fieldset>
        <legend className="text-sm font-medium">Which niche should the influencer be in?</legend>
        <input aria-label="Influencer niche" value={brief.influencerNiche} onChange={(e) => update({ influencerNiche: e.target.value })} className={inputClass} />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">
          What age are your customers? <span className="font-normal text-ink-muted">(optional)</span>
        </legend>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[...AGE_RANGES, ""].map((a) => (
            <Choice key={a || "skip"} name="age" value={a} checked={brief.targetAge === a} onChange={(v) => update({ targetAge: v })}>
              {a ? a.replace("-", "–") : "Not sure"}
            </Choice>
          ))}
        </div>
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
            <Choice key={r.value} name="range" value={r.value} checked={brief.followerRange === r.value} onChange={(v) => update({ followerRange: v, followerRangeSuggested: false })}>
              {r.label} <span className="text-ink-muted">({r.detail})</span>
            </Choice>
          ))}
        </div>
        {brief.followerRangeSuggested && profile?.fields.price.clear && (
          <p className="mt-1 text-xs text-ink-soft">
            Suggested from your {profile.fields.price.value.toLowerCase()} price positioning. Change it if another range suits you better.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">What is your budget per creator? <span className="font-normal text-ink-muted">(optional)</span></legend>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-ink-soft">₹</span>
          <input aria-label="Budget per creator in rupees" inputMode="numeric" placeholder="e.g. 15000" value={brief.budget} onChange={(e) => update({ budget: e.target.value })} className="cg-input" />
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

// The confirmed Brand Profile, one row per field ("Not clear" rows included, so nothing looks invented)
function profileRows(b: Brief): [string, string, number][] {
  if (!b.profile) return [["About the brand", b.summary || "Not given", 4]];
  const from = b.profile.source === "website" ? "from your website" : "from your description";
  return PROFILE_FIELDS.map(({ key, label }) => {
    const f = b.profile!.fields[key];
    return [label, f.clear ? f.value : `Not clear ${from}`, 4] as [string, string, number];
  });
}

export function briefRows(b: Brief): [string, string, number][] {
  return [
    ["Phone", `${b.phoneE164} (verified${b.smsMode === "demo" ? " in demo mode" : ""})`, 1],
    ["Brand", b.brandName, 3],
    ["Website or link", b.link || "Not given", 4],
    ...profileRows(b),
    ["Brand niche", nicheLabel(b), 5],
    ["Influencer niche", b.influencerNiche, 6],
    ["Customer age", b.targetAge ? b.targetAge.replace("-", "–") : "Not given", 6],
    ["Location", locationLabel(b), 6],
    ["Main goal", goalLabel(b), 6],
    ["Follower range", rangeLabel(b), 6],
    ["Budget per creator", b.budget.trim() ? `₹${b.budget.trim()}` : "Not set", 6],
    ["Platform", platformLabel(b), 6],
  ];
}

function BriefReady({ brief, setBrief }: { brief: Brief; setBrief: SetBrief }) {
  return (
    <Page>
      <BrandHeader />
      <Confetti />
      <div className="cg-rise mt-8 flex flex-col items-center text-center">
        <DoneArt />
        <span className="cg-pill mt-2 bg-good-bg text-good">✓ All 6 steps done</span>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Your brief is ready</h1>
        <p className="mt-2 text-ink-soft">Check your answers. You can edit any of them.</p>
      </div>
      <dl className="cg-card cg-rise mt-6 divide-y divide-line overflow-hidden">
        {briefRows(brief).map(([label, value, step]) => (
          <div key={label} className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-3 text-sm sm:flex-nowrap sm:px-5">
            <dt className="w-full shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-muted sm:w-40 sm:text-sm sm:font-medium sm:normal-case sm:tracking-normal">{label}</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-line">{value}</dd>
            <button type="button" onClick={() => setBrief({ ...brief, step, returnToBrief: true })} className="cg-link shrink-0 text-xs">
              Edit
            </button>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => setBrief({ ...brief, step: 8 })}
        className="cg-btn-primary mt-6 w-full text-base"
      >
        See your top 10 creators <span aria-hidden>→</span>
      </button>
    </Page>
  );
}
