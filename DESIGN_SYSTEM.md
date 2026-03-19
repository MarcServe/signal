# Signal Design System

## UX Philosophy (core)

**Design must feel like a luxury product, not a technical tool.** No clutter. No dashboards-first thinking. Everything should feel like **browsing art, not using software.**

- Luxury over utility. Visual over textual. Simple over complex. Experience over interface.

## Layout

- **Discovery (home):** Pinterest-style **masonry grid**. Uneven tiles, visually rich, image-first. Each tile = Live DJ / Artist / Event / Track Drop / Product. Reference: Pinterest home feed – clean white background, rounded corners, minimal metadata, optional overlay CTAs on interaction.
- **Live view:** Full-bleed vertical video; overlays for Buy Track, Get Ticket, Join Membership, chat/reactions.
- **Artist profile:** Full-bleed sections with big imagery, lots of white space, minimal text.

## Navigation (gesture-based only)

- **Vertical scroll** → discover content (Pinterest style).
- **Tap** → open full-screen live experience (or artist/shop when CTA is Buy/Join and not live).
- **Swipe left/right** → switch performers (TikTok style, in live view).
- **Swipe up** → artist/shop details.
- **Swipe down** → return to feed.

**No button-heavy UI.** CTAs are minimal overlays (e.g. Watch, Buy, Join) on cards or in live overlay.

## Visual

- **Palette:** White, gold, silver. Luxury, not techy.
- **Spacing:** High spacing; clean typography; image-first, not text-heavy.
- **Cards:** Artist image/avatar, optional "LIVE" badge, minimal overlay text, single CTA. Rounded corners, no heavy borders/shadows.
- **Typography:** One display font + one body font. Minimal copy.

## Implementation

- Use design tokens in `src/design-system/tokens.ts` and CSS variables in `src/index.css`.
- Masonry grid: `MasonryGrid` in `src/design-system/MasonryGrid.tsx`.
- Gestures: `useGestureNavigation` and `GestureProvider` in `src/design-system/gestures`.

---

## LOVABLE / Context prompt (copy-paste)

**UI DESIGN SYSTEM:**

Use a Pinterest-style masonry grid layout for the main discovery page. Each item should be a visual card representing a live DJ, track, event, or product.

Navigation must be gesture-based:
- Vertical scroll for discovery
- Tap to open full-screen live experience
- Swipe left/right to switch performers
- Swipe up for product and artist details
- Swipe down to return to feed

Design must be:
- Minimalist
- Luxury (white, gold, silver tones)
- Image-first, not text-heavy
- Clean spacing with no clutter

Avoid traditional dashboards or button-heavy interfaces. The experience should feel like browsing Pinterest combined with TikTok Live.
