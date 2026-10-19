# FormaFit

FormaFit is a Swedish-language, mobile-first fitness and nutrition platform. It combines:

1. **Calorie and macro tracking** – a food diary with search, grams-based logging, favourites, recipes, saved meals, copying days and water logging.
2. **Meal plans** – daily and weekly plans with drag-and-drop ordering, templates, copy/duplicate and an idempotent "mark as eaten" that copies a meal into the diary.
3. **Workout planning** – programme templates (Push/Pull/Legs, Upper/Lower, Full body, 5-day split), custom programmes, supersets, rest days and an exercise library.
4. **An AI coach and generators** – a chat coach plus AI meal-plan, workout and substitution suggestions that the user reviews before anything is saved.
5. **Grocery lists** – generated from a saved plan and date range, grouped by store section, with a shopping mode, search, sharing and printing.
6. **Progress tracking** – weight with weekly averages, body measurements, intake, consistency, strength curves, private progress photos and weekly summaries.

It also includes data export and self-service account deletion, a light and dark theme (follows the system or a per-device choice), an installable web app with an offline fallback and offline-tolerant set logging, and opt-in push reminders for training days and food logging.

Units are kilograms, centimetres and grams. Dates follow the Europe/Stockholm calendar.

---

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn-style components on Radix UI primitives, lucide icons, Inter |
| Data | Supabase (PostgreSQL, Auth, Storage) via `@supabase/ssr` |
| Validation | Zod 4 on every Server Action and Route Handler |
| Charts | Recharts 3 |
| Drag and drop | dnd-kit (pointer + keyboard sensors) |
| AI | Claude API through the official `@anthropic-ai/sdk` (server-side only) |
| Tests | Vitest + React Testing Library, integration tests against Supabase, Playwright E2E |

---

## Running locally

Prerequisites: Node.js ≥ 20.9 and Docker (for the local Supabase stack). The Supabase CLI is a dev dependency, so no global install is needed.

```bash
cd formafit
npm install

# Start Postgres, Auth, Storage and Mailpit locally and apply all migrations
npm run db:start
npx supabase status -o env   # prints API_URL and PUBLISHABLE_KEY

cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # http://localhost:3000
```

Locally, email confirmation is disabled, and all auth emails (for example password resets) are delivered to Mailpit at <http://127.0.0.1:54324>.

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Development server, production build, production server |
| `npm run lint` / `typecheck` | ESLint (Next + React Compiler rules) / `tsc --noEmit` |
| `npm test` | Unit and component tests (Vitest, jsdom) |
| `npm run test:integration` | RLS, storage and SQL-function tests against the running Supabase stack |
| `npm run test:e2e` | Playwright: builds the app, starts it on port 3000 (uses the mock AI server unless `ANTHROPIC_API_KEY` is set) |
| `npm run db:reset` | Re-create the local database from the migrations |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` |
| `python3 scripts/generate-starter-data.py` | Regenerate the starter-data migration |
| `node scripts/generate-icons.mjs` | Regenerate the PNG app icons from `src/app/icon.svg` |

### Environment variables

See `.env.example` (variable names only, no secrets).

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable/anon key; RLS protects all private data. Validated at startup. |
| `NEXT_PUBLIC_SITE_URL` | yes in production | Used in auth email redirect links. |
| `ANTHROPIC_API_KEY` | for AI features | Server-side only. Without it the AI screens show a clear "not configured" notice and everything else works. |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-opus-5-5`. |
| `OPENFOODFACTS_ENABLED`, `OPENFOODFACTS_USER_AGENT` | no | Product search and barcode lookup via Open Food Facts (public API, no key). Set a user agent with contact details in production. |
| `AI_COACH_HOURLY_LIMIT`, `AI_GENERATION_HOURLY_LIMIT` | no | Per-user hourly limits (defaults 30 and 10). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for push reminders | Generate with `npx web-push generate-vapid-keys`. The private key is server-only. Without them the reminders card says notifications are not configured. |
| `CRON_SECRET` | for push reminders | At least 32 characters (`openssl rand -hex 32`). Authorises the reminder job. |
| `SUPABASE_SERVICE_ROLE_KEY` | for push reminders | Server-only. Used **only** by the reminder job, which has to read due reminders across users. Requests made by users never use it. Test tooling uses it too. |

