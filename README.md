# Creator Authenticity Checker

A one-screen web app that helps a small brand decide, in minutes, whether an influencer's audience is real before paying them.

Upload a CSV of creators and each one gets an **authenticity score (0–100)**, a **confidence level** and **2 plain-language reasons**. Upload past campaign sales and you see the scores next to real orders, plus **one number** showing how well the scores predicted sales.

Hackathon MVP. Built with Next.js, deployable to Vercel. Uses the Claude API only to reword reasons.

---

## Job to be done

> When I'm about to approve an influencer for a brand campaign, I want to see an authenticity score with clear reasons for that creator, so I can decide in minutes whether to pay them instead of guessing from follower counts.

**User:** a D2C brand marketer at a small consumer brand in India.

### The 3 tests the MVP must pass

1. **Score 30 creators fast.** Upload a CSV of 30 creator accounts (followers, likes, comments, follower growth). Within 30 seconds, each creator shows an authenticity score, a confidence level and the top 2 reasons behind the score.
2. **Check against real sales.** Upload a second CSV of past campaign results (promo code or link sales per creator). The scores appear next to the sales, plus one number showing how well the scores predicted which creators drove real sales.
3. **Be honest about bad input.** If the CSV is missing columns or is unreadable, a clear error names what's wrong, and no made-up scores appear. If a creator has too little data, they show "Not enough data" instead of a guess, so honest creators aren't wrongly flagged.

**Out of scope:** login, database, live Instagram or other platform API connections, payments, messaging creators, saved history, multi-brand support.

---

## Current workflow → future workflow

| | Today (without the app) | With the app |
|---|---|---|
| Gather data | Copy numbers from media kits, Insights screenshots or an agency sheet | Same, saved as one CSV |
| Judge each creator | Eyeball follower counts and a few posts, one creator at a time | Upload once; all 30 are scored in about 1 second |
| Spot fakes | Gut feel, and usually nobody checks comment-to-like ratios or growth spikes | 3 fixed checks run on every creator, each with the actual numbers shown |
| Explain the decision | "They looked fine" | 2 written reasons per creator to share with the team |
| Thin or new accounts | Often judged harshly or waved through | Marked "Not enough data": not flagged, and checked by hand |
| Learn from past campaigns | Rarely done | Upload sales, see one match number |
| Final call | Marketer | **Still the marketer.** The app is a warning light, not a verdict |

---

## Architecture: Input → AI → Logic → Action → Output

In run order, the scoring **logic runs before the AI**. The AI only receives what the code already decided, and the code checks the AI's reply before anything is shown.

```
 INPUT                 LOGIC (plain code)                 AI (Claude)              LOGIC (plain code)         ACTION / OUTPUT
 creators.csv  ──►  read + validate CSV  ──►  score,   ──►  reword the 2       ──►  check every AI     ──►  table: score, confidence,
 sales.csv          (lib/parseCsv.ts)         confidence,   chosen reasons          sentence             2 reasons (+ numbers),
 (in browser)                                 2 reasons     (app/api/explain)       (lib/checkAi.ts)      orders, match number
                                              (lib/score.ts)                                              + clear errors / notes
                    sales match number ◄───────────────────────────────────────────────────────────────
                    (lib/predict.ts)
```

### 1. Input
- **creators.csv:** handle, followers, likes, comments, follower growth (%), and ideally days of data. Common variations such as `avg_likes`, `Follower Growth (%)` or `username` are accepted.
- **sales.csv (optional):** handle plus orders. `sales`, `promo_code_sales` and `link_sales` are also accepted.
- Files are read **in the browser**. Nothing is uploaded to a server or saved.

### 2. AI: rewording only
- **One call per upload**, from a server route (`app/api/explain/route.ts`), so the API key never reaches the browser.
- **What Claude receives:** each creator's handle, size tier, score, and the 2 reasons the code chose (with their numbers and a draft sentence).
- **What Claude is asked:** rewrite each reason as one short, plain sentence, using only the numbers given, and label it a good sign or a warning.

### 3. Logic: plain code
- **Validation:** every problem in a file is collected, and any problem rejects the whole file.
- **Not enough data:** fewer than 1,000 followers, no likes or comments, any blank number, or fewer than 7 days of data.
- **Score** (100 minus penalties from 3 checks, each check worth up to −35):
  - **Engagement:** (likes + comments) ÷ followers, compared with the normal range for the creator's size (nano, micro, mid, macro).
  - **Comments-to-likes ratio:** too few comments for the number of likes suggests bought likes.
  - **Follower growth spike:** more than 20% in 30 days while engagement stays low suggests bought followers.
  - **Inside the normal range,** a check still loses up to 15 points near the range's edges, so genuine creators are graded rather than all scoring 100.
- **Top 2 reasons:** the 2 checks that moved the score most.
- **Confidence:** High when all checks agree; Medium when they're mixed; Low when a warning is borderline.
- **Score–sales match:** the Spearman rank correlation between scores and orders. It needs at least 5 matched creators.
- **AI reply check:** see "Failure cases" below.
- **Tuning:** all thresholds are in one `SETTINGS` block at the top of `lib/score.ts`.

### 4. Action
- **Bad file:** a red error box names the exact problem, and no table appears.
- **Good file:** the table appears straight away with standard wording. Claude's wording replaces each sentence when it arrives and passes the checks.
- **Sales file:** adds an Orders column and the headline match number.

