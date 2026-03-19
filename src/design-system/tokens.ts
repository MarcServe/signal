/**
 * Signal design tokens – luxury (white, gold, silver), minimal, image-first.
 * Use these in components; CSS variables in index.css for global styling.
 */
export const tokens = {
  colors: {
    white: 'var(--signal-white)',
    whitePure: 'var(--signal-white-pure)',
    gold: 'var(--signal-gold)',
    goldLight: 'var(--signal-gold-light)',
    silver: 'var(--signal-silver)',
    silverLight: 'var(--signal-silver-light)',
    ink: 'var(--signal-ink)',
    inkMuted: 'var(--signal-ink-muted)',
  },
  space: {
    xs: 'var(--space-xs)',
    sm: 'var(--space-sm)',
    md: 'var(--space-md)',
    lg: 'var(--space-lg)',
    xl: 'var(--space-xl)',
    '2xl': 'var(--space-2xl)',
    '3xl': 'var(--space-3xl)',
    gutter: 'var(--gutter)',
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    card: 'var(--radius-card)',
  },
  font: {
    display: 'var(--font-display)',
    body: 'var(--font-body)',
  },
  transition: {
    easeOut: 'var(--ease-out)',
    fast: 'var(--duration-fast)',
    normal: 'var(--duration-normal)',
  },
} as const
