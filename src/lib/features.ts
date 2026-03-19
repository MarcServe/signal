/**
 * Product posture: minimal, luxury, visual-first.
 *
 * Portrait AI enhancer and web profile summary are always in the UI; production needs backend support configured.
 *
 * Set `VITE_ENABLE_AI_FEATURES=true` in `.env` to show:
 * - “Suggest name & handle” on Become an artist (local heuristic modal)
 * - Live host “Avatar” persona toggle (cosmetic)
 */
export const AI_FEATURES_ENABLED = import.meta.env.VITE_ENABLE_AI_FEATURES === 'true'
