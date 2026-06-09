#!/usr/bin/env node
// One-time mop-up: creates the 12 performance docs that were missed due to
// ECONNRESET during the main migration run.

import { sanity } from '../lib/sanity.js';

const GARDEN_FESTIVAL_ID = 'JlhB0rwM152rmYoMoNUOuz'; // Summer Music in the Garden
const DECK_SERIES_ID     = 'JlhB0rwM152rmYoMoNUVv9'; // Summer Kick-Off at The Deck

async function main() {
  // ── 10 untitled events that weren't processed ─────────────────────────
  const missing = await sanity.fetch(`
    *[_type == "event" && !defined(title) && dateTime > "2026-08-20T16:00:00Z"] | order(dateTime asc) {
      _id, artist, dateTime, venue, neighbourhood, genre, externalLink, notes, postedToSocial
    }
  `);

  console.log(`Creating ${missing.length} missed untitled performances…`);
  for (const p of missing) {
    const isMusicGarden = p.venue === 'Toronto Music Garden';
    const doc = {
      _type: 'performance',
      artist:        p.artist,
      ...(isMusicGarden ? { festival: { _type: 'reference', _ref: GARDEN_FESTIVAL_ID } } : {}),
      ...(p.genre         ? { genre: p.genre } : {}),
      dateTime:      p.dateTime,
      ...(p.venue         ? { venue: p.venue } : {}),
      ...(p.neighbourhood ? { neighbourhood: p.neighbourhood } : {}),
      ...(p.externalLink  ? { externalLink: p.externalLink } : {}),
      ...(p.notes         ? { notes: p.notes } : {}),
      ...(p.postedToSocial != null ? { postedToSocial: p.postedToSocial } : {}),
    };
    const created = await sanity.create(doc);
    const link = isMusicGarden ? 'Summer Music in the Garden' : 'standalone';
    console.log(`  ✓ ${p.artist} → ${link} (${created._id})`);
  }

  // ── 2 series instance events ───────────────────────────────────────────
  const seriesInstances = await sanity.fetch(`
    *[_type == "event" && title == "Summer Kick-Off at The Deck"] | order(dateTime asc) {
      _id, artist, dateTime, venue, neighbourhood, genre, externalLink, notes, postedToSocial
    }
  `);

  console.log(`\nCreating ${seriesInstances.length} series instance performances…`);
  for (const p of seriesInstances) {
    const doc = {
      _type: 'performance',
      artist:   p.artist ?? 'Summer Kick-Off at The Deck',
      series:   { _type: 'reference', _ref: DECK_SERIES_ID },
      ...(p.genre         ? { genre: p.genre } : {}),
      dateTime: p.dateTime,
      ...(p.venue         ? { venue: p.venue } : {}),
      ...(p.neighbourhood ? { neighbourhood: p.neighbourhood } : {}),
      ...(p.externalLink  ? { externalLink: p.externalLink } : {}),
      ...(p.notes         ? { notes: p.notes } : {}),
    };
    const created = await sanity.create(doc);
    console.log(`  ✓ ${p.dateTime?.slice(0, 10)} → series:"Summer Kick-Off at The Deck" (${created._id})`);
  }

  console.log('\n✅ Mop-up complete.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
