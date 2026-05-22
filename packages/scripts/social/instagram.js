import { IG_USER_ID, IG_ACCESS_TOKEN } from '../../lib/config.js';
import { graphPost } from './meta.js';

const GRAPH = 'https://graph.facebook.com/v19.0';

async function waitForContainer(containerId) {
  for (let i = 0; i < 10; i++) {
    const url = new URL(`${GRAPH}/${containerId}`);
    url.searchParams.set('fields', 'status_code');
    url.searchParams.set('access_token', IG_ACCESS_TOKEN);
    const res  = await fetch(url.toString());
    const json = await res.json();
    if (json.status_code === 'FINISHED') return;
    if (json.status_code === 'ERROR') throw new Error(`Instagram container failed: ${JSON.stringify(json)}`);
    console.log(`  → Instagram: container status ${json.status_code}, waiting…`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Instagram container timed out');
}

export async function postToInstagram(imageUrl, caption) {
  console.log('  → Instagram: creating media container…');
  const container = await graphPost(`/${IG_USER_ID}/media`, {
    image_url:    imageUrl,
    caption,
    access_token: IG_ACCESS_TOKEN,
  });

  await waitForContainer(container.id);

  console.log('  → Instagram: publishing…');
  const published = await graphPost(`/${IG_USER_ID}/media_publish`, {
    creation_id:  container.id,
    access_token: IG_ACCESS_TOKEN,
  });

  console.log(`  ✓ Instagram post published (id: ${published.id})`);
  return published.id;
}
