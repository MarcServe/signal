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

   **Frontend only** (no `/api` — you’ll get **HTTP 404** on Gemini enhance, bio research, Stripe, etc.):

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173).

   **Frontend + serverless `/api/*` locally** (Gemini avatar enhance, `avatar-generate`, etc.):

   1. Terminal A — Vercel dev (serves `api/` on **port 3000**; loads `.env`):

      ```bash
      npm run dev:vercel
      ```

   2. Terminal B — Vite (still use **5173** in the browser; `/api` is **proxied** to 3000):

      ```bash
      npm run dev
      ```

   Set `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, etc. in `.env` for routes that need them. If Vercel listens on another port, set `VITE_API_PROXY_TARGET=http://127.0.0.1:<port>` in `.env`.

   **Alternative:** run only `npm run dev:vercel` and open the URL Vercel prints (often [http://localhost:3000](http://localhost:3000)) instead of 5173.

## Build

```bash
npm run build
npm run preview
```

## Deploy (Vercel)

- Connect the repo to Vercel.
- Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Build command: `npm run build`; output directory: `dist`.
- The `api/` folder is deployed as serverless functions at `/api/*`. Add `SUPABASE_SERVICE_ROLE_KEY` for any route that writes to the DB.
- Shared server code lives in `api/_lib/` (leading underscore so Vercel **does not** count those files toward the Hobby serverless function limit — only top-level `api/*.ts` routes count).

## API (production)

Serverless routes in `api/` are ready for production. Set the env vars in `.env.example` and deploy.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stripe-connect` | POST | Create Stripe Connect account link (artist onboarding) |
| `/api/stripe-checkout` | POST | Create Stripe Checkout Session (purchase or subscription) |
| `/api/stripe-webhook` | POST | Stripe webhook (configure in Stripe Dashboard) |
| `/api/avatar-generate` | POST | Store avatar; `mode: "enhance"` + `provider: "gemini"` uses **Gemini** native image (set `GEMINI_API_KEY`; optional `GEMINI_IMAGE_MODEL`) |
| `/api/product-image-generate` | POST | Body `{ "product_id", "artist_id" }` — **Gemini** text-to-image cover, uploads to Storage (`avatars` bucket `product-covers/…`), updates `products.image_url` |
| `/api/artist-bio` | POST | Body `{ "action": "research", "query": "…" }` (Perplexity / Wikipedia) or `{ "action": "polish", "draft": "…", "display_name"?: "…" }` (Gemini). Requires `Authorization: Bearer` (Supabase JWT). Env: `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`, optional `GEMINI_TEXT_MODEL`. |
| `/api/avatar-tts` | POST | TTS for avatar (ElevenLabs when key set) |
| `/api/sync` | GET | Health: `{ ok: true, service: "signal-api" }` |
| `/api/sync` | POST | Sync catalogue from Bandcamp / Apple Music / Shopify |
| `/api/payouts-run` | POST | Cron: run artist payouts (optional `Authorization: Bearer CRON_SECRET`) |

Run migrations in order: `00001_initial_schema.sql`, `00002_platform_and_integrations.sql`, `00003_grants.sql`, `00004_production_backend.sql`, `00005_integrations_unique.sql`, then `00006_avatars_bucket.sql` (creates the **avatars** storage bucket and policies so profile/avatar uploads work), then **`00007_profile_visible.sql`** (online/offline profile visibility + stricter public read policies).

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
   - **Stream key:** any key (e.g. `my-stream` or a UUID from your `streams` table)

4. **Wire a stream in the app**

   When an artist “goes live”, set the stream’s `playback_url` in the DB to the HLS URL, e.g.:

   - `http://localhost:8000/live/my-stream/index.m3u8`

   (In production, use your public host and optionally `VITE_HLS_BASE_URL` in `.env`.)

5. **Optional env** (see `.env.example`):

   - `RTMP_PORT` (default 1935), `RTMP_HTTP_PORT` (default 8000), `RTMP_MEDIA_ROOT`, `RTMP_FFMPEG_PATH`, `VITE_HLS_BASE_URL`

## MVP scope

- Discovery feed (Pinterest-style masonry grid)
- Live streaming (RTMP ingest → HLS; set `playback_url` on a stream for playback)
- Avatar creation (upload image → stored; optional OpenAI/ElevenLabs later)
- In-stream purchase (mock; replace with Stripe for production)
- 20-minute free viewing paywall

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for UI and gesture guidelines.