### 5. Output
- **One table:** creator, followers, score (or "Not enough data"), confidence, reason 1, reason 2 and orders.
- **Every reason shows its underlying numbers** in small grey text, so you can check it.
- **AI sentences carry an "AI wording" tag.**
- **Blue notes** list columns the app ignored, or a missing days-of-data column.

---

## Where AI is used, and what stays human

| Step | Who does it | Why |
|---|---|---|
| Reading and checking the CSV | Code | Must be exact; errors must name the real problem |
| Score, confidence, "Not enough data" | Code | Same input always gives the same answer, it runs in milliseconds, and it can't invent numbers |
| Choosing the 2 reasons | Code | The reasons must match the actual score |
| Score–sales match number | Code | It's maths, not judgement |
| Wording the reasons | **AI (Claude)** | Plain, size-aware sentences read better than fixed templates. The tests pass without it; if it's off, only the wording is plainer |
| Gathering the numbers | **Human** | No live platform connections (out of scope) |
| Deciding whether to pay a creator | **Human** | The score is a warning light; "check carefully" scores need a human look |
| Checking "Not enough data" creators | **Human** | The app refuses to guess |
| Judging whether the match number is trustworthy | **Human** | With about 30 creators it's a rough signal |
| Catching typos that are still valid numbers | **Human** | The app can't know that a real 12,000 was typed as 1,200 |

## Why these tools

- **Next.js (App Router, TypeScript):** one project holds both the screen and the small server route that keeps the API key secret, and it deploys to Vercel with no setup. TypeScript catches mistakes before they reach the screen.
- **Plain rules for scoring:** they're predictable, explainable to a judge, and testable. A brand can see exactly why a creator lost points.
- **Claude Sonnet 5.5 (`claude-sonnet-5-5`) through the official `@anthropic-ai/sdk`:**
  - Fast enough to word 30 creators in a single call.
  - Supports structured JSON output, so the reply can be checked automatically.
  - Uses server-side fallback, so a declined request is retried on another model.
- **PapaParse:** a reliable CSV reader that handles quotes, blank lines and odd spacing.
- **Vitest:** fast automatic checks for all 3 tests (`npm test`).
- **Tailwind CSS:** comes with Next.js and gives a clean screen without writing a separate stylesheet.

## Failure cases, and what the screen does

| Situation | What you see |
|---|---|
| Empty file, or header only | "This file has no creator rows." No scores |
| Excel or unreadable file | "Couldn't read this file. If it's from Excel, use File → Save As → CSV UTF-8…" |
| Missing column | "Missing column for comments. Name it one of: avg_comments, comments, …" |
| A number isn't a number, or is negative | "Row 7, followers: 'abc' is not a number." (the first 5 problems, then "…and N more") |
| Blank or duplicate handle | "Row 12 has no handle." / "@riya appears twice (rows 3 and 18)." |
| Too little data for a creator | "Not enough data: Only 2 days of data (needs 7 or more)". Not scored and not flagged |
| No days-of-data column | Scores still appear, plus a blue note saying short histories can't be detected |
| Sales file bad | A red error. Scores stay, and no match number appears |
| Fewer than 5 creators matched to sales | "Need at least 5 creators with both a score and sales…" |
| AI uses a number that isn't in the data | That creator keeps the standard sentence, with the note "AI wording rejected: used a number not in your data" |
| AI calls a warning a good sign | Standard sentence kept, with the note "AI wording rejected: didn't match the check result" |
| AI skips or duplicates a creator | Standard sentence kept for that creator, with a note |
| AI slow (over 15 s), down, or no API key | A yellow banner: "AI wording unavailable… Scores are not affected." |

### Known limitations (be upfront with judges)
- **The sample data is synthetic.** The 6 "fake" creators were planted, so the sample's match number shows that the method works, not that it's proven on real campaigns.
- **The thresholds are reasoned starting points,** not calibrated on real Indian creator data. They're easy to tune in `SETTINGS`.
- **Short histories can't be detected without a `days_of_data` column.**

---

## Run it locally

You need **Node.js 20 or newer** and **git**.

1. Download the code and install the libraries:
   ```bash
   git clone https://github.com/simrankalra-netizen/creator-authenticity-checker.git
   ```
   ```bash
   cd creator-authenticity-checker
   ```
   ```bash
   npm install
   ```
2. **(Optional) Add your Claude API key** for AI wording. Copy `.env.example` to a new file called `.env.local`, then paste your key after `ANTHROPIC_API_KEY=`. Get a key at console.anthropic.com. `.env.local` is ignored by git, so it never gets committed. Without a key, the app still works with standard wording.
3. Start the app:
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000.
4. **Try it:**
   - Upload `samples/creators.csv` in box 1.
   - Upload `samples/sales.csv` in box 2.
   - Upload the files in `samples/bad/` to see the error messages.
5. Run the automatic checks for all 3 tests:
   ```bash
   npm test
   ```

### Deploy to Vercel
Import the GitHub repo in Vercel, then add `ANTHROPIC_API_KEY` under **Project → Settings → Environment Variables**.

## Project map

| File | What it does |
|---|---|
| `app/page.tsx` | The one screen |
| `app/api/explain/route.ts` | The only Claude call |
| `lib/parseCsv.ts` | Reads and validates CSVs, and accepts common column names |
| `lib/score.ts` | Score, confidence, reasons, "Not enough data", and `SETTINGS` |
| `lib/checkAi.ts` | Checks Claude's sentences before they're shown |
| `lib/predict.ts` | The score–sales match number |
| `lib/checks.test.ts` | Automatic checks for the 3 tests |
| `samples/` | Sample creators, sales, and broken files |
