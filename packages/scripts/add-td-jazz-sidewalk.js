#!/usr/bin/env node
import { sanity } from '../lib/sanity.js';

const FESTIVAL_ID = 'JlhB0rwM152rmYoMoODfZq';

const V = {
  rock:      'The Rock, Village of Yorkville Park',
  bloor157:  '157 Bloor Street West (at Avenue Road)',
  bloor55:   '55 Bloor Street West (@ Bay Street)',
  hazelton:  '5 Hazelton Avenue (@ Yorkville Avenue)',
  yorkville: '101 Yorkville Avenue (near Old York Lane)',
};

const d = (date, time) => `2026-${date}T${time}:00-04:00`;

const performances = [
  // June 19
  { artist: 'El Ceibo',          dateTime: d('06-19','17:45'), venue: V.rock },
  { artist: 'Tak Arikushi Trio', dateTime: d('06-19','17:45'), venue: V.bloor157 },
  { artist: 'Swamperella',       dateTime: d('06-19','17:45'), venue: V.bloor55 },
  { artist: 'Tak Arikushi Trio', dateTime: d('06-19','19:15'), venue: V.hazelton },
  { artist: 'Swamperella',       dateTime: d('06-19','19:15'), venue: V.yorkville },
  { artist: 'El Ceibo',          dateTime: d('06-19','19:45'), venue: V.rock },
  // June 20
  { artist: 'Dieufaite Charles', dateTime: d('06-20','17:00'), venue: V.bloor157 },
  { artist: 'Hassan el Hadi',    dateTime: d('06-20','17:00'), venue: V.bloor55 },
  { artist: 'Nii Osabu',        dateTime: d('06-20','17:45'), venue: V.rock },
  { artist: 'Dieufaite Charles', dateTime: d('06-20','18:30'), venue: V.hazelton },
  { artist: 'Hassan el Hadi',    dateTime: d('06-20','18:30'), venue: V.yorkville },
  { artist: 'Nii Osabu',        dateTime: d('06-20','19:30'), venue: V.rock },
  // June 21
  { artist: 'Mir Kashif Iqbal',  dateTime: d('06-21','17:00'), venue: V.bloor157 },
  { artist: 'Eunice Keitan',     dateTime: d('06-21','17:00'), venue: V.bloor55 },
  { artist: 'KOPI Trio',         dateTime: d('06-21','17:45'), venue: V.rock },
  { artist: 'Mir Kashif Iqbal',  dateTime: d('06-21','18:30'), venue: V.hazelton },
  { artist: 'Eunice Keitan',     dateTime: d('06-21','18:30'), venue: V.yorkville },
  { artist: 'KOPI Trio',         dateTime: d('06-21','19:15'), venue: V.rock },
  { artist: 'KOPI Trio',         dateTime: d('06-21','20:30'), venue: V.rock },
  // June 22
  { artist: 'West End Riverboat Band', dateTime: d('06-22','17:45'), venue: V.bloor157 },
  { artist: 'Trio da Rua',        dateTime: d('06-22','17:45'), venue: V.bloor55 },
  { artist: 'FreePlay Duo',       dateTime: d('06-22','17:45'), venue: V.rock },
  { artist: 'West End Riverboat Band', dateTime: d('06-22','19:15'), venue: V.hazelton },
  { artist: 'Trio da Rua',        dateTime: d('06-22','19:15'), venue: V.yorkville },
  { artist: 'FreePlay Duo',       dateTime: d('06-22','19:45'), venue: V.rock },
  // June 23
  { artist: 'Rudy Ray',                 dateTime: d('06-23','17:45'), venue: V.rock },
  { artist: 'Trio da Rua',              dateTime: d('06-23','17:45'), venue: V.bloor157 },
  { artist: 'Stuart Brignell Organ Trio', dateTime: d('06-23','17:45'), venue: V.bloor55 },
  { artist: 'Trio da Rua',              dateTime: d('06-23','19:15'), venue: V.hazelton },
  { artist: 'Stuart Brignell Organ Trio', dateTime: d('06-23','19:15'), venue: V.yorkville },
  { artist: 'Rudy Ray',                 dateTime: d('06-23','19:45'), venue: V.rock },
  // June 24
  { artist: 'Medusa Quartet',           dateTime: d('06-24','17:45'), venue: V.bloor157 },
  { artist: 'Tangi Lion and Imi Oto',   dateTime: d('06-24','17:45'), venue: V.bloor55 },
  { artist: 'Medusa Quartet',           dateTime: d('06-24','19:15'), venue: V.hazelton },
  { artist: 'Tangi Lion and Imi Oto',   dateTime: d('06-24','19:15'), venue: V.yorkville },
  { artist: 'Ori Shalva',               dateTime: d('06-24','19:15'), venue: V.rock },
  { artist: 'Ori Shalva',               dateTime: d('06-24','20:30'), venue: V.rock },
  // June 25
  { artist: 'Gentle Weep',             dateTime: d('06-25','17:45'), venue: V.bloor157 },
  { artist: 'Gaucho Jazz Project',      dateTime: d('06-25','17:45'), venue: V.bloor55 },
  { artist: 'Natasha Roldán',          dateTime: d('06-25','18:00'), venue: V.rock },
  { artist: 'Natasha Roldán',          dateTime: d('06-25','19:15'), venue: V.rock },
  { artist: 'Gentle Weep',             dateTime: d('06-25','19:15'), venue: V.hazelton },
  { artist: 'Gaucho Jazz Project',      dateTime: d('06-25','19:15'), venue: V.yorkville },
  { artist: 'Natasha Roldán',          dateTime: d('06-25','20:30'), venue: V.rock },
  // June 26
  { artist: 'Stuart Brignell Organ Trio', dateTime: d('06-26','17:45'), venue: V.rock },
  { artist: 'Rudy Ray',                   dateTime: d('06-26','17:45'), venue: V.bloor157 },
  { artist: 'West End Riverboat Band',    dateTime: d('06-26','17:45'), venue: V.bloor55 },
  { artist: 'Rudy Ray',                   dateTime: d('06-26','19:15'), venue: V.hazelton },
  { artist: 'West End Riverboat Band',    dateTime: d('06-26','19:15'), venue: V.yorkville },
  { artist: 'Stuart Brignell Organ Trio', dateTime: d('06-26','19:45'), venue: V.rock },
  // June 27
  { artist: 'JD Crosstown',              dateTime: d('06-27','17:00'), venue: V.bloor157 },
  { artist: 'Lancelot Knight',            dateTime: d('06-27','17:00'), venue: V.bloor55 },
  { artist: 'Zamira Lacosta & Friends',   dateTime: d('06-27','17:45'), venue: V.rock },
  { artist: 'JD Crosstown',              dateTime: d('06-27','18:30'), venue: V.hazelton },
  { artist: 'Lancelot Knight',            dateTime: d('06-27','18:30'), venue: V.yorkville },
  { artist: 'Zamira Lacosta & Friends',   dateTime: d('06-27','19:45'), venue: V.rock },
  // June 28
  { artist: 'Joseph Funk',                       dateTime: d('06-28','17:00'), venue: V.bloor157 },
  { artist: 'Tak Arikushi Trio',                 dateTime: d('06-28','17:00'), venue: V.bloor55 },
  { artist: 'Toronto Klezmer Society All-Stars', dateTime: d('06-28','17:45'), venue: V.rock },
  { artist: 'Joseph Funk',                       dateTime: d('06-28','18:30'), venue: V.hazelton },
  { artist: 'Tak Arikushi Trio',                 dateTime: d('06-28','18:30'), venue: V.yorkville },
  { artist: 'Toronto Klezmer Society All-Stars', dateTime: d('06-28','19:45'), venue: V.rock },
];

async function main() {
  const ref = { _type: 'reference', _ref: FESTIVAL_ID };
  for (const p of performances) {
    const created = await sanity.create({
      _type: 'performance',
      artist: p.artist,
      festival: ref,
      genre: 'jazz',
      dateTime: p.dateTime,
      venue: p.venue,
      neighbourhood: 'Bloor-Yorkville',
      externalLink: 'https://torontojazz.com/sidewalk-sessions/',
      notes: 'TD Toronto Jazz Festival — Sidewalk Sessions. Free outdoor performance.',
    });
    console.log(`  ✓ ${p.dateTime.slice(5,10)}  ${p.artist}  @ ${p.venue.split(',')[0]}  (${created._id})`);
  }
  console.log(`\n✅ ${performances.length} Sidewalk Sessions performances created.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
