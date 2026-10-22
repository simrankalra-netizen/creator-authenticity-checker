// Reads a CSV file's text and checks it. Any problem rejects the whole file,
// so the app never shows scores built on bad data.
import Papa from "papaparse";
import type { Creator } from "./score";

export type Parsed<T> = { ok: true; rows: T[]; notes: string[] } | { ok: false; errors: string[] };

export type SalesRow = { handle: string; orders: number };

type Column = { key: string; label: string; required: boolean; aliases: string[] };

// Each column can be named in several common ways. The first name is the one we suggest.
const CREATOR_COLUMNS: Column[] = [
  { key: "handle", label: "handle", required: true, aliases: ["handle", "username", "creator", "creator_handle", "instagram_handle", "ig_handle", "account", "influencer", "user"] },
  { key: "followers", label: "followers", required: true, aliases: ["followers", "follower_count", "followers_count", "total_followers"] },
  { key: "avg_likes", label: "likes", required: true, aliases: ["avg_likes", "likes", "average_likes", "likes_per_post", "avg_likes_per_post"] },
  { key: "avg_comments", label: "comments", required: true, aliases: ["avg_comments", "comments", "average_comments", "comments_per_post", "avg_comments_per_post"] },
  { key: "growth", label: "follower growth", required: true, aliases: ["follower_growth_30d_pct", "follower_growth", "follower_growth_pct", "follower_growth_30d", "growth", "growth_pct", "growth_30d", "growth_30d_pct"] },
  { key: "days", label: "days of data", required: false, aliases: ["days_of_data", "days", "days_tracked", "data_days", "tracking_days", "days_of_history"] },
];

const SALES_COLUMNS: Column[] = [
  CREATOR_COLUMNS[0],
  { key: "orders", label: "sales", required: true, aliases: ["orders", "sales", "promo_code_sales", "link_sales", "promo_sales", "promo_code_orders", "conversions", "purchases", "units_sold"] },
];

// "Follower Growth (%)" -> "follower_growth"
const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
// "@Riya_Cooks " -> "riya_cooks" (used to match the two files)
export const handleKey = (h: string) => h.trim().replace(/^@/, "").toLowerCase();

const UNREADABLE =
  "Couldn't read this file. If it's from Excel, use File → Save As → CSV UTF-8, then upload that.";

type Cell = { value: number | null } | { error: string };

// Blank -> null. "12,000" and "15%" are accepted. Anything else is an error.
function readNumber(raw: string | undefined, column: string, row: number, allowNegative: boolean): Cell {
  const text = (raw ?? "").trim().replace(/,/g, "").replace(/%$/, "");
  if (text === "") return { value: null };
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: `Row ${row}, ${column}: '${raw!.trim()}' is not a number.` };
  if (n < 0 && !allowNegative) return { error: `Row ${row}, ${column}: '${raw!.trim()}' can't be negative.` };
  return { value: n };
}

type Table = { errors: string[]; notes?: string[]; data?: Record<string, string>[]; found?: Set<string> };

function readTable(text: string, fileName: string, columns: Column[], emptyMessage: string): Table {
  if (/\.(xlsx|xls|numbers)$/i.test(fileName) || text.includes("\u0000") || text.startsWith("PK")) {
    return { errors: [UNREADABLE] };
  }
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  const headers = result.meta.fields ?? [];
  if (headers.length === 0 && result.data.length === 0) return { errors: [emptyMessage] };

  // Match each column to the first header that uses one of its names
  const mapping = new Map<string, string>(); // column key -> header in the file
  for (const col of columns) {
    const header = col.aliases.find((a) => headers.includes(a));
    if (header) mapping.set(col.key, header);
  }
  const missing = columns.filter((c) => c.required && !mapping.has(c.key));
  if (missing.length > 0) {
    return {
      errors: missing.map(
        (c) => `Missing column for ${c.label}. Name it one of: ${c.aliases.slice(0, 4).join(", ")}.`,
      ),
    };
  }
  if (result.data.length === 0) return { errors: [emptyMessage] };

  const used = new Set(mapping.values());
  const ignored = headers.filter((h) => h && !used.has(h));
  const notes = ignored.length > 0 ? [`Ignored column${ignored.length > 1 ? "s" : ""}: ${ignored.join(", ")}.`] : [];

  const data = result.data.map((raw) => {
    const row: Record<string, string> = {};
    for (const [key, header] of mapping) row[key] = raw[header];
    return row;
  });
  const errors = result.errors
    .filter((e) => e.type === "FieldMismatch" && e.row !== undefined)
    .map((e) => `Row ${e.row! + 2} has the wrong number of values.`);
  return { errors, notes, data, found: new Set(mapping.keys()) };
}

// Rows are numbered like a spreadsheet: the header is row 1.
function checkHandles(data: Record<string, string>[]) {
  const errors: string[] = [];
  const seen = new Map<string, number>();
  data.forEach((r, i) => {
    const row = i + 2;
    const key = handleKey(r.handle ?? "");
    if (!key) {
      errors.push(`Row ${row} has no handle.`);
    } else if (seen.has(key)) {
      errors.push(`@${key} appears twice (rows ${seen.get(key)} and ${row}).`);
    } else {
      seen.set(key, row);
    }
  });
  return errors;
}

export function parseCreators(text: string, fileName: string): Parsed<Creator> {
  const table = readTable(text, fileName, CREATOR_COLUMNS, "This file has no creator rows.");
  if (!table.data) return { ok: false, errors: table.errors };

  const hasDays = table.found!.has("days");
  const notes = [...table.notes!];
  if (!hasDays) {
    notes.push(
      "No days-of-data column, so the app can't tell if a creator's numbers cover too short a time. Add a days_of_data column to check this.",
    );
  }

  const errors = [...table.errors, ...checkHandles(table.data)];
  const rows: Creator[] = table.data.map((r, i) => {
    const row = i + 2;
    const num = (key: string, label: string, allowNegative = false) => {
      const cell = readNumber(r[key], label, row, allowNegative);
      if ("error" in cell) {
        errors.push(cell.error);
        return null;
      }
      return cell.value;
    };
    return {
      row,
      handle: (r.handle ?? "").trim().replace(/^@/, ""),
      followers: num("followers", "followers"),
      avgLikes: num("avg_likes", "likes"),
      avgComments: num("avg_comments", "comments"),
      growthPct: num("growth", "follower growth", true), // losing followers is allowed
      // undefined = no column (unknown); null = column present but blank
      daysOfData: hasDays ? num("days", "days of data") : undefined,
    };
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, rows, notes };
}

export function parseSales(text: string, fileName: string): Parsed<SalesRow> {
  const table = readTable(text, fileName, SALES_COLUMNS, "This file has no sales rows.");
  if (!table.data) return { ok: false, errors: table.errors };

  const errors = [...table.errors, ...checkHandles(table.data)];
  const rows: SalesRow[] = [];
  table.data.forEach((r, i) => {
    const row = i + 2;
    const cell = readNumber(r.orders, "sales", row, false);
    if ("error" in cell) errors.push(cell.error);
    else if (cell.value === null) errors.push(`Row ${row}, sales is blank.`);
    else rows.push({ handle: handleKey(r.handle ?? ""), orders: cell.value });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, rows, notes: table.notes! };
}
