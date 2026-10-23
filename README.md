# Collabgram

A one-screen web app that helps a small brand decide, in minutes, whether an influencer's audience is real before paying them.

**Live app:** https://creator-authenticity-checker.vercel.app

A short onboarding (phone check, brand details, an influencer brief) comes first. Then you upload a CSV of creators and each one gets an **authenticity score (0–100)**, a **confidence level** and **2 plain-language reasons**. Upload past campaign sales and you see the scores next to real orders, plus **one number** showing how well the scores predicted sales.

Hackathon MVP. Built with Next.js, deployable to Vercel. Uses the Gemini API only to reword reasons.

---

## Job to be done

> When I'm about to approve an influencer for a brand campaign, I want to see an authenticity score with clear reasons for that creator, so I can decide in minutes whether to pay them instead of guessing from follower counts.

**User:** a D2C brand marketer at a small consumer brand in India.

### The 3 tests the MVP must pass

1. **Score 30 creators fast.** Upload a CSV of 30 creator accounts (followers, likes, comments, follower growth). Within 30 seconds, each creator shows an authenticity score, a confidence level and the top 2 reasons behind the score.
2. **Check against real sales.** Upload a second CSV of past campaign results (promo code or link sales per creator). The scores appear next to the sales, plus one number showing how well the scores predicted which creators drove real sales.
3. **Be honest about bad input.** If the CSV is missing columns or is unreadable, a clear error names what's wrong, and no made-up scores appear. If a creator has too little data, they show "Not enough data" instead of a guess, so honest creators aren't wrongly flagged.

**Out of scope:** user accounts, database, live Instagram or other platform API connections, payments, messaging creators, saved history, multi-brand support. (Phone verification was added in onboarding; it is a step in the flow, not an account system.)

---

## Onboarding

When the app opens, it asks one question at a time (Step N of 6, with Back on every step):

1. **Phone number:** a country code selector (default India +91). Only valid mobile numbers are accepted.
2. **Verification code:** "Resend code" unlocks after 30 seconds. A wrong or expired code shows a clear message and never moves you forward.
3. **Brand name.**
4. **Brand website:** the server reads the page, and Gemini summarises what the brand sells and who to, using only the page's text. You confirm or edit it. If the page can't be read, or it's an Instagram link (Instagram blocks automated reading), you type a short description instead. A summary is never invented.
5. **Brand niche:** fashion, beauty, food, fitness, tech, home, or other (free text).
6. **Influencer brief:** niche, location, main goal, follower range, budget (optional) and platform.

Then **"Your brief is ready"** lists every answer, each with an Edit button, and continues to the creator screens. There the brief is shown above as context. It doesn't change any scores.

**Storage:** the answers are kept in the browser tab's session storage only (they survive a refresh and are cleared when the tab closes). No database.

### SMS codes: demo mode
- **By default (`SMS_MODE=demo` in `.env.local`), no SMS is sent.** The code is always **123456**, and the screen says "Demo mode".
- **Expiry and resend still behave for real:** a code expires after 5 minutes, and a resend unlocks after 30 seconds. The server keeps track using a signed cookie.
- **To send real SMS:** set `SMS_MODE=twilio` and fill `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_VERIFY_SERVICE_SID` in `.env.local` (Twilio Verify). The swap point is labelled "REAL SMS" in `lib/otp.ts`. This path is untested until Twilio is set up. Sending SMS to India may also need telecom (DLT) registration.

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
 INPUT                 LOGIC (plain code)                 AI (Gemini)             LOGIC (plain code)         ACTION / OUTPUT
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
- **What Gemini receives:** each creator's handle, size tier, score, and the 2 reasons the code chose (with their numbers and a draft sentence).
- **What Gemini is asked:** rewrite each reason as one short, plain sentence, using only the numbers given, and label it a good sign or a warning.

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
- **Good file:** the table appears straight away with standard wording. Gemini's wording replaces each sentence when it arrives and passes the checks.
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
| Wording the reasons | **AI (Gemini)** | Plain, size-aware sentences read better than fixed templates. The tests pass without it; if it's off, only the wording is plainer |
| Gathering the numbers | **Human** | No live platform connections (out of scope) |
| Deciding whether to pay a creator | **Human** | The score is a warning light; "check carefully" scores need a human look |
| Checking "Not enough data" creators | **Human** | The app refuses to guess |
| Judging whether the match number is trustworthy | **Human** | With about 30 creators it's a rough signal |
| Catching typos that are still valid numbers | **Human** | The app can't know that a real 12,000 was typed as 1,200 |

## Why these tools

