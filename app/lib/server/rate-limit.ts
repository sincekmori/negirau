/**
 * IP throttling via the Workers Rate Limiting binding.
 *
 * The bindings are treated as optional: their free-plan availability is not
 * guaranteed, and the design explicitly allows running on the edge WAF rule
 * (layer 2) alone. Counters are Cloudflare-managed volatile state — no IP is
 * ever stored in our own database or logs.
 */

/** Collapse IPv6 to its /64 so one device can't hop through a whole prefix. */
export function rateLimitKeyForIp(ip: string): string {
	if (!ip.includes(":")) {
		return ip;
	}
	// Expand '::' enough to take the first four hextets.
	const [head = ""] = ip.split("%"); // strip any zone index
	const parts = head.split("::");
	const left = parts[0] === "" ? [] : (parts[0] ?? "").split(":");
	const right = parts.length > 1 && parts[1] !== "" ? (parts[1] ?? "").split(":") : [];
	const missing = 8 - left.length - right.length;
	const full = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
	return full.slice(0, 4).join(":");
}

/** True when the limiter is absent (layer not provisioned) or the key is under its limit. */
export async function underLimit(
	limiter: RateLimit | undefined,
	key: string | undefined,
): Promise<boolean> {
	if (!limiter || key === undefined) {
		return true;
	}
	const { success } = await limiter.limit({ key });
	return success;
}

/**
 * The cheap gates every anonymous write runs before anything expensive:
 * the kill switch, then the pure-IP throttle. Returns the refusal, or
 * undefined to proceed. The prefix keeps each flow's counter bucket apart.
 */
export async function refuseAnonymousWrite(
	env: Env,
	clientIp: string | undefined,
	prefix: string,
	disabledError: string,
): Promise<{ status: number; error: string } | undefined> {
	if (env.REACTIONS_ENABLED === "false") {
		return { status: 503, error: disabledError };
	}
	const ipKey = clientIp === undefined ? undefined : `${prefix}:${rateLimitKeyForIp(clientIp)}`;
	if (!(await underLimit(env.REACT_RATE_LIMIT_IP, ipKey))) {
		return { status: 429, error: "rate_limited" };
	}
	return undefined;
}
