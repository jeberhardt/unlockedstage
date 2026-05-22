import { FB_PAGE_ID, FB_ACCESS_TOKEN } from '../../lib/config.js';
import { graphPost } from './meta.js';

export async function postToFacebook(imageUrl, caption) {
  console.log('  → Facebook: uploading photo…');
  const photo = await graphPost(`/${FB_PAGE_ID}/photos`, {
    url:          imageUrl,
    caption,
    access_token: FB_ACCESS_TOKEN,
  });

  console.log(`  ✓ Facebook post published (post_id: ${photo.post_id})`);
  return photo.post_id;
}

export async function postTextToFacebook(caption) {
  console.log('  → Facebook: posting to feed…');
  const post = await graphPost(`/${FB_PAGE_ID}/feed`, {
    message:      caption,
    access_token: FB_ACCESS_TOKEN,
  });
  console.log(`  ✓ Facebook post published (post_id: ${post.id})`);
  return post.id;
}