- **Next.js (App Router, TypeScript):** one project holds both the screen and the small server route that keeps the API key secret, and it deploys to Vercel with no setup. TypeScript catches mistakes before they reach the screen.
- **Plain rules for scoring:** they're predictable, explainable to a judge, and testable. A brand can see exactly why a creator lost points.
- **Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) through the official `@google/genai` package** (the model name is one setting in `lib/gemini.ts`):
  - Fast enough to word 30 creators in a single call.
  - Supports structured JSON output, so the reply can be checked automatically.
  - Minimal thinking level keeps replies quick and cheap.
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

## Real Instagram creators (Apify)

Set `DATA_SOURCE=apify` and `APIFY_TOKEN` in `.env.local` to build the top 10 from real public Instagram profiles instead of the demo creators. Apify is called from the server only, and no Instagram login or cookies are used.

1. **Find creators:** the brief becomes up to 4 hashtags (a skincare brand in Mumbai → `#mumbaiskincare`, `#skincaremumbai`, `#mumbaibeautyblogger`, `#skincareindia`). Apify's Instagram Hashtag Scraper reads up to 40 recent posts per hashtag (160 at most).
2. **Check posts:** the accounts posting most under those hashtags (at most 50) go to Apify's Instagram Profile Scraper, which returns each public profile with its latest 12 posts. Private accounts, accounts under 1,000 followers and shops or brands are left out.
3. **Comments (off by default):** with `APIFY_COMMENTS=on`, 10 comments on 2 posts of the best 30 creators are read to check comment quality.
4. **Score:** `lib/fromInstagram.ts` turns the raw data into the same creator record the scoring uses. `lib/liveSignals.ts` adds two checks for real data: one post with far more likes than the rest, and following far more accounts than follow back.

| Can't be measured from public data | What the app does |
|---|---|
| Audience age and cities | "Not available", not counted in Brand Fit. Location uses only the creator's own city, if shown |
| Follower history | The growth check is skipped |
| Rate per post, past campaigns | "Not available"; budget isn't counted; sales are estimated from engagement |
| Join date | "Not available" |

**Limits and cost:** the whole search stops at 110 seconds; each step has a cost cap. One search costs about $0.55–0.60 on Apify's Free plan ($5 of credit a month, so about 8 searches), or about $2.10 with comments on. Results are cached for 24 hours in a key-value store on your Apify account, and older records are deleted. If Apify fails, runs out of credits or finds nobody, the screen says so and offers the demo data, clearly labelled. Every card says either "Live data from Instagram, collected on <date>" or "Demo data".

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
2. **(Optional) Add your Gemini API key** for AI wording. Copy `.env.example` to a new file called `.env.local`, then paste your key after `GEMINI_API_KEY=`. Get a free key at aistudio.google.com (Get API key). `.env.local` is ignored by git, so it never gets committed. Without a key, the app still works with standard wording, and Step 4 always asks you to type your brand description. Also set `OTP_COOKIE_SECRET` to any long random string (the command is in `.env.example`). Leave `SMS_MODE=demo` and sign in with code **123456**.
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
Import the GitHub repo in Vercel, then add `GEMINI_API_KEY` under **Project → Settings → Environment Variables**. For real Instagram creators, also add `DATA_SOURCE=apify` and `APIFY_TOKEN`.

## Project map

| File | What it does |
|---|---|
| `app/page.tsx`, `components/App.tsx` | Shows the onboarding first, then the creator screen with the brief |
| `components/Onboarding.tsx` | The 6 onboarding steps and "Your brief is ready" |
| `components/CreatorChecker.tsx` | The creator authenticity screen |
| `app/api/otp/send`, `app/api/otp/verify` | Send and check verification codes (demo mode by default) |
| `app/api/brand-profile/route.ts` | Reads the brand website and asks Gemini for a Brand Profile (switched off) |
| `lib/otp.ts`, `lib/phone.ts`, `lib/readPage.ts`, `lib/brief.ts` | Code checks, phone checks, safe website reading, saved answers |
| `app/api/explain/route.ts` | Asks Gemini to reword the reasons |
| `lib/parseCsv.ts` | Reads and validates CSVs, and accepts common column names |
| `lib/score.ts` | Score, confidence, reasons, "Not enough data", and `SETTINGS` |
| `lib/checkAi.ts` | Checks Gemini's sentences before they're shown |
| `lib/predict.ts` | The score–sales match number |
| `lib/checks.test.ts` | Automatic checks for the 3 tests |
| `lib/creatorSource.ts` | The only place that decides where creators come from (`DATA_SOURCE`) |
| `app/api/creators/route.ts`, `lib/apifySource.ts`, `lib/apify.ts` | The live Instagram search on the server: hashtags → profiles → scores, with limits and the 24-hour cache |
| `lib/searchTerms.ts`, `lib/fromInstagram.ts`, `lib/liveSignals.ts` | Brief → hashtags, raw data → creator record, extra checks for real data (tests in `lib/live.test.ts`) |
| `samples/` | Sample creators, sales, and broken files |
