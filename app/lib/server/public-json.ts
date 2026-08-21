/**
 * Response helper for the public read-only API: JSON with an ETag so
 * the CDN and clients can revalidate cheaply, plus shared cache lifetimes.
 * Answering the conditional GET is edgeCachedByUrl's job — every caller is
 * wrapped in it, and a 304 minted here would keep the cache from filling.
 */

const DEFAULT_MAX_AGE_S = 300;

export async function publicJson(
	data: unknown,
	maxAgeSeconds = DEFAULT_MAX_AGE_S,
): Promise<Response> {
	const body = JSON.stringify(data);
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
	const etag = `"${[...new Uint8Array(digest.slice(0, 16))].map((b) => b.toString(16).padStart(2, "0")).join("")}"`;
	const headers = {
		"content-type": "application/json; charset=utf-8",
		"cache-control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`,
		etag,
	};
	return new Response(body, { headers });
}
