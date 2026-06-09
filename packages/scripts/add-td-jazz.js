#!/usr/bin/env node
import { sanity } from '../lib/sanity.js';

async function main() {
  const festival = await sanity.create({
    _type: 'festival',
    title: 'TD Toronto Jazz Festival 2026',
    genre: 'jazz',
    venue: 'Village of Yorkville Park and venues across Toronto',
    neighbourhood: 'Bloor-Yorkville',
    dateTime: '2026-06-19T00:00:00-04:00',
    schedule: [
      { startTime: '2026-06-19T00:00:00-04:00', endTime: '2026-06-19T23:59:00-04:00' },
      { startTime: '2026-06-20T00:00:00-04:00', endTime: '2026-06-20T23:59:00-04:00' },
      { startTime: '2026-06-21T00:00:00-04:00', endTime: '2026-06-21T23:59:00-04:00' },
      { startTime: '2026-06-22T00:00:00-04:00', endTime: '2026-06-22T23:59:00-04:00' },
      { startTime: '2026-06-23T00:00:00-04:00', endTime: '2026-06-23T23:59:00-04:00' },
      { startTime: '2026-06-24T00:00:00-04:00', endTime: '2026-06-24T23:59:00-04:00' },
      { startTime: '2026-06-25T00:00:00-04:00', endTime: '2026-06-25T23:59:00-04:00' },
      { startTime: '2026-06-26T00:00:00-04:00', endTime: '2026-06-26T23:59:00-04:00' },
      { startTime: '2026-06-27T00:00:00-04:00', endTime: '2026-06-27T23:59:00-04:00' },
      { startTime: '2026-06-28T00:00:00-04:00', endTime: '2026-06-28T23:59:00-04:00' },
      { startTime: '2026-06-29T00:00:00-04:00', endTime: '2026-06-29T23:59:00-04:00' },
    ],
    externalLink: 'https://torontojazz.com/schedule-2026/',
    instagramHandle: '@tdjazzfest',
  });
  console.log('✓ festival', festival._id);

  const ref = { _type: 'reference', _ref: festival._id };
  const base = { _type: 'performance', festival: ref, genre: 'jazz', neighbourhood: 'Bloor-Yorkville', externalLink: 'https://torontojazz.com/schedule-2026/' };

  // OLG Village Stage
  const olg = { ...base, venue: 'Village of Yorkville Park (OLG Village Stage), 115 Cumberland St.' };
  const olgPerfs = [
    { artist: 'Trash Panda Brass',                        dateTime: '2026-06-19T18:30:00-04:00' },
    { artist: 'Gareth Burgess',                           dateTime: '2026-06-19T20:30:00-04:00' },
    { artist: 'Nancy Walker Quartet',                     dateTime: '2026-06-20T16:30:00-04:00' },
    { artist: 'Jonathan Nvita',                           dateTime: '2026-06-20T18:30:00-04:00' },
    { artist: 'DJ Moussa',                                dateTime: '2026-06-20T20:00:00-04:00' },
    { artist: 'Rhythm Section',                           dateTime: '2026-06-20T20:45:00-04:00' },
    { artist: 'Isy Aboagye',                              dateTime: '2026-06-21T16:30:00-04:00' },
    { artist: 'Neda Mohamadpour',                         dateTime: '2026-06-21T18:30:00-04:00' },
    { artist: 'Just Prince & Friends',                    dateTime: '2026-06-21T19:45:00-04:00' },
    { artist: 'Duck Society',                             dateTime: '2026-06-21T21:00:00-04:00' },
    { artist: 'Jean-Michel Pilc Trio',                    dateTime: '2026-06-22T18:30:00-04:00' },
    { artist: 'MA:Q',                                     dateTime: '2026-06-22T20:30:00-04:00' },
    { artist: 'Roshane Wright and the Rosh Riddims Band', dateTime: '2026-06-23T18:30:00-04:00' },
    { artist: 'ADHD',                                     dateTime: '2026-06-23T20:30:00-04:00' },
    { artist: 'Polky',                                    dateTime: '2026-06-24T18:30:00-04:00' },
    { artist: 'Selçuk Suna Quartet feat. Dia',            dateTime: '2026-06-24T19:45:00-04:00' },
    { artist: 'Tamar Ilana & Ventanas',                   dateTime: '2026-06-24T21:00:00-04:00' },
    { artist: 'Irene Torres',                             dateTime: '2026-06-25T18:30:00-04:00' },
    { artist: 'Beny Esguerra and New Tradition Music',    dateTime: '2026-06-25T19:45:00-04:00' },
    { artist: 'Orbital Ensemble',                         dateTime: '2026-06-25T21:00:00-04:00' },
    { artist: 'Ostara Project',                           dateTime: '2026-06-26T18:30:00-04:00' },
    { artist: 'Curtis Nowosad\'s Noisy World',            dateTime: '2026-06-26T20:30:00-04:00' },
    { artist: 'Jazz Musician Intensive Ensemble',         dateTime: '2026-06-27T16:30:00-04:00' },
    { artist: 'Amanda Rheaume',                           dateTime: '2026-06-27T18:30:00-04:00' },
    { artist: 'Quique Escamilla',                         dateTime: '2026-06-27T20:30:00-04:00' },
    { artist: 'Toronto Blues Society Talent Search Finals', dateTime: '2026-06-28T14:45:00-04:00' },
    { artist: 'Charley Rose Trio',                        dateTime: '2026-06-28T18:30:00-04:00' },
    { artist: 'Agneya',                                   dateTime: '2026-06-28T20:30:00-04:00' },
  ];

  // The Pilot late-night jams
  const pilot = { ...base, venue: 'The Pilot, 22 Cumberland St.' };
  const pilotDates = ['06-19','06-20','06-21','06-22','06-23','06-24','06-25','06-26','06-27','06-29'];
  const pilotPerfs = pilotDates.map(d => ({ artist: 'Late Night Jam', dateTime: `2026-${d}T22:30:00-04:00` }));

  const allPerfs = [
    ...olgPerfs.map(p => ({ ...olg, ...p })),
    ...pilotPerfs.map(p => ({ ...pilot, ...p })),
  ];

  for (const p of allPerfs) {
    const created = await sanity.create(p);
    console.log(`  ✓ ${p.dateTime.slice(5, 10)}  ${p.artist}  (${created._id})`);
  }

  console.log(`\n✅ ${allPerfs.length} performances created.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
