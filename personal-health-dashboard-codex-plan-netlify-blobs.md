# Personal Health Dashboard — Codex Project Plan

> V1.0 · 2026-09-21 · Google Health API + Netlify + Netlify Blobs

This file is a concise companion plan for Codex. The authoritative development specification is `personal-health-dashboard-codex-plan-netlify-blobs-zh-TW.md`. If the two files differ, follow the Chinese specification.

## Core goals
- Use Google Health API REST v4 as the primary V1 health data source.
- Deploy the Vue 3 + TypeScript + Vite frontend on Netlify.
- Use Netlify Functions for OAuth, synchronization, and APIs; use Scheduled Functions for daily and weekly analysis.
- Store normalized records, daily aggregates, scores, insights, timeline events, and OAuth/sync state in Netlify Blobs.
- Treat health scores as personal trend indicators, not medical diagnoses.
- V1 focuses on visualizing health data in the site and does not include a data file export feature.
- V1 sends no browser/mobile push notifications, email summaries, or other proactive notifications. View health data, scores, insights, and weekly summaries only inside the authenticated site.
- Production views and analytics use only metrics that Google Health API actually returns for the owner's account. Show a proper empty state for missing metrics; never invent values or replace missing data with zero. V1 has no manual health data entry. Store source timestamps in UTC and group daily statistics by the `Asia/Taipei` civil day.
- Use Traditional Chinese (`zh-TW`) as the required V1 interface language, with Taiwan date, time, and number formats. Common abbreviations such as BMI may accompany Chinese labels. An English UI and language switcher are outside V1 scope.
- Use metric units throughout V1: kilograms for weight, kilometers for distance, and centimeters for height and waist measurements. Normalize source units into explicit canonical units while retaining source-unit metadata; the frontend must not infer units.
- Use a dark interface in V1; a light theme and theme switcher are outside scope. Maintain readable contrast for cards, charts, and states, and never rely on color alone to distinguish series, trends, or errors.
- V1 is for the project owner only, with no public registration. Sign in with the same Google account used to connect health data. The server verifies the approved account, creates a session, and derives `userId` from that session for health data APIs.
- Configure the sole approved Google account with the server-only `OWNER_GOOGLE_EMAIL` environment variable. Before exact normalized-email comparison, validate the Google ID token signature, issuer, audience, expiration, and `email_verified`; reject all other accounts and never expose the approved email in the frontend bundle.
- Google sign-in is the only V1 user authentication method; do not add an app password, PIN, or biometric unlock. Sessions last at most 30 days. Use a cookie with `HttpOnly`, `Secure`, and an appropriate `SameSite` policy, require sign-in again after expiration, and invalidate the session immediately on sign-out or failed account verification.
- Signing out hides health data. Disconnecting Google Health stops sync and preserves imported data, but the dashboard and health APIs must not display or return it; show only connection status and a reconnect action. Reconnecting the same approved Google account restores the existing data and starts sync; show the last update time until sync completes.
- V1 has no in-app permanent deletion feature. Disconnecting hides stored data without deleting it. The README/privacy documentation must explain how the project owner can manage and permanently delete data stored by this site, separately from the original data held by Google.
- Current data mainly comes from Google Fit on an Android phone, and the Google Health app is installed. For planning, assume Google Fit step data can be retrieved through Google Health API; this is unverified. Before implementing live sync, confirm the Health Connect path and verify available data types with an actual API call.
- The owner also uses O'Care 3 (`charder.charder.ocare3`) for scale measurements. Its app description includes weight and body fat, and the vendor has announced Google Fit integration. The owner confirms seeing O'Care weight or body-fat records in Google Fit but is unsure whether they appear in Health Connect. Verify that those records also appear in Health Connect, Google Health, and finally Google Health API before treating them as available to the site. This does not establish access to waist measurements, blood pressure, or notes.
- Include consented data from other apps and devices in the Google Health account. Prevent overlapping sources from being double-counted using each data type's supported reconciled stream or an explicit deduplication rule, and retain source information for review.
- Keep a provider abstraction; V1 implements `GoogleHealthProvider`.

