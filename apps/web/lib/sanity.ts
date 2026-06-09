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

export const eventsQuery = `*[_type == "performance" && dateTime >= now()] | order(dateTime asc) {
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
