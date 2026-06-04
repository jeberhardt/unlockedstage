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

export async function postAlbumToFacebook(imageUrls, caption) {
  // Upload each image as an unpublished photo to get its ID
  const photoIds = [];
  for (const [i, url] of imageUrls.entries()) {
    console.log(`  → Facebook: uploading photo ${i + 1}/${imageUrls.length}…`);
    const photo = await graphPost(`/${FB_PAGE_ID}/photos`, {
      url,
      published:    'false',
      access_token: FB_ACCESS_TOKEN,
    });
    photoIds.push(photo.id);
  }

  // Create a single feed post with all photos attached
  console.log('  → Facebook: posting multi-photo feed post…');
  const attachedMedia = JSON.stringify(photoIds.map(id => ({ media_fbid: id })));
  const post = await graphPost(`/${FB_PAGE_ID}/feed`, {
    message:        caption,
    attached_media: attachedMedia,
    access_token:   FB_ACCESS_TOKEN,
  });

  console.log(`  ✓ Facebook album post published (post_id: ${post.id})`);
  return post.id;
}
