/**
 * Per-secret memoization for derived WebCrypto keys.
 *
 * Every module that seals or signs something derives its key from the same
 * long-lived secret on every request, and the derivation is pure — so it is
 * done once per isolate and reused. Each caller keeps its own derive function:
 * the algorithm and the domain-separation prefix are what make two keys from
 * one secret unrelated, and that decision belongs with the thing being signed,
 * not here. Only the caching is shared.
 */

/**
 * Wraps `derive` so it runs once per distinct secret. The promise is cached,
 * not its result, so concurrent first callers share one derivation.
 */
export function perSecret(
	derive: (secret: string) => Promise<CryptoKey>,
): (secret: string) => Promise<CryptoKey> {
	let cached: { secret: string; key: Promise<CryptoKey> } | undefined;
	return (secret) => {
		if (cached?.secret !== secret) {
			cached = { secret, key: derive(secret) };
		}
		return cached.key;
	};
}