## V1 scopes
- `googlehealth.activity_and_fitness.readonly`
- `googlehealth.health_metrics_and_measurements.readonly`

Do not request or store birthday or biological sex in V1, and do not add profile scopes for them. Store height, when available through the authorized health-metrics scope, as a timestamped normalized health record rather than static profile data.

## V1 data types
- Activity: steps, distance, active-minutes, active-energy-burned, total-calories, exercise
- Heart data is outside V1: do not query or store heart rate, resting heart rate, or HRV because the owner currently has no measuring device. Do not build a Heart page or Recovery Score until a future device supplies real data.
- Body: weight, body-fat, height
- Sleep data is outside V1: do not request the sleep scope, query or store sleep data, build a Sleep page, or calculate Sleep Score until a future app/device supplies real data.
- Optional: vo2-max, daily-vo2-max, run-vo2-max

## Architecture
```text
Google Health API -> Netlify Functions -> Netlify Blobs -> Vue Dashboard
                         |
                         +-> Scheduled analysis / sync
```

Choose the production domain and Netlify site name during deployment. Do not hard-code an assumed domain in OAuth redirects, origin checks, CORS/CSRF rules, or the PWA manifest; configure environment-specific origins centrally and document local, Deploy Preview, and production setup.


## Netlify Blobs storage design
Use `@netlify/blobs` and site-wide stores. Do not add Supabase/PostgreSQL unless explicitly requested later.

Retain synchronized historical records, aggregates, scores, insights, and timeline events without automatic expiration until the owner deletes them through the documented maintenance procedure. Disconnecting Google Health does not delete stored data. Any future backup must follow the same sensitive-data controls and deletion process; an additional backup service is outside V1 scope.

Recommended stores and keys:

```text
health-profiles
  users/{userId}/profile.json

health-auth
  users/{userId}/google-health.json

health-settings
  users/{userId}/goals.json

health-records
  users/{userId}/records/{dataType}/{yyyy}/{mm}/{recordId}.json

health-daily
  users/{userId}/daily/{yyyy}/{mm}/{yyyy-mm-dd}.json

health-scores
  users/{userId}/scores/{yyyy}/{mm}/{yyyy-mm-dd}.json

health-insights
  users/{userId}/insights/{yyyy}/{mm}/{yyyy-mm-dd}.json

health-timeline
  users/{userId}/timeline/{yyyy}/{mm}/{yyyy-mm}.json

health-sync
  users/{userId}/state/google-health.json
  users/{userId}/runs/{yyyy}/{mm}/{timestamp}-{syncId}.json
```

### Blob-specific rules
- Netlify Blobs is key/value storage, not a relational database. There is no SQL, join, relational unique constraint, or field-level query.
- Design keys so prefix listing maps to the exact access patterns needed by the UI.
- Never scan all raw records for Dashboard requests. Materialize daily/monthly aggregates during sync/analysis.
- Idempotency comes from stable keys: the same Google Health source record must always map to the same Blob key.
- Use `strong` consistency for OAuth connection state, user settings, and sync cursor/state.
- Historical records and completed aggregates may use eventual consistency where immediate update visibility is not required.
- Pick one explicit site-wide Blob region and use it consistently in every `getStore` call.
- Use `ap-southeast-1` for all site-wide Blob stores. Read `NETLIFY_BLOBS_REGION=ap-southeast-1` through one store factory and pass it to every `getStore()` call; never rely on the `us-east-2` default. Treat a region change as a data migration.
- Singapore (`sin`) remains the preferred Functions region, but Netlify currently documents custom Functions regions as a Pro/Enterprise feature, which conflicts with the Legacy Free constraint. On Legacy Free, use the site's available default Functions region and do not upgrade merely to select `sin`. Functions and Blob regions are independent; always pass the explicit Blob region even when Functions use their default region.
- The browser must never receive a generic endpoint that accepts an arbitrary Blob key.
- Derive `userId` from the authenticated session inside Functions.
- Netlify Blobs encrypts data at rest and in transit, but refresh tokens must also be encrypted at the application layer before storage.
- Build a typed repository layer under `netlify/lib/repositories/`; page/API code must not call `getStore()` directly.
- Add tests for key construction, prefix listing, overwrite/idempotency, strong-consistency reads, and unauthorized cross-user access.

