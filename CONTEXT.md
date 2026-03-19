# Lovable Context Engineering — Signal

Paste the content below into Lovable's "Context Engineering" / "System Prompt" to generate or align the MVP.

---

APP NAME: Signal

SUMMARY:
Signal is a luxury live streaming and commerce platform for DJs and live performers. It combines Pinterest-style discovery, TikTok-style live streaming, and Shopify-style commerce into one seamless experience where artists control their audience, data, and revenue.

CORE UX PRINCIPLE:
This is NOT a traditional app. It is a visual, immersive experience.
Users should feel like they are browsing art, not using software.

---

UI DESIGN SYSTEM:

Use a Pinterest-style masonry grid layout for the main discovery page.

Each card represents:
- Live DJ
- Artist
- Track drop
- Event
- Merchandise

Each card must include:
- Artist image or avatar
- Live badge (if active)
- Minimal overlay text
- Call to action (Watch / Buy / Join)

Navigation must be gesture-based only:
- Scroll vertically → discover content (Pinterest style)
- Tap → open live experience
- Swipe left/right → switch artists (TikTok style)
- Swipe up → view artist/shop details
- Swipe down → return to feed

NO BUTTON-HEAVY UI.

Design must be:
- Minimalist
- Luxury (white, gold, silver palette)
- High spacing, clean typography
- Image-first, not text-heavy

---

CORE FEATURES:

1. LIVE PERFORMANCE ENGINE
- Native live streaming inside the app
- Auto camera rotation: focus on DJ, rotate to audience at intervals, smooth cinematic transitions
- Live shopping overlays during stream
- Shareable to Instagram, TikTok, Apple Music
- 20-minute free viewing → paywall popup

2. DISCOVERY FEED (PINTEREST STYLE)
- Masonry grid layout, infinite scroll, visual-first browsing
- Mix of: Live streams, Products, Events, Artists

3. LIVE EXPERIENCE VIEW (TIKTOK STYLE)
- Full-screen vertical live stream
- Overlay: Buy track, Buy ticket, Join membership
- Real-time chat / reactions
- AI avatar appears during interactions

4. AI AVATAR SYSTEM
- User uploads image → AI avatar generated
- Customizable: Appearance, Style, Voice
- Avatar interacts during streams: Thank users, Promote products, Announce events

5. COMMERCE LAYER
- Sell: Music, Merchandise, Tickets, Memberships
- Products appear as visual cards in feed
- In-stream purchases without leaving app
- Stripe / PayPal integration

6. ARTIST DASHBOARD
- Profile management, Music / product management, Event setup, Audience analytics, Pricing control

7. COMMUNITY MODE
- Artist vs Audience experience
- Real-time engagement: Tips, Polls, Reactions

8. INTEGRATIONS
- Apple Music / iTunes, Bandcamp / Shopify, Instagram / TikTok, Stripe / PayPal, OBX / RTMP (streaming), OpenAI + ElevenLabs (avatars), n8n / Make (automation)

---

TECH STACK:
Frontend: React (Lovable)
Backend: Supabase
Streaming: RTMP / OBX
AI: OpenAI + ElevenLabs
Payments: Stripe / PayPal
Deployment: Vercel

---

DATABASE TABLES:
users, artists, streams, tracks, transactions, memberships, events, avatars, subscriptions

---

BUSINESS MODEL:
- Subscription for users
- Revenue share from artists
- Optional fee-free event days
- Premium artist tools

---

END OF CONTEXT
