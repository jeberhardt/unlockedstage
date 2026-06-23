import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '7txzz67e',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

const builder = imageUrlBuilder(client);

export function urlFor(source: { asset: { _ref: string } }) {
  return builder.image(source);
}

// GROQ compares datetime strings lexicographically, which breaks for values
// stored with a UTC offset (e.g. "T17:45:00-04:00" sorts before "T20:00:00Z"
// even though it's later in absolute time). We use today's UTC midnight as a
// rough lower bound (always safe for string comparison), then filter precisely
// in JS on the server in page.tsx using Date objects, which handle offsets correctly.
export const eventsQuery = `*[_type == "performance" && dateTime >= $startOfToday] | order(dateTime asc) {
  _id,
  artist,
  genre,
  dateTime,
  venue,
  neighbourhood,
  externalLink,
  notes,
  "image": coalesce(image, festival->image, series->image)
}`;

export const namedEventsQuery = `*[_type in ["festival","series"] && !(_id in path("drafts.**"))] | order(dateTime asc) {
  _id, _type, title, venue, neighbourhood, dateTime, schedule, externalLink, genre, notes
}`;

export const eventDetailQuery = `{
  "event": *[_id == $id && !(_id in path("drafts.**"))][0] {
    _id, _type, title, venue, neighbourhood, dateTime, schedule, externalLink, genre, notes, instagramHandle, facebookHandle
  },
  "performances": *[_type == "performance" && (festival._ref == $id || series._ref == $id) && !(_id in path("drafts.**"))] | order(dateTime asc) {
    _id, artist, dateTime, venue
  }
}`;