## Required pages
Dashboard, Activity, Body, Workouts, Insights, Timeline, Settings.

Keep Insights and Timeline as V1 features. Generate them with deterministic rules from sufficient synchronized data only; if evidence is insufficient, omit the insight or event instead of filling it with plausible text. V1 does not use AI for these features.

Keep the Workouts page in V1. Display only exercise/workout records actually returned by Google Health API, with distinct empty states for no records, missing consent, and unsupported sources; do not generate sample workouts or treat missing records as zero.

Mobile and desktop are equally important V1 targets. Use bottom navigation on mobile and a sidebar on desktop; support touch and safe areas on mobile, use wider layouts effectively on desktop, and keep data and states consistent across both.

Show navigation entries for Activity, Body, Workouts, and similar data pages only after sync is complete and at least one usable record exists for that section. Show Insights and Timeline only after at least one displayable item has been generated. Do not decide that a section is empty while sync or analysis is still running. Hide corresponding dashboard sections when no data exists. Direct visits through an old bookmark must still require authentication and render a safe no-data state with a path back to Dashboard.

## Scores
- Activity: Steps 35%, Exercise 30%, Active Minutes 20%, Consistency 15%.
- Sleep Score is outside V1.
- Recovery Score is outside V1 and must not be inferred from other metrics.
- Default daily step goal: 8,000 steps; default weekly exercise goal: 150 minutes. Both are editable in Settings and are product starting values, not medical thresholds. Leave weight goal unset by default. Show goal progress and use it in Body Score only after the owner explicitly enters a goal; hiding and recalculation follow when the goal is cleared.
- Overall: Activity 2/3 and Body 1/3 internally (displayed as 67%/33%), derived by normalizing the original 30%/15% weights after excluding Sleep and Recovery.
- Missing dimensions re-normalize available weights and expose `data_completeness`.
- Keep Health Score in V1, using only metrics actually returned by Google Health API. Display Overall Score only when both Activity and Body are calculable and overall Data Completeness is at least 50%. Otherwise hide its numeric value and continue showing charts backed by real data. Never substitute zero or an inferred value. Define and test per-dimension minimum data, completeness calculation, and boundary cases in the algorithm specification.
- Persist `algorithm_version`.
- The dashboard's primary Health Score represents the most recent completed `Asia/Taipei` calendar day, normally yesterday, and displays its date. Today's incomplete metrics appear separately in the Today section and do not enter that completed-day score. If yesterday is unavailable or below the score threshold, use the most recent completed calculable day and label its actual date; hide the score if none exists.

## Critical implementation rules
1. Do not invent Google Health API endpoints/fields; verify against official docs.
2. V1 readonly scopes only; handle partial consent.
3. API responses must pass through provider/normalizer.
4. Sync must be idempotent; missing data is not zero.
5. Store timestamps in UTC; aggregate daily values using the `Asia/Taipei` civil day.
6. Refresh tokens are server-only and encrypted; never return them to browser.
7. Access Netlify Blobs only through protected Netlify Functions; the browser must not specify arbitrary Blob keys.
8. Use Netlify Functions rather than a persistent Express server.
9. Run automatic sync and analysis daily at `02:00` and `14:00` in `Asia/Taipei`, using Netlify UTC cron `0 6,18 * * *`. UTC `18:00` maps to `02:00` the next Taipei day, and UTC `06:00` maps to `14:00` the same Taipei day. Long jobs must be batched/backgrounded.
   Weekly statistics run from Monday 00:00 to the following Monday 00:00 in `Asia/Taipei`. Generate the previous full week's summary on Monday at 03:00 Taipei time (UTC cron `0 19 * * 0`) and recompute affected weeks when late data arrives.
