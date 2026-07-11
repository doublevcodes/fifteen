# Fifteen

Hackathon MVP: detect delayed trains (SWR, Southern, Southeastern) and generate / auto-submit Delay Repay claims under the DR15 ruleset — including TfL contactless journey proof for PAYG.

## Features

- **Clerk auth** — multi-user accounts
- **Manual report flow** — search Realtime Trains, pick a service, enter ticket details
- **DR15 eligibility engine** — single / return / contactless / season
- **Automated claims** — on report submit (with consent): durable Workflow → TfL proof (contactless) → TOC portal submit
- **TfL proof** — contactless PAYG evidence from Contactless & Oyster account
- **Claim summaries** — copy-ready text + links to operator claim portals (manual fallback)
- **Dashboard** — delay feed + open compensation total + automation status

## Setup

```bash
npm install
npx playwright install chromium   # only needed for CLAIM_SUBMIT_MODE=live
cp .env.example .env
# Fill Clerk keys (required for sign-in)
# Optional: RTT_TOKEN from api-portal.rtt.io
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. Configure automation at [/settings](http://localhost:3000/settings) (consent + TfL/TOC logins)
2. Report a delay at [/report](http://localhost:3000/report) — with consent, auto-submit starts immediately

Without RTT credentials, the report wizard uses **demo mock services** (27-minute delay).

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path, default `file:./prisma/dev.db` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `RTT_TOKEN` | Realtime Trains portal token ([api-portal.rtt.io](https://api-portal.rtt.io/)) |
| `RTT_USERNAME` / `RTT_PASSWORD` | Legacy `api.rtt.io` Basic Auth (deprecated Sep 2026) |
| `CLAIM_SUBMIT_MODE` | `mock` (default) or `live` Playwright submits |
| `CREDENTIALS_ENCRYPTION_KEY` | Encrypts stored TOC/TfL passwords |

## Scripts

- `npm run dev` — Next.js dev server
- `npm test` — Vitest (DR15 eligibility)
- `npm run db:push` — apply Prisma schema
- `npm run build` — production build

## Compensation rules

Aligned with SWR / Southeastern published tables:

| Delay | Single / Contactless | Return | Season |
| --- | --- | --- | --- |
| 15–29 | 25% | 12.5% | 25% of journey rate |
| 30–59 | 50% | 25% | 50% of journey rate |
| 60–119 | 100% | 50% | 100% of journey rate |
| 120+ | 100% | 100% | return journey rate (2×) |

Season journey rate = price ÷ (10 weekly / 16 flexi / 40 monthly / 120 quarterly / 464 annual).
Contactless base = TfL-charged fare for the matched journey (fallback: entered ticket price).
