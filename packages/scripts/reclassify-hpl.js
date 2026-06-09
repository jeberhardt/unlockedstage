#!/usr/bin/env node
// Reclassifies 20 Hamilton Public Library festival docs → 1 series + 20 performances.
// Usage:
//   node scripts/reclassify-hpl.js            # dry run
//   node scripts/reclassify-hpl.js --execute

import { sanity } from '../lib/sanity.js';

const EXECUTE = process.argv.includes('--execute');

const FESTIVAL_IDS = [
  'JlhB0rwM152rmYoMoNUFdT', 'unEgA0QydKVmzGsXHDFl7z', 'JlhB0rwM152rmYoMoNUGCo',
  'JlhB0rwM152rmYoMoNUGX0', 'JlhB0rwM152rmYoMoNUGrC', 'JlhB0rwM152rmYoMoNUHBO',
  'unEgA0QydKVmzGsXHDFmqN', 'ziLlRKZLhzexTpfJq1ZOcM', 'ziLlRKZLhzexTpfJq1ZP6o',
  'unEgA0QydKVmzGsXHDFn61', 'unEgA0QydKVmzGsXHDFnRv', 'unEgA0QydKVmzGsXHDFnYB',
  'ziLlRKZLhzexTpfJq1ZPbG', 'JlhB0rwM152rmYoMoNUJ8Y', 'unEgA0QydKVmzGsXHDFnmG',
  'ziLlRKZLhzexTpfJq1ZQ9W', 'JlhB0rwM152rmYoMoNUJx2', 'JlhB0rwM152rmYoMoNUKHE',
  'ziLlRKZLhzexTpfJq1ZQtC', 'ziLlRKZLhzexTpfJq1ZRJq',
];

const SERIES_DOC = {
  _type: 'series',
  title: 'Hamilton Public Library Free Concerts',
  venue: 'Various Hamilton Public Library Branches',
  neighbourhood: 'Hamilton',
  genre: 'jazz',
  externalLink: 'https://www.hpl.ca/events-and-programs/programs/music',
};

async function main() {
  console.log(`\n📚 HPL reclassification — ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}\n`);

  const festivals = await sanity.fetch(
    `*[_id in $ids] | order(dateTime asc) { _id, title, venue, dateTime, genre, neighbourhood, externalLink, notes }`,
    { ids: FESTIVAL_IDS }
  );

  console.log(`Will CREATE series: "${SERIES_DOC.title}"`);
  console.log(`\nWill CREATE ${festivals.length} performances + DELETE ${festivals.length} festival docs:\n`);

  for (const f of festivals) {
    const artist = f.title.split(' – ').slice(1).join(' – ');
    console.log(`  ✦ "${artist}"  @  ${f.venue}  on  ${f.dateTime?.slice(0, 10)}`);
  }

  if (!EXECUTE) {
    console.log('\nDry run complete. Run with --execute to apply.\n');
    return;
  }

  const series = await sanity.create(SERIES_DOC);
  console.log(`\n✓ Created series: ${series._id}`);

  for (const f of festivals) {
    const artist = f.title.split(' – ').slice(1).join(' – ');
    const perf = await sanity.create({
      _type: 'performance',
      artist,
      series:       { _type: 'reference', _ref: series._id },
      genre:        f.genre ?? undefined,
      dateTime:     f.dateTime,
      venue:        f.venue,
      neighbourhood: f.neighbourhood,
      ...(f.externalLink ? { externalLink: f.externalLink } : {}),
      ...(f.notes        ? { notes: f.notes } : {}),
    });
    console.log(`  ✓ performance  "${artist}"  (${perf._id})`);
    await sanity.delete(f._id);
    console.log(`  ✗ deleted festival  "${f.title}"`);
  }

  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
