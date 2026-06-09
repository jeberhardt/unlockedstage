#!/usr/bin/env node
// Consolidates all Orangeville Blues & Jazz Festival event docs:
//   1. Creates a single parent "event" doc for the festival
//   2. Unsets `title` on all 18 individual performance docs
//      (making them untitled so the migration treats them as performances)
//
// Usage:
//   node scripts/consolidate-orangeville.js            # dry run
//   node scripts/consolidate-orangeville.js --execute

import { sanity } from '../lib/sanity.js';

const EXECUTE = process.argv.includes('--execute');

const PERF_IDS = [
  '3b5e1929-fe35-4f4f-b9a9-3cda91654f84', // Blues Cruise on Broadway – Pop-Up Bands
  'c74833e2-57c0-448c-9c68-c2f4cdc36fb6', // Danny Marks – TD Broadway Stage
  '2f1aa38e-6d4f-40d4-aaf9-c73cfa29b2bd', // Joel Dupuis Band – TD Broadway Stage
  '50f33ceb-7396-4a05-8845-2e9f077aff9c', // Bonecat – TD Broadway Stage
  'cf05b156-b14f-4669-ac69-91051418843b', // Downtown Ramble – Joyful Sound Gospel Choir
  '21ca2f83-3baa-45de-a35b-48d6e7c2f1d5', // Workshop: Harmonica with Mark Stafford
  '0964240c-f28f-4f56-a426-f703280f32c0', // Emily Gilbart – TD Broadway Stage
  '6fcb1a91-c7b5-419b-9837-2c1a05493578', // Downtown Ramble – Westside High School Jazz Band
  '64fe7950-69a4-464b-a914-4f87b896ae3e', // Workshop: Roots and Resonance with Danny Boy Phelan
  '72449f61-21cd-41d0-860b-26f33b21b54a', // Becki Lynn & The Felicity Alliance – TD Broadway Stage
  'c4a92caf-7c8a-41b9-98a8-937bf9ab8a67', // Downtown Ramble – Orangeville Community Band et al
  '11d2d2bc-9b67-451a-bcfe-172a37d12940', // Jump Jive & Wail – TD Broadway Stage
  '2f46d978-a812-46bb-a07b-59a9d70b12eb', // Isy Aboagye – TD Broadway Stage
  '59c379df-72ad-4319-9695-754d9c876ab6', // Stevie T Band – TD Broadway Stage
  '55d1e1fa-9250-42f1-9ba6-b8fada142917', // Blues & Bikes – Little Joe & The Werewolves et al
  '59af3521-71e6-4046-85c3-9de0ab5cb48a', // ODSS Jazz Band – TD Broadway Stage
  '7becd8c4-4e58-489a-8058-bc5b50bb0116', // Traveling Wannabes – TD Broadway Stage
  '0cb7786c-6e10-4026-849f-85e58daae9ce', // Soul Collective – TD Broadway Stage
];

const FESTIVAL_DOC = {
  _type: 'event',
  title: 'Orangeville Blues & Jazz Festival 2026',
  genre: 'jazz',
  venue: 'Downtown Orangeville (Broadway & Mill Street)',
  neighbourhood: 'Orangeville',
  dateTime: '2026-06-05T17:00:00-04:00',
  schedule: [
    { startTime: '2026-06-05T17:00:00-04:00', endTime: '2026-06-05T22:00:00-04:00' },
    { startTime: '2026-06-06T11:00:00-04:00', endTime: '2026-06-06T20:00:00-04:00' },
    { startTime: '2026-06-07T12:00:00-04:00', endTime: '2026-06-07T17:00:00-04:00' },
  ],
  externalLink: 'https://orangevillebluesandjazz.ca/',
  notes: 'Free outdoor blues and jazz festival on Broadway and Mill Street in downtown Orangeville.',
};

async function main() {
  console.log(`\n🎷 Orangeville consolidation — ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}\n`);

  console.log('Will CREATE:');
  console.log(`  ✦ [event]  "${FESTIVAL_DOC.title}"`);
  console.log(`     venue: ${FESTIVAL_DOC.venue}`);
  console.log(`     schedule: June 5 (5pm–10pm), June 6 (11am–8pm), June 7 (12pm–5pm)\n`);

  console.log(`Will UNSET title on ${PERF_IDS.length} performance docs:`);
  const docs = await sanity.fetch(
    `*[_id in $ids]{ _id, title, artist, dateTime }`,
    { ids: PERF_IDS }
  );
  for (const d of docs.sort((a, b) => a.dateTime?.localeCompare(b.dateTime))) {
    console.log(`  ✦ ${d.dateTime?.slice(0, 16)}  ${d.artist ?? d.title}`);
  }

  if (!EXECUTE) {
    console.log('\nDry run complete. Run with --execute to apply.\n');
    return;
  }

  // Create parent festival doc
  const created = await sanity.create(FESTIVAL_DOC);
  console.log(`\n✓ Created festival: ${created._id}`);

  // Unset title on all performance docs in one transaction
  let tx = sanity.transaction();
  for (const id of PERF_IDS) {
    tx = tx.patch(id, p => p.unset(['title']));
  }
  await tx.commit();
  console.log(`✓ Unset title on ${PERF_IDS.length} performance docs\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