Requests made by signed-in users always go through the publishable key and RLS.

### Deploying to a hosted Supabase project

1. Create a project, then `npx supabase link` and `npx supabase db push` to apply `supabase/migrations`.
2. In Auth settings set the Site URL and add `https://<your-domain>/auth/callback` to the redirect allow-list. Configure SMTP for real emails, and enable email confirmation if you want it (the app handles both flows).
3. Set the environment variables above on your host, then `npm run build && npm start`. Push notifications and the service worker need HTTPS (localhost is exempt).
4. For push reminders, call the reminder job every 5–60 minutes (a reminder is due from its time and for the next three hours, and is sent at most once per day):

   ```bash
   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/reminders
   ```

   Any scheduler works, for example Vercel Cron (it sends the `CRON_SECRET` header automatically; schedules more frequent than daily need a paid plan), Supabase `pg_cron` + `pg_net`, or a scheduled GitHub Actions workflow. The response contains counts only (`due`, `notified`, `sent`, `removed`, `failed`, `skipped`).

---

## Architecture

```
formafit/
├─ supabase/
│  ├─ config.toml
│  └─ migrations/
│     ├─ 20261019000100_core_schema.sql     tables, enums, constraints, indexes, triggers
│     ├─ 20261019000200_rls_policies.sql    Row Level Security for every table
│     ├─ 20261019000300_functions.sql       transactional SQL functions (security invoker)
│     ├─ 20261019000400_storage.sql         private buckets + per-user storage policies
│     ├─ 20261019000500_starter_data.sql    starter foods and exercises (generated)
│     ├─ 20261020000100_account_deletion.sql  delete_my_account() for self-service deletion
│     └─ 20261021000100_reminders.sql       push subscriptions, reminder settings, delivery log, due reminders
├─ scripts/                           generate-starter-data.py, generate-icons.mjs
├─ public/                            sw.js (service worker), offline.html, app icons
├─ src/
│  ├─ proxy.ts                         session refresh + route protection (Next 16 "proxy")
│  ├─ app/
│  │  ├─ (marketing)/                  landing page, privacy page
│  │  ├─ (auth)/                       login, register, forgot/reset password + server actions
│  │  ├─ auth/{callback,confirm,logout}  auth route handlers
│  │  ├─ onboarding/                   six-step onboarding wizard
│  │  ├─ (app)/                        authenticated app (layout enforces onboarding)
│  │  │  ├─ hem/                       dashboard
│  │  │  ├─ mat/                       diary, foods, recipes, meal plans (+ AI generator), grocery lists
│  │  │  ├─ traning/                   overview, programs, exercise library, active session, history, AI generator
│  │  │  ├─ framsteg/                  progress overview, measurements, photos
│  │  │  ├─ coach/                     AI coach UI
│  │  │  └─ profil/                    profile, targets, preferences
│  │  ├─ api/coach/route.ts            streaming coach endpoint
│  │  ├─ api/export/route.ts           JSON export of all of the user's own data
│  │  ├─ api/cron/reminders/route.ts   reminder job (CRON_SECRET), sends due push reminders
│  │  └─ manifest.ts                   web app manifest (icons in public/ and app/apple-icon.png)
│  ├─ components/                      ui/ (design system), nutrition/, workout/, charts/, coach/, layout/, pwa/
│  └─ lib/
│     ├─ nutrition/                    engine.ts, targets.ts, allergens.ts, substitutes.ts (pure, tested)
│     ├─ grocery/aggregate.ts          grocery aggregation (pure, tested)
│     ├─ workout/                      logic.ts (sets, PRs, progression), templates.ts, offline-queue.ts
│     ├─ progress/summary.ts           weekly summaries from recorded data only
│     ├─ ai/                           client, rate limiting, prompt context, draft resolvers
│     ├─ data/                         server-only query helpers
│     ├─ services/                     storage uploads, Open Food Facts, grocery generation, targets, push
│     ├─ reminders.ts, push-client.ts  reminder texts and settings helpers; browser side of Web Push
│     ├─ offline.ts                    Server Action calls that report "no connection" instead of throwing
│     ├─ validation.ts                 Zod schemas
│     └─ supabase/                     server/browser/proxy clients, admin client (reminder job only), DB types
└─ tests/
   ├─ unit/                            component tests
   ├─ integration/                     RLS, storage, SQL functions and account deletion with real users
   └─ e2e/                             Playwright specs + mock-anthropic.mjs
```

