# Signal

**Tagline:** Signal — Stream. Sell. Connect.

Luxury live streaming and commerce platform for DJs and live performers. Pinterest-style discovery, TikTok-style live view, gesture navigation, and in-stream commerce.

## Vision

Signal is a next-generation music platform where live performance meets real-time commerce, enabling artists to monetize directly while maintaining full control of their audience and data.

## Problem

- Artists don't own their audience
- Streaming pays poorly
- Monetization tools are fragmented
- Discovery is algorithm-controlled, not artist-controlled

## User Journeys

**Artist:** Sign up → Upload image / create avatar → Add music and merch → Go live → Sell during stream → View analytics

**Audience:** Open app → Scroll discovery feed → Join live stream → Watch (20 mins free) → Subscribe or purchase → Engage with artist

## Design

- **Discovery:** Pinterest-style masonry grid; visual-first, infinite scroll
- **Live:** TikTok-style full-screen stream; gesture-based (swipe up/down/left/right)
- **Aesthetic:** Luxury white, gold, silver; minimal, no button-heavy UI
- **Assists:** **AI portrait enhancer** (Gemini) is on the Portrait page; **profile summary** uses **Perplexity** (if `PERPLEXITY_API_KEY` is set) or **Wikipedia** from Dashboard / Become an artist. Optional `VITE_ENABLE_AI_FEATURES=true` adds name-suggest on signup and a live “Avatar” host toggle.

