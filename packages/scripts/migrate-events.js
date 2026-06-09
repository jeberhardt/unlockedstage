#!/usr/bin/env node
// scripts/migrate-events.js
// ---------------------------------------------------------------------------
// Migrates legacy `event` documents to the new `festival`, `series`, and
// `performance` document types.
//
// Classification rules:
//   - Titled event whose title appears ONCE  → `festival`
//   - Titled event whose title appears 2+    → instance of a `series`
//     (one series doc is created; each instance becomes a `performance`)
//   - Untitled event                         → `performance`
//     (linked to a festival/series by venue + date proximity if possible)
//
// Usage:
//   node scripts/migrate-events.js             # dry run — shows plan, no writes
//   node scripts/migrate-events.js --execute   # actually create new documents
//   node scripts/migrate-events.js --cleanup   # delete old event docs (run AFTER verifying --execute)
// ---------------------------------------------------------------------------

import { sanity } from '../lib/sanity.js';

const EXECUTE = process.argv.includes('--execute');
const CLEANUP = process.argv.includes('--cleanup');

// ---------------------------------------------------------------------------
// Match an untitled event (performance) to a festival or series candidate.
// Returns { type: 'festival'|'series', doc } or null.
// Tries venue match first, then falls back to neighbourhood + date overlap.
// ---------------------------------------------------------------------------
function matchParent(perf, festivalsByVenue, seriesByVenue, festivalsByNeighbourhood) {
  // 1. Exact venue match → festival
  const festCandidates = festivalsByVenue.get(perf.venue) ?? [];
  if (festCandidates.length > 0) {
    const pTime = new Date(perf.dateTime).getTime();
    const match = festCandidates.find(f => {
      if (f.schedule?.length) {
        const start = new Date(f.schedule[0].startTime).getTime();
        const end   = new Date(f.schedule[f.schedule.length - 1].endTime).getTime();
        return pTime >= start && pTime <= end;
      }
      return new Date(f.dateTime).toDateString() === new Date(perf.dateTime).toDateString();
    }) ?? (festCandidates.length === 1 ? festCandidates[0] : null);
    if (match) return { type: 'festival', doc: match };
  }

  // 2. Exact venue match → series
  const serCandidates = seriesByVenue.get(perf.venue) ?? [];
  if (serCandidates.length === 1) return { type: 'series', doc: serCandidates[0] };

  // 3. Neighbourhood fallback → festival (must overlap by date)
  if (perf.neighbourhood) {
    const pTime = new Date(perf.dateTime).getTime();
    const nbCandidates = festivalsByNeighbourhood.get(perf.neighbourhood) ?? [];
    const nbMatch = nbCandidates.find(f => {
      if (f.schedule?.length) {
        const start = new Date(f.schedule[0].startTime).getTime();
        const end   = new Date(f.schedule[f.schedule.length - 1].endTime).getTime();
        return pTime >= start && pTime <= end;
      }
      return new Date(f.dateTime).toDateString() === new Date(perf.dateTime).toDateString();
    });
    if (nbMatch) return { type: 'festival', doc: nbMatch };
  }

  return null;
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n🔄 Event migration — ${EXECUTE ? 'EXECUTE' : CLEANUP ? 'CLEANUP' : 'DRY RUN'}\n`);

  // ── Cleanup mode: delete old event documents ───────────────────────────
  if (CLEANUP) {
    const ids = await sanity.fetch(`*[_type == "event"]._id`);
    if (ids.length === 0) { console.log('No event documents found — nothing to clean up.\n'); return; }
    console.log(`Deleting ${ids.length} legacy event document(s)…`);
    await Promise.all(ids.map(id => sanity.delete(id)));
    console.log('✅ Done.\n');
    return;
  }

  // ── Fetch all legacy event documents ───────────────────────────────────
  const events = await sanity.fetch(`
    *[_type == "event"] | order(dateTime asc) {
      _id, title, artist, genre, dateTime, venue, neighbourhood,
      externalLink, notes, schedule, instagramHandle, facebookHandle,
      eventPostedToSocial, postedToSocial, image
    }
  `);

  const titledEvents      = events.filter(e => e.title);
  const untitledEvents    = events.filter(e => !e.title);

  // ── Classify titled events as festival vs series instance ─────────────
  const titleCount = new Map();
  for (const e of titledEvents) titleCount.set(e.title, (titleCount.get(e.title) ?? 0) + 1);

  const festivalEvents = titledEvents.filter(e => titleCount.get(e.title) === 1);
  const seriesInstances = titledEvents.filter(e => titleCount.get(e.title) > 1);

  // Group series instances by title to get one series doc per title
  const seriesByTitle = new Map();
  for (const e of seriesInstances) {
    if (!seriesByTitle.has(e.title)) seriesByTitle.set(e.title, []);
    seriesByTitle.get(e.title).push(e);
  }

  console.log(`Found ${events.length} event documents:`);
  console.log(`  ${festivalEvents.length} festivals (unique title)`);
  console.log(`  ${seriesByTitle.size} series (${seriesInstances.length} instances across ${seriesByTitle.size} series)`);
  console.log(`  ${untitledEvents.length} untitled performances\n`);

  // ── Build lookup maps ──────────────────────────────────────────────────
  const festivalsByVenue = new Map();
  const festivalsByNeighbourhood = new Map();
  for (const f of festivalEvents) {
    if (!festivalsByVenue.has(f.venue)) festivalsByVenue.set(f.venue, []);
    festivalsByVenue.get(f.venue).push(f);
    if (f.neighbourhood) {
      if (!festivalsByNeighbourhood.has(f.neighbourhood)) festivalsByNeighbourhood.set(f.neighbourhood, []);
      festivalsByNeighbourhood.get(f.neighbourhood).push(f);
    }
  }

  // For series, use the venue of the first instance
  const seriesByVenue = new Map();
  for (const [, instances] of seriesByTitle) {
    const venue = instances[0].venue;
    if (venue) {
      if (!seriesByVenue.has(venue)) seriesByVenue.set(venue, []);
      seriesByVenue.get(venue).push(instances[0]); // representative doc
    }
  }

  // ── Plan: festivals ─────────────────────────────────────────────────────
  console.log('── Festivals ──────────────────────────────────────────────');
  for (const f of festivalEvents) {
    console.log(`  ✦ [festival]  "${f.title}"  @ ${f.venue}`);
  }

  // ── Plan: series ────────────────────────────────────────────────────────
  console.log('\n── Series ─────────────────────────────────────────────────');
  for (const [title, instances] of seriesByTitle) {
    console.log(`  ✦ [series]  "${title}"  @ ${instances[0].venue}  (${instances.length} performances)`);
  }

  // ── Plan: performances ──────────────────────────────────────────────────
  console.log('\n── Performances (untitled) ────────────────────────────────');
  const unmatched = [];
  for (const p of untitledEvents) {
    const matched = matchParent(p, festivalsByVenue, seriesByVenue, festivalsByNeighbourhood);
    if (matched) {
      console.log(`  ✦ [performance]  ${p.artist}  →  ${matched.type}:"${matched.doc.title}"`);
    } else {
      console.log(`  ✦ [performance]  ${p.artist}  →  (standalone)`);
      unmatched.push(p);
    }
  }

  // ── Plan: series-instance performances ─────────────────────────────────
  console.log('\n── Performances (series instances) ────────────────────────');
  for (const [title, instances] of seriesByTitle) {
    for (const p of instances) {
      const dateStr = p.dateTime?.slice(0, 10) ?? '?';
      const artistStr = p.artist ? `  (${p.artist})` : '';
      console.log(`  ✦ [performance]  ${dateStr}${artistStr}  →  series:"${title}"`);
    }
  }

  if (unmatched.length) {
    console.log(`\n  ⚠  ${unmatched.length} performance(s) with no matching festival or series:`);
    unmatched.forEach(p => console.log(`     - ${p.artist} @ ${p.venue} on ${p.dateTime?.slice(0, 10)}`));
  }

  if (!EXECUTE) {
    console.log('\nDry run complete. Run with --execute to apply.\n');
    return;
  }

  // ── Execute: create festival documents ─────────────────────────────────
  console.log('\n── Creating festival documents…');
  const oldIdToNewFestivalId = new Map();

  for (const f of festivalEvents) {
    const doc = {
      _type: 'festival',
      title:               f.title,
      genre:               f.genre,
      venue:               f.venue,
      neighbourhood:       f.neighbourhood,
      dateTime:            f.dateTime,
      ...(f.schedule?.length  ? { schedule: f.schedule } : {}),
      ...(f.externalLink      ? { externalLink: f.externalLink } : {}),
      ...(f.notes             ? { notes: f.notes } : {}),
      ...(f.instagramHandle   ? { instagramHandle: f.instagramHandle } : {}),
      ...(f.facebookHandle    ? { facebookHandle: f.facebookHandle } : {}),
      ...(f.eventPostedToSocial != null ? { eventPostedToSocial: f.eventPostedToSocial } : {}),
      ...(f.image             ? { image: f.image } : {}),
    };
    const created = await sanity.create(doc);
    oldIdToNewFestivalId.set(f._id, created._id);
    console.log(`  ✓ festival  "${f.title}"  →  ${created._id}`);
  }

  // ── Execute: create series documents ───────────────────────────────────
  console.log('\n── Creating series documents…');
  const titleToNewSeriesId = new Map();

  for (const [title, instances] of seriesByTitle) {
    // Use the most complete instance as the source of series-level fields
    const rep = instances.reduce((best, cur) =>
      (cur.instagramHandle || cur.facebookHandle || cur.image) ? cur : best,
      instances[0]
    );
    const doc = {
      _type: 'series',
      title,
      ...(rep.genre           ? { genre: rep.genre } : {}),
      ...(rep.venue           ? { venue: rep.venue } : {}),
      ...(rep.neighbourhood   ? { neighbourhood: rep.neighbourhood } : {}),
      ...(rep.externalLink    ? { externalLink: rep.externalLink } : {}),
      ...(rep.notes           ? { notes: rep.notes } : {}),
      ...(rep.instagramHandle ? { instagramHandle: rep.instagramHandle } : {}),
      ...(rep.facebookHandle  ? { facebookHandle: rep.facebookHandle } : {}),
      ...(rep.image           ? { image: rep.image } : {}),
    };
    const created = await sanity.create(doc);
    titleToNewSeriesId.set(title, created._id);
    console.log(`  ✓ series  "${title}"  →  ${created._id}`);
  }

  // ── Execute: create performance documents (untitled) ──────────────────
  console.log('\n── Creating performance documents (untitled)…');

  for (const p of untitledEvents) {
    const matched      = matchParent(p, festivalsByVenue, seriesByVenue, festivalsByNeighbourhood);
    const festivalId   = matched?.type === 'festival' ? oldIdToNewFestivalId.get(matched.doc._id) : null;
    const seriesId     = matched?.type === 'series'   ? titleToNewSeriesId.get(matched.doc.title) : null;

    const doc = {
      _type: 'performance',
      artist:        p.artist,
      ...(festivalId ? { festival: { _type: 'reference', _ref: festivalId } } : {}),
      ...(seriesId   ? { series:   { _type: 'reference', _ref: seriesId   } } : {}),
      ...(p.genre       ? { genre: p.genre } : {}),
      dateTime:      p.dateTime,
      ...(p.venue       ? { venue: p.venue } : {}),
      ...(p.neighbourhood ? { neighbourhood: p.neighbourhood } : {}),
      ...(p.externalLink  ? { externalLink: p.externalLink } : {}),
      ...(p.notes         ? { notes: p.notes } : {}),
      ...(p.postedToSocial != null ? { postedToSocial: p.postedToSocial } : {}),
    };
    const created = await sanity.create(doc);
    const link = festivalId ? `festival:"${matched.doc.title}"` : seriesId ? `series:"${matched.doc.title}"` : 'standalone';
    console.log(`  ✓ performance  ${p.artist}  →  ${link}  (${created._id})`);
  }

  // ── Execute: create performance documents (series instances) ──────────
  console.log('\n── Creating performance documents (series instances)…');

  for (const [title, instances] of seriesByTitle) {
    const newSeriesId = titleToNewSeriesId.get(title);
    for (const p of instances) {
      const doc = {
        _type: 'performance',
        ...(p.artist      ? { artist: p.artist } : { artist: title }),
        series: { _type: 'reference', _ref: newSeriesId },
        ...(p.genre       ? { genre: p.genre } : {}),
        dateTime:      p.dateTime,
        ...(p.venue       ? { venue: p.venue } : {}),
        ...(p.neighbourhood ? { neighbourhood: p.neighbourhood } : {}),
        ...(p.externalLink  ? { externalLink: p.externalLink } : {}),
        ...(p.notes         ? { notes: p.notes } : {}),
        ...(p.postedToSocial != null ? { postedToSocial: p.postedToSocial } : {}),
      };
      const created = await sanity.create(doc);
      const dateStr = p.dateTime?.slice(0, 10) ?? '?';
      console.log(`  ✓ performance  ${dateStr}  →  series:"${title}"  (${created._id})`);
    }
  }

  console.log('\n✅ Migration complete.');
  console.log('   Verify the new documents in Sanity Studio, then run --cleanup to remove old event docs.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
