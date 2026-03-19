/** Mock artist profile data for demo artist IDs (no DB). */

export interface DemoEvent {
  id: string
  title: string
  image_url: string | null
  starts_at: string
}

export interface DemoProduct {
  id: string
  title: string
  image_url: string | null
  type: string
}

export interface DemoMembership {
  id: string
  title: string
  price_cents: number
}

export interface DemoArtistProfile {
  display_name: string
  handle: string | null
  avatar_url: string | null
  bio: string
  events: DemoEvent[]
  products: DemoProduct[]
  memberships: DemoMembership[]
}

/** Reuse homepage DJ images from public/demo/ for artist avatars. */
const card = (n: number) => `/demo/card${n}.png`

const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

export const DEMO_ARTIST_PROFILES: Record<string, DemoArtistProfile> = {
  'demo-artist-1': {
    display_name: 'NOVA',
    handle: 'novabeats',
    avatar_url: card(1),
    bio: 'Electronic producer and DJ. Blending ambient textures with driving beats. Based in London.',
    events: [
      { id: 'demo-e1-a', title: 'NOVA · Night Drive', image_url: card(1), starts_at: nextWeek },
      { id: 'demo-e1-b', title: 'NOVA · Studio Session', image_url: card(1), starts_at: nextMonth },
    ],
    products: [
      { id: 'demo-p1-a', title: 'Midnight EP', image_url: card(1), type: 'track' },
      { id: 'demo-p1-b', title: 'NOVA Logo Cap', image_url: card(1), type: 'merch' },
    ],
    memberships: [
      { id: 'demo-m1-a', title: 'Inner Circle', price_cents: 999 },
      { id: 'demo-m1-b', title: 'VIP Access', price_cents: 1999 },
    ],
  },
  'demo-artist-2': {
    display_name: 'MARCUS REID',
    handle: 'marcusreid',
    avatar_url: card(2),
    bio: 'House and techno DJ. Resident at Signal. Bringing the groove since 2018.',
    events: [
      { id: 'demo-e2-a', title: 'Marcus Reid · Sunset Set', image_url: card(2), starts_at: nextWeek },
    ],
    products: [
      { id: 'demo-p2-a', title: 'Summer Mix 2025', image_url: card(2), type: 'track' },
      { id: 'demo-p2-b', title: 'Event Ticket', image_url: card(2), type: 'ticket' },
    ],
    memberships: [
      { id: 'demo-m2-a', title: 'Reid Crew', price_cents: 499 },
    ],
  },
  'demo-artist-3': {
    display_name: 'JAMES COLE',
    handle: 'jamescole',
    avatar_url: card(3),
    bio: 'Live performer and composer. Warehouse nights and immersive audio experiences.',
    events: [
      { id: 'demo-event-1', title: 'James Cole · Warehouse Night', image_url: card(3), starts_at: nextWeek },
      { id: 'demo-e3-b', title: 'James Cole · Ambient Night', image_url: card(3), starts_at: nextMonth },
    ],
    products: [
      { id: 'demo-product-3', title: 'Vinyl Box Set', image_url: card(3), type: 'merch' },
      { id: 'demo-p3-b', title: 'Warehouse Night Ticket', image_url: card(3), type: 'ticket' },
    ],
    memberships: [
      { id: 'demo-m3-a', title: 'Cole Collective', price_cents: 799 },
      { id: 'demo-m3-b', title: 'Backstage Pass', price_cents: 1499 },
    ],
  },
  'demo-artist-4': {
    display_name: 'DJ VANCE',
    handle: 'djvance',
    avatar_url: card(4),
    bio: 'Rooftop sessions and late-night sets. Curating the best in electronic and soul.',
    events: [
      { id: 'demo-event-2', title: 'DJ Vance · Rooftop Session', image_url: card(4), starts_at: nextWeek },
    ],
    products: [
      { id: 'demo-p4-a', title: 'Rooftop Compilation', image_url: card(4), type: 'track' },
      { id: 'demo-p4-b', title: 'Rooftop Ticket', image_url: card(4), type: 'ticket' },
    ],
    memberships: [
      { id: 'demo-m4-a', title: 'Vance VIP', price_cents: 599 },
    ],
  },
  'demo-artist-5': {
    display_name: 'STREET LUXE',
    handle: 'streetluxe',
    avatar_url: card(5),
    bio: 'Fashion-forward sounds and limited drops. Music and merch in one place.',
    events: [],
    products: [
      { id: 'demo-product-1', title: 'Street Luxe Tee', image_url: card(5), type: 'merch' },
      { id: 'demo-p5-b', title: 'Limited Hoodie', image_url: card(5), type: 'merch' },
      { id: 'demo-p5-c', title: 'Drop 001', image_url: card(5), type: 'track' },
    ],
    memberships: [
      { id: 'demo-m5-a', title: 'Early Access', price_cents: 1299 },
    ],
  },
}
