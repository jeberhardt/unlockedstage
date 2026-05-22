const GRAPH = 'https://graph.facebook.com/v19.0';

export async function graphPost(path, params) {
  const url  = new URL(`${GRAPH}${path}`);
  const body = new URLSearchParams(params);
  const res  = await fetch(url.toString(), { method: 'POST', body });
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error on ${path}: ${JSON.stringify(json.error)}`);
  return json;
}
