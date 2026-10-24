# Capture Moments

A consent-first visitor page and private owner dashboard, built with Vite and the open-source Supabase platform. GitHub Pages serves the static frontend. A Supabase Edge Function records only explicit submissions. No page-load tracking, camera recording, automatic screenshots, or passwords in Git.

## Run locally

Use Node.js 24. Run `npm ci`, then `npm run dev` in this checkout. Without backend variables, the site runs in demo mode and sends no submissions. Use the existing checkout; a Git worktree is unnecessary.

Copy `.env.example` to `.env.local` and replace its placeholders after creating a Supabase project. Only use the public anon/publishable browser key. All VITE variables are public build output. Never put a service-role key, database password, or owner password in a VITE variable or GitHub. `.env` files are ignored.

## Connect Supabase (required for live collection)

1. Create a Supabase project (hosted or self-hosted with Auth, Storage, Postgres and Edge Functions). In its SQL editor run `supabase/migrations/202610240001_initial.sql` once.
2. In Authentication, disable public signup, create the owner account with a strong password, and copy its user UUID. In the SQL editor run `insert into public.owners(user_id) values ('YOUR-OWNER-USER-UUID');`. Do not put the password in source code. Configure Auth rate limits and account recovery in the Supabase console.
3. Using an authenticated Supabase CLI, run `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase secrets set SITE_ORIGIN=https://reallikram.github.io` and `supabase functions deploy record-visit --no-verify-jwt`. The function needs public access for consented submissions; owner deletion separately verifies the JWT and owners table. Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to its function runtime; they must never reach the frontend.
4. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in `.env.local` for development and as GitHub repository Actions **variables** for production. For local submissions, set the function SITE_ORIGIN to the actual local origin (e.g. http://localhost:5173). Use a separate development project rather than changing production back and forth. CORS permits only one configured origin; it is not authentication or anti-abuse protection.
5. Rebuild after changing browser configuration: `npm run build`.

## Publish

Push to `main`, enable Settings → Pages → Source: GitHub Actions, then run the included Deploy GitHub Pages workflow. Expected URL: https://reallikram.github.io/Capture-Moments/ . The account `ikram` would need its own repository to use ikram.github.io. No custom domain is configured.

## Behavior and privacy

Visitors must agree to sharing IP, timestamp and user-agent information and press Share my visit. Device category is a user-agent estimate, not verified hardware. IP is the value reported by the hosting gateway and may represent a VPN/proxy or be inaccurate; do not treat it as proof of identity. Location is separately opt-in browser geolocation, rounded to 0.1 degree before transmission. IP geolocation is not performed.

Camera and screen captures are optional, JPEG, bounded to 1280px and 2MB each, previewed before upload, and removable. The browser prompts for camera/screen permission. Screen capture uses the surface the visitor chooses, not a forced full-screen photo. Media tracks stop immediately after capture and on navigation. HTTPS or localhost is required for browser media APIs. Mobile screen sharing is often unsupported.

The private captures bucket has no anonymous read policies. Only listed owners can read unexpired visits/images; signed image links expire after five minutes. An unguessable private deletion link is returned once to each visitor; keep it private. The dashboard supports owner deletion. Collection uses the function, not anonymous direct table/storage writes. User-agent strings are rendered as text/escaped HTML.

Visits expire from dashboard and new storage access after 30 days. The function physically purges up to 100 expired submissions on each request. Previously issued image links may remain usable for up to five minutes. If traffic stops, expired data can remain stored: configure a scheduled cleanup job for guaranteed physical deletion deadlines, and review provider backup retention. Do not promise guaranteed 30-day erasure without that additional configuration.

Before exposing a public collection endpoint at scale, configure gateway rate limiting/CAPTCHA and storage quotas in your hosting infrastructure; CORS and the consent checkbox do not prevent automated submissions. Confirm the privacy notice, retention policy and site-owner contact details meet your requirements. The app does not claim to identify every visitor: users can decline, block scripts, or close the page.

## Validation

`npm run build` creates the Pages artifact. `npm run dev` starts the development server. Local browser smoke tests can verify demo UI and permission handling. Live submissions, owner authorization, deletion, storage policies and expiry must additionally be exercised against your configured Supabase project; they cannot be validated without that project.