### Data model

Profiles, nutrition targets, user preferences, foods (+ servings, favourites), diary entries, water logs, recipes (+ ingredients; "saved meals" are recipes of kind `meal`), meal plans, planned meals, planned-meal ingredients, meal consumptions, exercises, workout programs, program days, program exercises, workout sessions, session exercises, session sets, measurements, progress photos, shopping lists (+ items), AI conversations, AI messages, an append-only AI request log, push subscriptions (one per browser) and a reminder delivery log.

Key design decisions:

- **Planned and consumed meals are separate.** `mark_planned_meal_eaten()` inserts a `meal_consumptions` row guarded by `unique (planned_meal_id, consumed_on)` and copies the ingredients into `diary_entries` in the same transaction, so repeated clicks cannot create duplicates.
- **History never changes silently.** Diary entries store a snapshot of the food's per-100 g values. Editing or deleting a food, plan or recipe leaves logged history untouched (foreign keys use `set null`).
- **A scheduled workout counts as done only through a completed session.** `complete_workout_session()` refuses to complete a session without at least one completed set, and only one open session per user is allowed (a partial unique index).
- **Atomic multi-row writes** (creating AI plans and programs, copying days, duplicating plans and programs, starting sessions) are SQL functions running as `security invoker`, so RLS still applies.

### Security

