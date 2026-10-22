"use client";

// The creator authenticity screen: upload creators, see scores, optionally upload sales.
import { useRef, useState } from "react";
import { parseCreators, parseSales, handleKey, type SalesRow } from "@/lib/parseCsv";
import { scoreCreator, type CreatorResult, type ScoredCreator } from "@/lib/score";
import { scoreSalesMatch, ordersByHandle } from "@/lib/predict";
import { checkAiReply, type AiCreator, type Verdict } from "@/lib/checkAi";
import Logo from "@/components/Logo";

type AiStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; verdicts: Map<string, Verdict>; extras: number }
  | { state: "failed"; why: string };

const AI_TIMEOUT_MS = 20_000;

export default function CreatorChecker() {
  const [results, setResults] = useState<CreatorResult[] | null>(null);
  const [creatorErrors, setCreatorErrors] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [ai, setAi] = useState<AiStatus>({ state: "idle" });
  const [sales, setSales] = useState<SalesRow[] | null>(null);
  const [salesErrors, setSalesErrors] = useState<string[]>([]);
  const uploadId = useRef(0); // ignores a slow AI reply after a newer upload

  async function onCreatorsFile(file: File) {
    const id = ++uploadId.current;
    setSales(null);
    setSalesErrors([]);
    setAi({ state: "idle" });

    const parsed = parseCreators(await readFile(file), file.name);
    if (!parsed.ok) {
      setResults(null);
      setNotes([]);
      setCreatorErrors(parsed.errors);
      return;
    }
    const scored = parsed.rows.map(scoreCreator);
    setCreatorErrors([]);
    setNotes(parsed.notes);
    setResults(scored); // scores show now; AI wording arrives later

    const toExplain = scored.filter((r): r is ScoredCreator => r.status === "scored");
    if (toExplain.length === 0) return;
    setAi({ state: "loading" });
    const status = await askAi(toExplain);
    if (id === uploadId.current) setAi(status);
  }

  async function onSalesFile(file: File) {
    const parsed = parseSales(await readFile(file), file.name);
    if (!parsed.ok) {
      setSales(null);
      setSalesErrors(parsed.errors);
    } else {
      setSalesErrors([]);
      setSales(parsed.rows);
      setNotes((n) => [
        ...n.filter((note) => !note.startsWith("Sales file:")),
        ...parsed.notes.map((note) => `Sales file: ${note}`),
      ]);
    }
  }

  const match = results && sales ? scoreSalesMatch(results, sales) : null;
  const orders = sales ? ordersByHandle(sales) : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 text-ink">
      <h1>
        <Logo />
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Upload creator numbers to get an authenticity score (0–100) with reasons. Scores are calculated by fixed
        rules, not AI. AI only rewrites the reasons in plain words. Files stay in your browser.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <UploadBox
          step="1"
          title="Upload creators CSV"
          columns="handle, followers, likes, comments, follower growth (%), and ideally days of data"
          onFile={onCreatorsFile}
        />
        <UploadBox
          step="2"
          title="Upload past campaign sales CSV (optional)"
          columns="handle, orders (or sales / promo_code_sales / link_sales)"
          onFile={onSalesFile}
          disabled={!results}
          disabledNote="Upload a creators file first."
        />
      </div>

      <ErrorBox title="This creators file can't be used. No scores were made." errors={creatorErrors} />
      <ErrorBox title="This sales file can't be used. Scores are unchanged." errors={salesErrors} />

      {notes.length > 0 && (
        <ul className="mt-6 list-disc rounded-2xl border border-brand-purple/20 bg-lavender p-3 pl-8 text-sm text-ink">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {match && (
        <div className="cg-card mt-6 border-brand-lime/50 bg-lime-tint p-5">
          {match.ok ? (
            <>
              <p className="text-lg font-semibold">
                Score–sales match: {match.value.toFixed(2)} ({match.label})
              </p>
              <p className="text-sm text-ink-soft">
                Compared {match.compared} creators, skipped {match.skipped} (no sales row or not enough data). 1 means
                higher scores always sold more; 0 means no link. With this few creators it&apos;s a rough signal.
              </p>
            </>
          ) : (
            <p className="text-sm text-ink">{match.message}</p>
          )}
        </div>
      )}

      {ai.state === "loading" && (
        <p className="mt-6 text-sm text-ink-muted">Getting plain-language wording from AI… scores are final already.</p>
      )}
      {ai.state === "failed" && (
        <p className="mt-6 rounded-2xl border border-check/20 bg-check-bg p-3 text-sm text-check">
          AI wording unavailable ({ai.why}): showing standard reasons. Scores are not affected.
        </p>
      )}
      {ai.state === "done" && ai.extras > 0 && (
        <p className="mt-6 rounded-2xl border border-check/20 bg-check-bg p-3 text-sm text-check">
          The AI reply also mentioned {ai.extras} creator(s) that aren&apos;t in your file; those were ignored.
        </p>
      )}

      {results && (
        <div className="cg-card mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-mint-tint text-xs uppercase text-ink-soft">
              <tr>
                <th className="p-3">Creator</th>
                <th className="p-3 text-right">Followers</th>
                <th className="p-3 text-right">Score</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Reason 1</th>
                <th className="p-3">Reason 2</th>
                {orders && <th className="p-3 text-right">Orders</th>}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <Row
                  key={r.handle}
                  result={r}
                  verdict={ai.state === "done" ? ai.verdicts.get(r.handle) : undefined}
                  orders={orders ? orders.get(handleKey(r.handle)) ?? null : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

async function readFile(file: File) {
  try {
    return await file.text();
  } catch {
    return "\u0000"; // treated as unreadable by the checks
  }
}

async function askAi(creators: ScoredCreator[]): Promise<AiStatus> {
  const payload = creators.map((c) => ({
    handle: c.handle,
    tier: c.tier,
    score: c.score,
    reasons: c.reasons.map(({ code, direction, evidence, text }) => ({ code, direction, evidence, text })),
  }));
  try {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creators: payload }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    const body = await res.json();
    if (!res.ok) return { state: "failed", why: body.error ?? `error ${res.status}` };
    const { verdicts, extras } = checkAiReply(creators, (body.creators ?? []) as AiCreator[]);
    return { state: "done", verdicts, extras };
  } catch {
    return { state: "failed", why: "no reply in time" };
  }
}

function UploadBox(props: {
  step: string;
  title: string;
  columns: string;
  onFile: (f: File) => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  return (
    <label
      className={`cg-card-hover block rounded-2xl border-2 border-dashed bg-white p-5 ${
        props.disabled ? "border-line opacity-50" : "cursor-pointer border-[#cfc7ee] hover:border-brand-purple"
      }`}
    >
      <span className="font-medium">
        {props.step}. {props.title}
      </span>
      <span className="mt-1 block text-xs text-ink-muted">Columns: {props.columns}</span>
      {props.disabled && <span className="mt-1 block text-xs text-ink-muted">{props.disabledNote}</span>}
      <input
        type="file"
        accept=".csv,text/csv"
        disabled={props.disabled}
        className="mt-3 block w-full text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) props.onFile(file);
          e.target.value = ""; // lets you re-upload the same file
        }}
      />
    </label>
  );
}

function ErrorBox({ title, errors }: { title: string; errors: string[] }) {
  if (errors.length === 0) return null;
  const shown = errors.slice(0, 5);
  return (
    <div role="alert" className="mt-6 rounded-2xl border border-bad/20 bg-bad-bg p-4 text-sm text-bad">
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc pl-5">
        {shown.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      {errors.length > 5 && <p className="mt-1">…and {errors.length - 5} more.</p>}
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 70) return "text-good";
  if (score >= 40) return "text-check";
  return "text-bad";
}

function Row({
  result,
  verdict,
  orders,
}: {
  result: CreatorResult;
  verdict: Verdict | undefined;
  orders: number | null | undefined;
}) {
  const ordersCell =
    orders === undefined ? null : (
      <td className="p-3 text-right">{orders === null ? <span className="text-ink-muted">no row</span> : orders}</td>
    );

  if (result.status === "not_enough_data") {
    return (
      <tr className="border-t border-line align-top">
        <td className="p-3 font-medium">@{result.handle}</td>
        <td className="p-3 text-right">{result.followers?.toLocaleString("en-IN") ?? "—"}</td>
        <td className="p-3 text-right font-medium text-ink-muted">Not enough data</td>
        <td className="p-3 text-ink-muted">—</td>
        <td className="p-3 text-ink-soft" colSpan={2}>
          {result.why}. Not scored, so this creator isn&apos;t flagged. Check them by hand.
        </td>
        {ordersCell}
      </tr>
    );
  }

  return (
    <tr className="border-t border-line align-top">
      <td className="p-3 font-medium">@{result.handle}</td>
      <td className="p-3 text-right">{result.followers.toLocaleString("en-IN")}</td>
      <td className={`p-3 text-right text-lg font-semibold ${scoreColor(result.score)}`}>{result.score}</td>
      <td className="p-3">{result.confidence}</td>
      {result.reasons.map((reason, i) => (
        <td key={reason.code} className="p-3">
          <p>
            <span className={reason.direction === "good" ? "text-good" : "text-bad"}>
              {reason.direction === "good" ? "✓ " : "⚠ "}
            </span>
            {verdict?.ok ? verdict.texts[i] : reason.text}
            {verdict?.ok && (
              <span className="ml-1 rounded bg-lavender px-1 text-[10px] font-medium text-brand-purple">AI wording</span>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{reason.evidence}</p>
          {verdict && !verdict.ok && i === 0 && <p className="mt-1 text-xs text-check">{verdict.note}</p>}
        </td>
      ))}
      {ordersCell}
    </tr>
  );
}
