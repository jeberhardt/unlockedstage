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
      _id, artist, genre, dateTime, venue, neighbourhood, externalLink, notes
    }
  `);
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
