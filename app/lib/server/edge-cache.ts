/**
 * The Workers edge cache, typed against the DOM fetch shapes the app uses
 * (the DOM lib's CacheStorage has no `default`; the runtime one does, and the
 * Request/Response shapes are structurally identical for our usage).
 * Every consumer keys entries with synthetic never-fetched URLs.
 */

interface EdgeCache {
	match: (key: Request) => Promise<Response | undefined>;
	put: (key: Request, response: Response) => Promise<void>;
}

export function edgeCache(): EdgeCache {
	return (caches as unknown as { default: EdgeCache }).default;
}

/** A 304 when the caller already holds this exact representation. */
function notModified(request: Request, response: Response): Response | undefined {
	const etag = response.headers.get("etag");
	if (etag === null || request.headers.get("if-none-match") !== etag) {
		return undefined;
	}
	return new Response(null, { status: 304, headers: response.headers });
}

/**
 * URL-keyed read-through cache for GET representations (badge, feed,
 * sitemaps, the public API): Workers responses are never edge-cached on
 * their own, so without this every hit is a full invocation plus its D1
 * reads. The produced response's own cache-control governs the TTL.
 *
 * Conditional GETs are answered here and only here. Producing the 304 deeper
 * down would starve this cache: a 304 is not `ok`, so the entry would never
 * be stored, and every revalidating client would keep paying full price.
 */
export async function edgeCachedByUrl(
	request: Request,
	ctx: ExecutionContext,
	produce: () => Promise<Response>,
): Promise<Response> {
	const cache = edgeCache();
	const key = new Request(request.url);
	const cached = await cache.match(key);
	if (cached) {
		return notModified(request, cached) ?? cached;
	}
	const response = await produce();
	// Cache first, then answer: the entry gets stored even when this caller
	// only needed a 304.
	if (response.ok) {
		ctx.waitUntil(cache.put(key, response.clone()));
	}
	return notModified(request, response) ?? response;
}