10. Production displays only live data synchronized from the authorized Google Health account. Do not ship a demo mode, demo data switch, or generated health records. Fixed fixtures and mocks may be used only in development and automated tests and must never enter production Blob stores or UI.
11. Keep the installable PWA and cached offline dashboard. Mark cached data with its last update time; signing out or disconnecting must clear or block sensitive local cache. Never cache OAuth tokens or encryption keys in the PWA.
12. Initial sync imports all historical data available through Google Health API for consented data types, with no fixed lookback limit. Backfill in resumable batches, track progress per data type, and show the imported date range while backfill is incomplete.
13. V1 has no user-facing Sync Now button. Start initial backfill after connection; subsequent updates use scheduled sync and retries. Restrict sync invocation to protected internal flows and show last update time and sync status in the dashboard.
14. Treat upstream Google Health records as authoritative. Upsert corrected records by stable source ID, remove local copies when the source record is deleted, and recompute every affected daily/weekly aggregate, score, insight, and timeline event. Prefer verified, idempotent Google Health `UPSERT`/`DELETE` webhooks to locate changes, with twice-daily reconciliation as a safety net. Document bounded lookback and periodic audit behavior for data types whose API cannot expose enough deletion information.

## Development phases
1. Foundation: monorepo, Vue, Netlify, Netlify Blobs repository layer, test fixtures/mocks, basic auth/session.
2. Dashboard: Dashboard, Activity, Body, Workouts, charts, responsive UI using development-only fixtures until live sync is available.
3. Analytics: daily aggregates, baselines, scores, completeness, insights, timeline.
4. Google Health API: Cloud setup documentation, OAuth, provider, scopes, initial and incremental sync, token refresh, Blob persistence.
5. Automation: scheduled functions, daily analysis, weekly summary, retry strategy, sync state.
6. Production: PWA, security hardening, error handling, tests, README, Deploy Preview, production deployment.

After every phase run `npm test` and `npm run build`; do not continue while failing.

## Legacy Free-plan constraint
- Design deployment and normal operation for the owner's existing Netlify Legacy Free plan without paid-plan-only features or paid add-on services.
- Use the actual allowances shown under `Usage & billing` in the owner's Netlify dashboard. Do not apply the newer credit-based Free plan's 300-credit model, migrate the account, or upgrade the plan without explicit direction.
- Limit routine sync to the two scheduled runs, resume historical backfill in small batches, serve dashboard views from aggregates, and avoid redundant Function/Blob work.
- Use Deploy Previews for validation and batch changes into fewer production deploys.
- Document usage monitoring. At the 50%/75% usage notifications, reduce scheduled workload or pause cold historical backfill before core sign-in and current-data viewing are affected.

## Data resolution and cost control
- Import the complete available historical date range without fetching or storing every high-frequency raw sample.
- Store daily rollups for steps, distance, active minutes, and calories.
- Preserve body measurement samples and exercise session summaries at the useful granularity returned by the relevant endpoint.
- Record resolution, query method, and source metadata so aggregates cannot be mistaken for raw measurements. Follow current official endpoint constraints when they are stricter or more appropriate.

## Official docs
- https://developers.google.com/health/data-types
- https://developers.google.com/health/endpoints
- https://developers.google.com/health/filters
- https://developers.google.com/health/migration/data-access
- https://developers.google.com/health/developer-checklist
- https://docs.netlify.com/build/functions/scheduled-functions/

The full storage model, API/function list, UX requirements, security checklist, and Definition of Done are in `personal-health-dashboard-codex-plan-netlify-blobs-zh-TW.md`.
