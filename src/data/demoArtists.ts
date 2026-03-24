/** Mock artist profile data for demo artist IDs (no DB). */

export interface DemoEvent {
  id: string
  title: string
  image_url: string | null
  starts_at: string
  /** Optional; when set, defines when the scheduled set / broadcast ends. */
  ends_at?: string | null
}

export interface DemoProduct {
  id: string
  title: string
  image_url: string | null
  type: string
  /** Shown in checkout previews; falls back in UI if omitted. */
  price_cents?: number
}

export interface DemoMembership {
  id: string
  title: string
  price_cents: number
  /** Optional tier card image (matches DB `memberships.image_url`). */
  image_url?: string | null
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

/** Homepage + feed cards reuse local assets. */
const card = (n: number) => `/demo/card${n}.png`

/** Unsplash (with ixlib for stable CDN behaviour). */
const u = (path: string) =>
  `https://images.unsplash.com/${path}?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=82`

/**
 * Seeded Picsum URLs — reliable in dev (some Unsplash photo IDs 404 or block referrers intermittently).
 * Used for assets that were breaking in `<img>` on localhost.
 */
const picsum = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/900/1200`

const IMG = {
  clubNeon: u('photo-1470225620780-dba8ba362745'),
  warehouse: u('photo-1540039155733-5bb30b53aa14'),
  crowd: u('photo-1514525253161-7a46d19cd819'),
  studio: u('photo-1598488035139-bdbb2231ce04'),
  synth: u('photo-1614613535308-eb5fbd3d2c17'),
  vinyl: u('photo-1535905557558-afc4877a26fc'),
  rooftop: u('photo-1516450360452-9312f5e86fc7'),
  sunsetParty: picsum('signal-sunset-party'),
  ambient: u('photo-1493225457124-a3eb161ffa5f'),
  cap: u('photo-1588850561407-ed78c282e89b'),
  hoodie: u('photo-1556821840-3a63f95609a7'),
  tee: u('photo-1521572163474-6864f9cf17ab'),
  ticket: picsum('signal-event-ticket'),
  goldMember: u('photo-1550684848-fac1c5b4e853'),
  hologram: u('photo-1511671782779-c97d3d27a1d4'),
  piano: u('photo-1520523839897-bd0b52f945a0'),
  fashion: u('photo-1523381210434-271e8be1f52b'),
  street: u('photo-1552374196-c4e7ffc6e126'),
  headphones: u('photo-1484704849700-f032a568e944'),
  mixer: u('photo-1571330735066-03abc1cbcb8b'),
} as const

const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
const inFortnight = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
const inSixWeeks = new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString()
/** Demo: one “live now” block + one soon countdown (relative to page load). */
const demoLiveStarted = new Date(Date.now() - 45 * 60 * 1000).toISOString()
const demoLiveEnds = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
const demoUpcomingSoon = new Date(Date.now() + 52 * 60 * 1000).toISOString()

export const DEMO_ARTIST_PROFILES: Record<string, DemoArtistProfile> = {
  'demo-artist-1': {
    display_name: 'DJ KRUST',
    handle: 'djkrust',
    avatar_url: card(1),
    bio: `Krust (Kirk Thompson) is a pioneering English drum & bass producer, DJ, and co-owner of the Full Cycle record label. He’s widely regarded as one of the founders of jungle and drum & bass, known for his distinctive sound and influential tracks like Warhead and Soul in Motion.

He has released over 100 tracks and multiple albums, and was part of the Mercury Prize-winning group Reprazent. Alongside music, he runs a creative consultancy (Disruptive Patterns) and co-owns a CBD company (Amma Life).

After a quieter period focused on personal development and coaching, he returned to music around 2016, releasing new work including his 2020 album Edge of Everything.`,
    events: [
      {
        id: 'demo-e1-a',
        title: 'DJ KRUST · Night Drive',
        image_url: IMG.clubNeon,
        starts_at: demoLiveStarted,
        ends_at: demoLiveEnds,
      },
      {
        id: 'demo-e1-b',
        title: 'DJ KRUST · Studio Session',
        image_url: IMG.studio,
        starts_at: demoUpcomingSoon,
      },
      { id: 'demo-e1-c', title: 'DJ KRUST · Live in London', image_url: IMG.crowd, starts_at: inFortnight },
      { id: 'demo-e1-d', title: 'DJ KRUST · Bass Science Lab', image_url: IMG.synth, starts_at: inSixWeeks },
    ],
    products: [
      { id: 'demo-p1-a', title: 'Midnight EP', image_url: IMG.synth, type: 'track', price_cents: 799 },
      { id: 'demo-p1-b', title: 'Warhead (Remaster)', image_url: IMG.vinyl, type: 'track', price_cents: 299 },
      { id: 'demo-p1-c', title: 'Soul in Motion stems pack', image_url: IMG.mixer, type: 'digital', price_cents: 2499 },
      { id: 'demo-p1-d', title: 'DJ KRUST logo cap', image_url: IMG.cap, type: 'merch', price_cents: 3500 },
      { id: 'demo-p1-e', title: 'Edge of Everything vinyl', image_url: IMG.vinyl, type: 'merch', price_cents: 4500 },
      { id: 'demo-p1-f', title: 'Night Drive ticket', image_url: IMG.ticket, type: 'ticket', price_cents: 2800 },
    ],
    memberships: [
      { id: 'demo-m1-a', title: 'Inner Circle', price_cents: 999, image_url: IMG.goldMember },
      { id: 'demo-m1-b', title: 'VIP Access', price_cents: 1999, image_url: IMG.hologram },
      { id: 'demo-m1-c', title: 'Producer tier', price_cents: 4999, image_url: IMG.piano },
    ],
  },
  'demo-artist-2': {
    display_name: 'MARCUS REID',
    handle: 'marcusreid',
    avatar_url: card(2),
    bio: 'House and techno DJ. Resident at Signal. Bringing the groove since 2018 — sunset sets, warehouse hours, and exclusive edits for members.',
    events: [
      {
        id: 'demo-e2-a',
        title: 'Marcus Reid · Sunset Set',
        image_url: IMG.sunsetParty,
        starts_at: demoLiveStarted,
        ends_at: demoLiveEnds,
      },
      { id: 'demo-e2-b', title: 'Marcus Reid · Afterhours', image_url: IMG.clubNeon, starts_at: demoUpcomingSoon },
      { id: 'demo-e2-c', title: 'Marcus Reid · Open-air', image_url: IMG.rooftop, starts_at: nextMonth },
    ],
    products: [
      { id: 'demo-p2-a', title: 'Summer Mix 2025', image_url: IMG.sunsetParty, type: 'track', price_cents: 599 },
      { id: 'demo-p2-d', title: 'Warehouse edit pack', image_url: IMG.headphones, type: 'digital', price_cents: 1899 },
      { id: 'demo-p2-b', title: 'Signal residency ticket', image_url: IMG.ticket, type: 'ticket', price_cents: 2200 },
      { id: 'demo-p2-c', title: 'MR embroidered tee', image_url: IMG.tee, type: 'merch', price_cents: 3200 },
    ],
    memberships: [
      { id: 'demo-m2-a', title: 'Reid Crew', price_cents: 499, image_url: IMG.goldMember },
      { id: 'demo-m2-b', title: 'Backstage edits', price_cents: 1299, image_url: IMG.studio },
    ],
  },
  'demo-artist-3': {
    display_name: 'JAMES COLE',
    handle: 'jamescole',
    avatar_url: card(3),
    bio: 'Live performer and composer. Warehouse nights and immersive audio — strings, subs, and long-form journeys.',
    events: [
      { id: 'demo-event-1', title: 'James Cole · Warehouse Night', image_url: IMG.warehouse, starts_at: nextWeek },
      { id: 'demo-e3-b', title: 'James Cole · Ambient Night', image_url: IMG.ambient, starts_at: nextMonth },
      { id: 'demo-e3-c', title: 'James Cole · Quartet live', image_url: IMG.piano, starts_at: inFortnight },
    ],
    products: [
      { id: 'demo-product-3', title: 'Vinyl box set', image_url: IMG.vinyl, type: 'merch', price_cents: 12000 },
      { id: 'demo-p3-b', title: 'Warehouse Night ticket', image_url: IMG.ticket, type: 'ticket', price_cents: 3500 },
      { id: 'demo-p3-c', title: 'Live set recording', image_url: IMG.crowd, type: 'track', price_cents: 899 },
      { id: 'demo-p3-d', title: 'Score PDF + stems', image_url: IMG.studio, type: 'digital', price_cents: 3999 },
    ],
    memberships: [
      { id: 'demo-m3-a', title: 'Cole Collective', price_cents: 799, image_url: IMG.ambient },
      { id: 'demo-m3-b', title: 'Backstage pass', price_cents: 1499, image_url: IMG.hologram },
      { id: 'demo-m3-c', title: 'Composer circle', price_cents: 2999, image_url: IMG.piano },
    ],
  },
  'demo-artist-4': {
    display_name: 'DJ VANCE',
    handle: 'djvance',
    avatar_url: card(4),
    bio: 'Rooftop sessions and late-night sets. Curating electronic, soul, and rare grooves for the city skyline.',
    events: [
      { id: 'demo-event-2', title: 'DJ Vance · Rooftop Session', image_url: IMG.rooftop, starts_at: nextWeek },
      { id: 'demo-e4-b', title: 'DJ Vance · Skyline afters', image_url: IMG.sunsetParty, starts_at: inSixWeeks },
      { id: 'demo-e4-c', title: 'DJ Vance · Soul select', image_url: IMG.ambient, starts_at: nextMonth },
    ],
    products: [
      { id: 'demo-p4-a', title: 'Rooftop compilation', image_url: IMG.rooftop, type: 'track', price_cents: 699 },
      { id: 'demo-p4-c', title: 'Rare groove digital crate', image_url: IMG.vinyl, type: 'digital', price_cents: 1599 },
      { id: 'demo-p4-b', title: 'Rooftop ticket', image_url: IMG.ticket, type: 'ticket', price_cents: 4500 },
      { id: 'demo-p4-d', title: 'Signal x Vance windbreaker', image_url: IMG.hoodie, type: 'merch', price_cents: 8900 },
    ],
    memberships: [
      { id: 'demo-m4-a', title: 'Vance VIP', price_cents: 599, image_url: IMG.goldMember },
      { id: 'demo-m4-b', title: 'Skyline society', price_cents: 1799, image_url: IMG.hologram },
    ],
  },
  'demo-artist-5': {
    display_name: 'STREET LUXE',
    handle: 'streetluxe',
    avatar_url: card(5),
    bio: 'Fashion-forward sounds and limited drops. Music, merch, and member-only colorways in one lane.',
    events: [
      { id: 'demo-e5-a', title: 'Street Luxe · Pop-up DJ set', image_url: IMG.street, starts_at: nextWeek },
      { id: 'demo-e5-b', title: 'Street Luxe · Runway afterparty', image_url: IMG.fashion, starts_at: inFortnight },
    ],
    products: [
      { id: 'demo-product-1', title: 'Street Luxe tee', image_url: IMG.tee, type: 'merch', price_cents: 4500 },
      { id: 'demo-p5-b', title: 'Limited hoodie', image_url: IMG.hoodie, type: 'merch', price_cents: 9800 },
      { id: 'demo-p5-d', title: 'Lookbook PDF + wallpapers', image_url: IMG.fashion, type: 'digital', price_cents: 499 },
      { id: 'demo-p5-c', title: 'Drop 001', image_url: IMG.street, type: 'track', price_cents: 499 },
      { id: 'demo-p5-e', title: 'Pop-up entry', image_url: IMG.ticket, type: 'ticket', price_cents: 1500 },
    ],
    memberships: [
      { id: 'demo-m5-a', title: 'Early access', price_cents: 1299, image_url: IMG.goldMember },
      { id: 'demo-m5-b', title: 'Founders club', price_cents: 4999, image_url: IMG.hologram },
    ],
  },
}
