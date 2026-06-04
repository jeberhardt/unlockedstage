// lib/sanity.js
// Thin wrapper around @sanity/client with helpers used by all three scripts.

import { createClient } from '@sanity/client';
import { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN } from './config.js';

export const sanity = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset:   SANITY_DATASET,
  token:     SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn:    false,
});

/**
 * Returns all active source documents from Sanity.
 * Schema: { _id, url, venue, neighbourhood, description, active }
 */
export async function fetchSources() {
  return sanity.fetch(`*[_type == "source" && active == true]{ _id, url, venue, neighbourhood, description }`);
}

/**
 * Saves a newly discovered source to Sanity and publishes it.
 */
export async function createAndPublishSource(source) {
  const doc = await sanity.create({ _type: 'source', active: true, ...source });
  return doc._id;
}

/**
 * Returns the set of externalLinks already in Sanity so we can skip duplicates.
 */
export async function fetchExistingLinks() {
  const docs = await sanity.fetch(`*[_type == "event" && defined(externalLink)]{ externalLink }`);
  return new Set(docs.map(d => d.externalLink));
}

/**
 * Returns published events that haven't been posted to social yet.
 * We track this with a `postedToSocial` boolean field — add it to your schema
 * if it doesn't exist, or swap this query for your own flag.
 */
export async function fetchUnpostedEvents() {
  return sanity.fetch(`
    *[_type == "event" && (postedToSocial != true)] | order(dateTime asc) {
      _id, title, artist, genre, dateTime, venue, neighbourhood, externalLink, notes
    }
  `);
}

export async function fetchNextUnpostedEvent() {
  const now = new Date().toISOString();
  return sanity.fetch(`
    *[_type == "event" && (postedToSocial != true) && dateTime >= $now] | order(dateTime asc) [0] {
      _id, title, artist, genre, dateTime, venue, neighbourhood, externalLink, notes
    }
  `, { now });
}

/**
 * Creates a draft event document and immediately publishes it.
 * Returns the published document id.
 */
export async function createAndPublishEvent(event) {
  const doc = await sanity.create({ _type: 'event', ...event });
  return doc._id;
}

/**
 * Marks an event as posted to social media.
 */
export async function markAsPosted(id) {
  await sanity.patch(id).set({ postedToSocial: true }).commit();
}

/**
 * Returns the next upcoming titled event (festival/named event) not yet posted
 * via the event-level social post. Deduplicates by title — returns one entry
 * per unique title, using the earliest occurrence.
 */
export async function fetchNextUnpostedNamedEvent() {
  const now = new Date().toISOString();
  const events = await sanity.fetch(`
    *[_type == "event" && defined(title) && eventPostedToSocial != true && dateTime >= $now]
    | order(dateTime asc) {
      _id, title, artist, genre, dateTime, venue, neighbourhood, externalLink, notes, instagramHandle, facebookHandle, schedule
    }
  `, { now });

  // Return the first event for the earliest unique title
  const seen = new Set();
  for (const e of events) {
    if (!seen.has(e.title)) { seen.add(e.title); return e; }
  }
  return null;
}

/**
 * Marks all events sharing the given title as eventPostedToSocial = true.
 */
export async function markEventAsPosted(title) {
  const ids = await sanity.fetch(
    `*[_type == "event" && title == $title]._id`,
    { title }
  );
  await Promise.all(ids.map(id =>
    sanity.patch(id).set({ eventPostedToSocial: true }).commit()
  ));
}