- Every table has RLS. Private rows are scoped to `auth.uid()`, and child rows (planned meals, ingredients, sets, list items, messages, …) additionally require that the parent belongs to the same user, so data cannot be attached to someone else's plan or session. Shared starter foods and exercises are read-only.
- Server Actions and route handlers validate input with Zod, verify the user server-side (`getClaims()`), and filter by `user_id` as defence in depth. Database errors are mapped to safe messages and internal details are never returned.
- Storage buckets are private. Policies only allow objects under `<uid>/…`. Uploads are checked by magic bytes and size on the server (not by the client-declared MIME type) as well as by the bucket's limits. Photos are shown via short-lived signed URLs.
- Logout is POST-only, redirects are restricted to relative in-app paths, password-reset responses do not reveal whether an account exists, and the app sets security headers (`X-Frame-Options`, `nosniff`, a strict referrer policy and a permissions policy).
- AI calls are server-side only. A per-user quota is enforced in the database with an append-only log that users cannot delete from.
- **Service worker caching** never stores private pages or API responses: it caches only content-hashed `/_next/static/` assets, the icons and a static offline page, and navigations always go to the network. Queued set logs live in `localStorage` on the device until they are sent, and are cleared on logout and account deletion.
- **Push subscriptions** can only be created through `register_push_subscription()`. An endpoint belongs to one browser, so registering it moves it to the current account and a previous account on a shared device stops receiving reminders there. Users can read and delete only their own subscriptions, and logging out unsubscribes the browser and deletes its row. The delivery log and `reminder_candidates()` cannot be written or called by users. The job endpoint compares the bearer token in constant time and returns counts only.
- **Data export and deletion** (Profil → Dina data): the export downloads every own row as JSON (paged past PostgREST's 1000-row limit). Deletion requires the current password, which is checked with a separate stateless client so session cookies are untouched, plus typing RADERA. It then removes all uploaded files through the Storage API and calls `delete_my_account()`, which deletes the auth user so every private table cascades.

### Nutrition calculations

All calculations happen in `src/lib/nutrition/engine.ts`, independent of the AI:

```
nutrient_amount = nutrient_per_100g × quantity_g / 100
```

Values keep full floating-point precision and are rounded only for display. Unknown nutrients are never guessed: they count as 0, and the total is flagged as incomplete in the UI. Quantities must be in the range 0 < q ≤ 5000 g.

Energy targets (`src/lib/nutrition/targets.ts`) use **Mifflin–St Jeor**: `10·kg + 6.25·cm − 5·age + s`, where s is +5 (male), −161 (female), or −78 (unspecified, flagged as less precise). Activity multipliers are 1.2 / 1.375 / 1.55 / 1.725 / 1.9. The goal adjustment is −20 % for fat loss, +10 % for muscle gain and 0 for maintenance, with a floor of max(BMR, 1200 kcal). Protein is 2.0 / 1.8 / 1.6 g per kg of reference weight (the weight at BMI 27 when BMI > 30), fat is ≥ 25 % of energy, and carbohydrates fill the rest. The UI states that these are starting points. Users can override any value, and a recalculation is always previewed and must be confirmed.

### Design system and themes

Colours are CSS tokens in `src/app/globals.css`, with a light set and a dark set. The dark set applies under `prefers-color-scheme: dark` unless the user picks a theme in Profil (stored per device in `localStorage` and applied before first paint, so the page never flashes the wrong theme). Buttons use a deeper green (`--primary-strong`) that meets WCAG AA contrast with their text, while the fresh `--primary` green is used for rings, marks and accents. The macro/chart palettes for both themes pass a colour-vision-deficiency and contrast validator, and charts always have a legend (for two or more series) and a table view.

### Offline support and reminders

- **Offline fallback.** `public/sw.js` is registered in production builds. Pages are always fetched from the network, and when that fails the static offline page is shown. Hashed build assets are served from the cache after their first load.
- **Logging sets without a connection.** If a set cannot reach the server (no signal in the gym, a dropped connection), its full values are queued per session on the device. Newer values for the same set replace older ones, and newer values queue behind any pending ones so sets are always sent in order. The queue is sent when the browser comes back online, on page load and every 15 seconds. Each entry is removed only if it was not changed while it was being sent. If the login has expired in the meantime, the queue is kept until the user has signed in again. The device's completion time is kept (when it lies within the session) so history shows when the set was actually done. The header shows how many sets are waiting, and finishing the session is blocked until they are sent. Other actions (adding sets, pausing, notes) need a connection and say so instead of failing silently.
- **Reminders** (Profil → Påminnelser) are opt-in per device. A training reminder is only sent on days when the active program has a training day on that weekday and no session was started that day. The logging reminder is only sent when nothing has been logged in the diary that day. The text states only what the data shows. Times are local to the user's time zone (taken from the browser when saving). Each reminder is claimed in the delivery log before sending, so overlapping job runs never send it twice. A temporary push-service failure releases the claim so the next run retries, and subscriptions reported as gone (404/410) are deleted. There is also a test notification. On iPhone and iPad, Web Push requires adding the app to the home screen, and the card says so.

### Food data

The app does **not** invent verified nutrition facts:

- **Starter data** (71 generic foods) is stored with `source = starter_reference` and `verification = estimated`, and is labelled "Uppskattat" throughout the UI. Energy is derived from the macros with EU Atwater factors, so every row is internally consistent. For verified values, import an authoritative source such as the Swedish Food Agency's food database (`source = livsmedelsverket`, `verification = verified`; both enum values already exist).
- **Open Food Facts** search and barcode lookups are imported as the user's own foods with `verification = community`. Energy given only in kJ is converted deterministically. Inconsistent macros are discarded, and allergen data is never treated as complete.
- **Custom foods** are `user_entered`, with an optional image upload.
- Images are only ever user uploads or Open Food Facts product images (credited). Foods and exercises without an image get a neutral illustration that is clearly not a photo. None of the 55 starter exercises ships with an image.

### AI design

- **No invented IDs or values.** The model only sees short candidate references (`F12`, `E7`, `S3`) for foods and exercises the user may use. These candidates are filtered by allergies, diet and restrictions, and foods with unconfirmed allergen data are excluded when the user has declared allergies. Responses use structured outputs (`output_config.format`), and the server validates them against Zod schemas.
- **Recalculation.** Every AI ingredient is mapped back to a real food record and recalculated by the nutrition engine. Daily totals are compared with the targets, and deviations, unknown references and unreasonable quantities are listed as discrepancies. Workout drafts are checked against the exercise library and clamped to safe ranges.
- **Approval.** Drafts are only saved after review and editing, and always as a new plan or an inactive programme. Supported actions are regenerating one meal, substituting an ingredient (deterministic ranking, optionally re-ranked by AI, with side-by-side macro differences), adjusting portions to the calorie target and logging a draft meal in today's diary. The coach cannot change data. It points the user to the confirm-first flows instead.
- **Coach context.** Only sections relevant to the question are added (nutrition, training, progress), and only if the user allows sharing logs (Profil → Inställningar). History is capped to the last 20 messages, and conversations are stored in `ai_conversations` / `ai_messages`.
- **Reliability.** Requests use the server-side refusal fallback (`fallbacks: "default"`), adaptive thinking with explicit effort, typed SDK error handling, refusal and max-token handling, and per-user rate limits. A failure shows a Swedish error message and never touches existing data.

---

## Tests (last run in this environment)

| Suite | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | 0 problems |
| Type check | `npm run typecheck` | passes |
| Unit + component | `npm test` | 17 files, 138 tests passed |
| Integration (local Supabase) | `npm run test:integration` | 3 files, 23 tests passed |
| E2E (Playwright, mobile + desktop) | `npm run test:e2e` | 15 tests passed (AI specs against the mock server) |
| Production build | `npm run build` | succeeds |

Continuous integration (`.github/workflows/formafit.yml` at the repository root) runs on every push and pull request that touches `formafit/`. One job runs lint, the type check and the unit tests. A second job starts a throwaway local Supabase stack, checks that the generated database types match the migrations, and runs the integration and E2E suites (the AI specs use the mock server, so no secrets are needed).

Unit tests cover portion scaling, meal/recipe/daily totals, invalid quantities, missing nutrition data, target calculation, allergen suitability, substitutions, grocery aggregation (identity normalisation, raw vs cooked, incompatible units, rounding), set validation, PRs, progression, weekly summaries, AI draft resolution, coach context selection, the Open Food Facts parser, upload validation, error mapping, the offline set queue, completion times of synced sets, reminder texts, the service worker's caching and push handling (run in an isolated context with fake browser APIs) and UI components.

Integration tests use real users to check account deletion (with test-only service credentials, they confirm that no private row survives in any table), cross-user isolation (profiles, foods, diary, plans, sessions, storage), idempotent "mark as eaten", history immutability, plan copying, session rules, quotas and storage type restrictions. They also cover push-subscription RLS (direct inserts refused, ownership moving on a shared device, a limit of 10 devices) and the reminder job end to end with a fake push transport: only reminders backed by data are sent, time zones are respected, invalid zones are skipped, nothing is sent twice, gone subscriptions are deleted and temporary failures are retried.

The E2E specs cover registration/login/logout/protected routes, password recovery via the email link, logging and editing diary entries, creating a meal plan with idempotent "eaten" and grocery aggregation, running and completing a workout with persistence across reloads, progress views, data export and account deletion (wrong password rejected, uploaded photo removed, login impossible afterwards), AI meal-plan generation, coach chat and AI workout generation, logging a set offline and syncing it when back online, and reminders. The reminders spec covers enabling and disabling a device, saving times, logout removing the subscription, and the job endpoint refusing calls without the secret while running with it. The AI specs also assert the request contract (structured output format, fallbacks beta, no database IDs, allergy filtering in the prompt). With `ANTHROPIC_API_KEY` set, the same specs run against the real API. That configuration was **not** run here because no key was available. Headless Chromium cannot create real push subscriptions, so the reminders spec replaces the browser's `PushManager` with a stand-in that returns a real P-256 key and a fake endpoint. Playwright's offline mode does not apply to the service worker's own requests, so the offline fallback page is covered by the unit test and the E2E spec only checks what is precached.

---

## Known limitations and future work

- **Verified food database:** only estimated starter data plus Open Food Facts community data is included. A Livsmedelsverket import (or another licensed source) is the recommended next step.
- **Barcode scanning** uses the browser's native `BarcodeDetector` (for example Chrome on Android). Other browsers fall back to manual barcode entry. No scan is ever simulated.
- **Exercise images/videos:** none are bundled because no licensed media source was available. Users can upload their own images and add video links.
- **Price estimates** are manual only. No retailer integration exists, and prices are never fabricated.
- **Live AI:** the integration was verified against a protocol-compatible mock, not the real Claude API, in this environment.
- **Offline scope:** only set logging in an open session works offline. Other pages need a connection by design, because private data is never cached on the device.
- **Push delivery** was verified up to encryption and the outgoing request. Delivery through a real browser push service (FCM, Mozilla, Apple) could not be tested in this environment. Reminders also need an external scheduler that calls the job (see Deploying).
