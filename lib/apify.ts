// Calls Apify from the server only. The token comes from APIFY_TOKEN in .env.local,
// so it never reaches the browser. Every run has a time limit and a cost cap.
const API = "https://api.apify.com/v2";

export type ApifyFailure = "no_token" | "bad_token" | "no_credits" | "timeout" | "failed" | "empty";

export class ApifyError extends Error {
  constructor(public reason: ApifyFailure, message: string) {
    super(message);
  }
}

export const hasApifyToken = () => Boolean(process.env.APIFY_TOKEN);

function token() {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new ApifyError("no_token", "No APIFY_TOKEN set in .env.local");
  return t;
}

const CREDIT_WORDS = /usage|credit|limit|not-enough|payment|plan/i;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof ApifyError) throw e;
    throw new ApifyError("failed", "Couldn't reach Apify");
  }
  if (res.status === 401) throw new ApifyError("bad_token", "The APIFY_TOKEN was rejected by Apify");
  if (res.status === 404 && init.method !== "POST") return null as T; // e.g. no cached record yet
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { type?: string; message?: string } } | null;
    const msg = `${body?.error?.type ?? ""} ${body?.error?.message ?? ""}`;
    if (res.status === 402 || (res.status === 403 && CREDIT_WORDS.test(msg))) {
      throw new ApifyError("no_credits", "Your Apify account is out of credits");
    }
    throw new ApifyError("failed", `Apify error ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

type Run = { id: string; status: string; statusMessage?: string; defaultDatasetId: string };

// Runs one actor and returns its results. Stops at `deadline` (ms since epoch) and keeps
// whatever it collected so far; never returns more than `maxItems` or spends over `maxChargeUsd`.
export async function runActor<T>(
  actor: string,
  input: unknown,
  opts: { maxItems: number; maxChargeUsd: number; deadline: number },
): Promise<T[]> {
  const secondsLeft = Math.floor((opts.deadline - Date.now()) / 1000);
  if (secondsLeft < 5) throw new ApifyError("timeout", "Ran out of time before Apify could start");
  const q = new URLSearchParams({
    timeout: String(secondsLeft),
    maxItems: String(opts.maxItems),
    maxTotalChargeUsd: String(opts.maxChargeUsd),
  });
  let run = (await api<{ data: Run }>(`/acts/${actor}/runs?${q}`, { method: "POST", body: JSON.stringify(input) })).data;

  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
    const wait = Math.min(10, Math.floor((opts.deadline - Date.now()) / 1000));
    if (wait <= 0) {
      await api(`/actor-runs/${run.id}/abort`, { method: "POST" }).catch(() => null);
      break;
    }
    run = (await api<{ data: Run }>(`/actor-runs/${run.id}?waitForFinish=${wait}`)).data;
  }

  const items = (await api<T[]>(`/datasets/${run.defaultDatasetId}/items?clean=true&limit=${opts.maxItems}`)) ?? [];
  if (!items.length) {
    if (run.status === "FAILED" && CREDIT_WORDS.test(run.statusMessage ?? "")) {
      throw new ApifyError("no_credits", "Your Apify account is out of credits");
    }
    if (run.status === "FAILED") throw new ApifyError("failed", `Apify run failed${run.statusMessage ? `: ${run.statusMessage}` : ""}`);
    if (run.status !== "SUCCEEDED") throw new ApifyError("timeout", "Apify took too long and returned nothing");
  }
  return items;
}

// ---------- 24-hour cache, kept in a key-value store on your Apify account ----------
// (Vercel doesn't keep files or memory between visits, so the cache lives with Apify.)
const STORE_NAME = "collabgram-search-cache";
export const CACHE_HOURS = 24;
let storeId: string | null = null;
const memory = new Map<string, { savedAt: number; value: unknown }>();

async function store() {
  storeId ??= (await api<{ data: { id: string } }>(`/key-value-stores?name=${STORE_NAME}`, { method: "POST" })).data.id;
  return storeId;
}

// Record keys carry their save time ("t1761200000000-search-..."), so expired ones can be deleted
type Keys = { data: { items: { key: string }[] } };

export async function readCache<T>(key: string): Promise<{ savedAt: number; value: T } | null> {
  const fresh = (t: number) => Date.now() - t < CACHE_HOURS * 3600_000;
  const hit = memory.get(key);
  if (hit && fresh(hit.savedAt)) return hit as { savedAt: number; value: T };
  try {
    const id = await store();
    const keys = (await api<Keys>(`/key-value-stores/${id}/keys?limit=1000`))?.data.items ?? [];
    let found: { savedAt: number; value: T } | null = null;
    for (const { key: k } of keys) {
      const m = /^t(\d+)-(.+)$/.exec(k);
      if (!m) continue;
      const savedAt = Number(m[1]);
      if (!fresh(savedAt)) {
        await api(`/key-value-stores/${id}/records/${k}`, { method: "DELETE" }).catch(() => null); // don't keep data past 24 h
      } else if (m[2] === key && (!found || savedAt > found.savedAt)) {
        const value = await api<T>(`/key-value-stores/${id}/records/${k}`);
        if (value) found = { savedAt, value };
      }
    }
    if (found) memory.set(key, found);
    return found;
  } catch {
    return null; // a cache problem never blocks a search
  }
}

export async function writeCache(key: string, value: unknown) {
  const savedAt = Date.now();
  memory.set(key, { savedAt, value });
  try {
    const id = await store();
    await api(`/key-value-stores/${id}/records/t${savedAt}-${key}`, { method: "PUT", body: JSON.stringify(value) });
  } catch {
    // the search still works without the cache
  }
}
