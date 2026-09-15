# HbA1c Tracker

A local-first HbA1c management tracking app. Tracks the daily leading
indicators that drive HbA1c (glucose readings, diet, exercise, sleep,
protocol adherence) and projects progress toward a target — it does not
invent a fake daily HbA1c number, since HbA1c is a 3-month rolling average
that can't be measured day to day.

All data lives in the browser's IndexedDB (via Dexie). Nothing is sent to a
server. Export to JSON/CSV any time from Settings.

## Running

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
npm test         # vitest, unit tests for the scoring/calc libs
```

## What's here

- **Log glucose** — fast manual entry (numeric keypad, last-value autofill,
  context tags) plus CSV import for Contour exports. Contour's export
  columns vary by device/app version, so import auto-detects likely
  date/time/value columns and asks you to confirm the mapping before
  anything is written.
- **Diet / exercise / sleep** — carb grams, fasting windows, exercise
  (tagged aerobic/resistance/mixed, with intensity), optional sleep hours.
- **Dashboard** — rolling eA1C (ADAG formula, 30/60/90-day windows, always
  labeled as an estimate with its ~±0.5% error margin), time-in-range,
  glucose variability (SD/CV), and a plain paired-day correlation between
  diet/exercise and next-day glucose (the actual points are shown, not a
  black-box score).
- **Protocol** — define your own checklist-based protocol, log daily
  adherence, and compare adherence against the eA1C trend.
- **Projection** — fits a trend line through the rolling eA1C series and
  projects whether/when it crosses your goal. Refuses to project with fewer
  than 14 days of readings rather than show a false-confidence line.

## Explicitly out of scope

No medical advice, dosing suggestions, or "you should..." recommendations —
this is a tracking/projection tool only. eA1C is never presented as a
substitute for a lab-drawn HbA1c.

## Stack

React + TypeScript + Vite, Dexie (IndexedDB), Recharts, Papaparse (CSV).

## Deployment

Deployed to GitHub Pages on every push to `main` via
`.github/workflows/deploy.yml` — see **https://7858lc.github.io/hba1c-tracker/**.
The site is entirely static and client-side; no backend, no secrets, nothing
to configure server-side. This repo is public, but no personal data ever
leaves the browser — all glucose/diet/exercise data stays in that browser's
local IndexedDB.
