# Liquid stacked image scroll (editorial / “Chanel-style” feed)

Portable notes for implementing a **continuous, overlapping vertical stack** of full-bleed images: the next panel rises **under** the current one before it fully leaves the viewport—layered and editorial, not a hard slide deck.

This document matches the pattern used in this repo (`DiscoveryMobileStack`, `FullScreenSection`, `OverlayText`).

---

## What you’re building

| Feel | Avoid |
|------|--------|
| Next image enters while the previous is still visible | Each full-screen snap “replacing” the last |
| Overlap and depth | Only `100vh` sections with no overlap |
| Smooth, readerly scroll | Aggressive `scroll-snap-type: mandatory` on the main axis |

**Core idea:** `position: sticky` + **shorter-than-viewport** panels + **negative top margin** on panels after the first + **rising `z-index`**. The scroll happens inside a **single, height-bounded** overflow container.

---

## Layout mechanics

1. **Scroll container**  
   One element is `overflow-y: auto` (or `scroll`) and has a **fixed height** (e.g. `100dvh` or `100%` of a flex parent). All sticky children use **this** scrollport—not the document—unless you intentionally scroll the window.

2. **Each “card”**  
   - `position: sticky; top: 0;`  
   - Height **below** full viewport, e.g. `82dvh` / `82vh`, so the user senses the next layer early.  
   - **`z-index` increases** with index so newer panels paint **on top** as they overlap.

3. **Overlap (liquid flow)**  
   On every card **after the first**, add **negative top margin** (e.g. `-6vh`). That pulls the next card up into the previous one’s visual space so the transition reads as **stacking**, not a hard cut.

4. **First card**  
   No negative margin (you don’t want to pull the first panel under the browser chrome or a header).

5. **Depth (optional)**  
   Upward shadow on stacked cards only, e.g.  
   `box-shadow: 0 -12px 44px rgba(0, 0, 0, 0.4)`.

6. **Flat vs rounded**  
   This repo uses **square** edges on stacked panels for a flat editorial stack. Rounded top corners are optional; if you use them, ensure bottom overlays don’t sit where the next card’s curve covers them.

7. **Last card (scroll end)**  
   Middle cards use **short** height (e.g. `82dvh`) for the liquid peek. The **final** sticky panel should use **full viewport height** (`100dvh`) so at max scroll nothing from lower z-index layers shows through the bottom band, and pair with **`bg-black`** on the scrollport to mask any subpixel gaps.

8. **Images**  
   Use **`inset: 0`** (or explicit `top/left/right/bottom: 0`) with `object-fit: cover` so media fully covers each panel; anchoring only `right`/`bottom` can leave a strip of the layer below visible at the top.

---

## Minimal HTML shape

```html
<div class="stack-scrollport">
  <section class="stack-card" style="z-index: 1"><!-- first: no negative margin --></section>
  <section class="stack-card stack-card--layered" style="z-index: 2"></section>
  <section class="stack-card stack-card--layered" style="z-index: 3"></section>
</div>
```

---

## Reference CSS (vanilla)

```css
.stack-scrollport {
  height: 100dvh; /* or 100% inside a sized parent */
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

.stack-card {
  position: sticky;
  top: 0;
  height: 82dvh; /* shorter than viewport: “next” can peek */
  width: 100%;
  overflow: hidden;
  background: #000;
}

/* Cards 2…n: overlap + depth */
.stack-card--layered {
  margin-top: -6vh;
  box-shadow: 0 -12px 44px rgba(0, 0, 0, 0.4);
}

.stack-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Avoid transform: scale() on the sticky element itself if sticky behaves oddly;
   scale on a child inside the card if needed. */
```

---

## Tailwind-style mapping (this repo)

**Scrollport**

- `h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth`

**Each section**

- Base: `sticky top-0 flex h-[82dvh] w-full shrink-0 flex-col overflow-hidden bg-black`
- Layered (`index > 0`): `-mt-[6vh] shadow-[0_-12px_44px_rgba(0,0,0,0.4)]`
- `style={{ zIndex: index + 1 }}`

**Snap**

- This feed uses **no** vertical snap on the scrollport so motion feels **continuous**. If you add snap, prefer `snap-proximity` over `mandatory` for a less mechanical feel.

---

## Flexbox gotcha (critical)

If the scrollport is inside a flex column, **ancestors must allow shrinking**:

- Parent chain: `min-h-0` (and often `overflow-hidden` on the wrapper you want to clip to the viewport).
- The scrollport: `h-full` or `flex-1` with `min-h-0`, **not** an unconstrained height that grows with content.

Otherwise the browser scrolls the **page** instead of the inner div, and `position: sticky` will attach to the wrong scrollport—stacking will feel broken.

Also: `html, body, #root { height: 100% }` (or equivalent) helps `h-full` chains from the root.

---

## Bottom text / overlays

When card N+1 slides up, it can cover the **bottom** of card N. For any card **that has another card below it**:

- Move the overlay **up** from the bottom: e.g. `bottom: max(0.75rem, 7vh)` instead of `bottom: 0`.
- Use a **taller** top gradient (`padding-top` on the gradient) so type stays on a readable fade.

Last card: keep the overlay at the bottom if nothing stacks under it.

In this repo: `overlayLift={index < items.length - 1}` on the card, passed to overlay as `liftForIncomingCard`.

---

## Images

- Prefer **`object-fit: cover`** with a **filled** absolute or sized box.
- Avoid **`transform: scale()` > 1** on the image if it causes **subpixel bleed** or negative offsets at the edges; clip with `overflow: hidden` on the card.

---

## Optional upgrades (not required)

- **Motion:** subtle scale/opacity on scroll via Framer Motion, GSAP ScrollTrigger, or CSS scroll-driven animations.
- **Parallax:** separate image translation from the sticky panel (mind performance on mobile).
- **Header offset:** if the stack sits below a fixed bar, use `top: var(--header-h)` on the sticky sections and pad the scroll area accordingly.

---

## Reference in this repository

| Piece | Path |
|-------|------|
| Scrollport + list | `src/components/DiscoveryMobileStack.tsx` |
| Sticky section + overlap + z-index | `src/components/immersive/FullScreenSection.tsx` |
| Overlay copy + lift | `src/components/immersive/OverlayText.tsx` |
| Card + image + passes `overlayLift` | `src/components/DiscoveryCard.tsx` |
| Viewport / flex shell | `src/layouts/ImmersiveLayout.tsx`, `src/pages/Discovery.tsx`, `src/App.tsx` |
| **Artist profile (image-first rails, not grids)** | `src/pages/ArtistProfile.tsx`, `src/components/artist/*` — horizontal snap rails, hero `min-h-[100dvh]`, About in sheet, schedule times behind clock icon |

The **home** liquid stack is unchanged; artist uses **horizontal** `overflow-x` rails with full-bleed tiles instead of vertical section grids.

---

## Quick checklist for a new project

- [ ] One bounded overflow-y scrollport; sticky sections are **inside** it.
- [ ] Flex parents use `min-h-0` where needed so the scrollport doesn’t expand to full content height.
- [ ] Card height &lt; 100vh/dvh; negative margin only from the second card onward.
- [ ] `z-index` increases with slide index.
- [ ] Bottom overlays lifted for every slide except the last (if overlays sit low).
- [ ] Images `object-fit: cover`; avoid scaling past edges without clipping.