For full Lovable context (copy-paste into Lovable.dev), see [CONTEXT.md](CONTEXT.md).

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (auth, PostgreSQL, storage)
- **Streaming:** RTMP / OBX (configure playback URL per stream)
- **Payments:** Mock in MVP; Stripe Connect for production
- **Deploy:** Vercel

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Supabase**

   - Create a project at [supabase.com](https://supabase.com).
   - Run migrations: in Supabase Dashboard → SQL Editor, run the contents of `supabase/migrations/00001_initial_schema.sql`.
   - Create a storage bucket named `avatars` (Storage → New bucket, name: `avatars`, public).
   - Copy Project URL and anon key from Settings → API.

3. **Environment**

   ```bash
   cp .env.example .env
   ```

   Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.

   For local development, **leave `VITE_APP_URL` unset** (or set it to `http://localhost:5173`). If it points at a placeholder like `https://yoursite.com`, browser calls to `/api/*` will go to the wrong host and you’ll see **Failed to fetch** on flows that use serverless routes (e.g. avatar upload).

4. **Run**

   **`vercel dev` must not run `vercel dev` again.** The default `npm run dev` script is **`vite` only** (`devCommand` in `vercel.json`), so the CLI won’t hit [recursive invocation](https://vercel.link/recursive-invocation-of-commands).

   **Vite + local `/api` on :5173** (catalog images, Stripe, etc.):

   ```bash
   npm run dev:all
   ```

   Or **two terminals**: `npm run dev:vercel`, then `npm run dev` — Vite proxies `/api` to port 3000.

   **Vercel dev only** (CLI starts Vite as the dev command; use the URL printed, often [http://localhost:3000](http://localhost:3000)):

   ```bash
   npm run dev:vercel
   ```

   Set `SUPABASE_SERVICE_ROLE_KEY`, **`OPENAI_API_KEY`** and/or **`GEMINI_API_KEY`**, etc. in `.env`. If the API uses another port, set `VITE_API_PROXY_TARGET=http://127.0.0.1:<port>`.

   **Frontend only** (no `/api`):

   ```bash
   npm run dev
   ```

   **First time using local `/api`:** run **`npm run vercel:link`** (or `npx vercel link`) once in the repo root. Pick your Vercel team and link to an existing project or create one — this writes `.vercel/` (gitignored) so `vercel dev` stops asking on every run. Then start `npm run dev:vercel` or `npm run dev:all` and wait until the terminal shows the server **ready** (e.g. listening on `3000`) before using [http://localhost:5173](http://localhost:5173).

   **`vercel dev` recursion error:** the repo’s `npm run dev` is **`vite` only** and `vercel.json` sets **`devCommand`: `vite`**. If you still see recursion, open the project on [vercel.com](https://vercel.com) → **Settings → General** and set **Development Command** to `vite` (not `npm run dev` if that pointed at an old script).

   **Project name must be lowercase (400):** `vercel.json` sets **`"name": "signal"`** so new links don’t inherit an invalid name from a capitalized folder (e.g. `Signal`). If you already have a broken `.vercel` link, remove the `.vercel` folder and run **`npm run vercel:link`** again.

   **If “Generate” / catalog images do nothing or “Failed to fetch”:**

   1. **API running** — With the app on **:5173**, **`vercel dev` must be up on :3000** (second terminal or `npm run dev:all`). If the CLI is stuck on questions (“Which scope…”), finish that flow or run `npm run vercel:link` first.
   2. **Keys** — `.env` needs **`OPENAI_API_KEY`** and/or **`GEMINI_API_KEY`** plus **`SUPABASE_SERVICE_ROLE_KEY`** for server routes.
   3. **Signed in** — Generation sends your Supabase session token; refresh login if you see 401.

## Build

```bash
npm run build
npm run preview
```

## Deploy (Vercel)

- Connect the repo to Vercel.
- Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for **Production** (and Preview if you use it). Vite inlines `VITE_*` at **build** time — if they were missing on the first deploy, add them and **Redeploy** so the discovery feed and auth hit your real Supabase project (otherwise the app falls back to demo cards only).
- Build command: `npm run build`; **output directory: `.vercel/output`** (see root `vercel.json`). The build uses **`vite-plugin-vercel`**, which emits the [Vercel Build Output API](https://vercel.com/docs/build-output-api/v3) so `api/*.ts` routes are bundled as serverless functions. A plain Vite `dist`-only deploy often **404s** on `/api/*`.
- In the Vercel project settings, avoid overriding **Output Directory** to `dist` unless you know you need it — it must match `vercel.json`.
- Add **`SUPABASE_SERVICE_ROLE_KEY`** (plus `SUPABASE_URL` if not already implied) so `/api/avatar-generate` and other server routes can use the admin client. **Profile photos still save** if this is missing: the browser uploads to Supabase Storage and updates `users` / `artists` directly, but you’ll skip optional server-side avatar history until the service role is set.
- Shared server code lives in `api/_lib/` (leading underscore so Vercel **does not** count those files toward the Hobby serverless function limit — only top-level `api/*.ts` routes count).
- **404 on `/api/*`:** Open **`/api/sync`** in the browser. You should see JSON `{"ok":true,"service":"signal-api"}`. If that 404s, serverless routes are not deployed (common fix: Vercel → **Settings → General → Root Directory** = the repo root that contains the `api/` folder, then redeploy). If `/api/sync` works but another route 404s with **JSON** `error`, that is usually the handler (e.g. wrong `artist_id` / item id).

## API (production)

Serverless routes in `api/` are ready for production. Set the env vars in `.env.example` and deploy.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stripe-connect` | POST | Create Stripe Connect account link (artist onboarding) |
| `/api/stripe-checkout` | POST | Create Stripe Checkout Session (purchase or subscription) |
| `/api/stripe-webhook` | POST | Stripe webhook (configure in Stripe Dashboard) |
| `/api/avatar-generate` | POST | Store avatar; `mode: "enhance"` uses **OpenAI** (DALL·E 2 edits) and/or **Gemini** — set `OPENAI_API_KEY` and/or `GEMINI_API_KEY`. Server picks OpenAI first when both exist unless `PREFERRED_AVATAR_ENHANCE_PROVIDER=gemini`. Optional `provider` in body overrides. |
| `/api/product-image-generate` | POST | Catalog images (one target): `{ artist_id, product_id \| membership_id \| event_id, creative_prompt?, source_image_url? }`. **LLM** (GPT via `OPENAI_API_KEY`, else Gemini text + `GEMINI_API_KEY`) refines `creative_prompt` for **Generate** and tailors notes for **Clean & standardize** (`source_image_url`). Image model: **OpenAI** when `OPENAI_API_KEY` is set (default if both keys exist), else **Gemini**. Optional `CATALOG_LLM_MODEL`, `GEMINI_TEXT_MODEL`. |
| `/api/artist-bio` | POST | Body `{ "action": "research", "query": "…" }` (Perplexity / Wikipedia) or `{ "action": "polish", "draft": "…", "display_name"?: "…" }` (Gemini). Requires `Authorization: Bearer` (Supabase JWT). Env: `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`, optional `GEMINI_TEXT_MODEL`. |
| `/api/avatar-tts` | POST | TTS for avatar (ElevenLabs when key set) |
| `/api/sync` | GET | Health: `{ ok: true, service: "signal-api" }` |
| `/api/sync` | POST | Sync catalogue from Bandcamp / Apple Music / Shopify |
| `/api/payouts-run` | POST | Cron: run artist payouts (optional `Authorization: Bearer CRON_SECRET`) |

Run migrations in order: `00001_initial_schema.sql`, `00002_platform_and_integrations.sql`, `00003_grants.sql`, `00004_production_backend.sql`, `00005_integrations_unique.sql`, then `00006_avatars_bucket.sql` (creates the **avatars** storage bucket and policies so profile/avatar uploads work), then **`00007_profile_visible.sql`** (online/offline profile visibility + stricter public read policies), then **`00008_membership_image_url.sql`** (optional image per membership tier), then **`00009_stream_chat.sql`** (live chat messages + Realtime; required for `/live/...` chat), then **`00010_feed_only_user_role_artist.sql`** (discovery feed only includes users with `role = 'artist'` so fan accounts don’t appear as artist cards).

## Live streaming (RTMP server)

To ingest live video from OBS (or any RTMP encoder) and serve HLS for the web app:

1. **Install FFmpeg** (required for RTMP → HLS):

   - macOS: `brew install ffmpeg`
   - Ubuntu: `sudo apt install ffmpeg`
   - Windows: [ffmpeg.org](https://ffmpeg.org/download.html)

2. **Start the RTMP server** (in a separate terminal):

   ```bash
   npm run rtmp
   ```

   This starts:

   - **RTMP ingest** on `rtmp://localhost:1935/live`
   - **HLS playback** on `http://localhost:8000/live/<stream_key>/index.m3u8`

3. **Configure OBS**

   - **Settings → Stream**
   - Service: Custom…
   - **Server:** `rtmp://localhost:1935/live`
   - **Stream key:** either the **stream UUID** from Studio → **Go live**, or a **custom key** (e.g. `whitesheep21`) that you enter there and **Save stream key** so HLS paths and the in-app player stay in sync.

4. **Wire playback in the app**

   In **Dashboard → Go live**, set a custom OBS key if you want, **Save stream key**, then copy the HLS URL and **Save playback URL to stream** (optional in dev if `VITE_HLS_BASE_URL` is set — the player falls back using `stream_key` + base). Fans always open `/live/<stream-uuid>`.

   After OBS is connected, click **Show as live on Signal** so `is_live` is set: your stream can appear on the **discovery feed** and a **Watch live** banner on your **artist profile**. Click **End on Signal** when you stop.

   The in-app player uses **hls.js** in Chrome/Firefox; Safari uses native HLS. To sanity-check HLS, open `http://127.0.0.1:8000/live/<stream_key>/index.m3u8` in a browser (visiting `/live/<key>` without `index.m3u8` redirects to the playlist).

   You can still set `streams.playback_url` manually in Supabase if you prefer (e.g. a CDN URL in production).

5. **Optional env** (see `.env.example`):

   - `RTMP_PORT` (default 1935), `RTMP_HTTP_PORT` (default 8000), `RTMP_MEDIA_ROOT`, `RTMP_FFMPEG_PATH`, `VITE_HLS_BASE_URL`, `VITE_RTMP_URL` (shown in Dashboard)

## MVP scope

- Discovery feed (Pinterest-style masonry grid)
- Live streaming (RTMP → HLS; **Go live** + **Show as live on Signal**; `playback_url` / `VITE_HLS_BASE_URL`; profile **Watch live**)
- Avatar creation (upload image → stored; optional OpenAI/ElevenLabs later)
- In-stream purchase (mock; replace with Stripe for production)
- 20-minute free viewing paywall

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for UI and gesture guidelines.
