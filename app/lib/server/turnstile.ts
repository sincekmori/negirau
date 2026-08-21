/**
 * Turnstile server-side verification, the first abuse-defense layer.
 * Tokens are single-use and domain-bound; siteverify is the authority.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(
	secretKey: string,
	token: string,
	remoteIp: string | undefined,
): Promise<boolean> {
	const body = new FormData();
	body.append("secret", secretKey);
	body.append("response", token);
	if (remoteIp !== undefined) {
		body.append("remoteip", remoteIp);
	}
	try {
		const response = await fetch(SITEVERIFY_URL, { method: "POST", body });
		if (!response.ok) {
			return false;
		}
		const result = (await response.json()) as { success: boolean };
		return result.success;
	} catch {
		// siteverify unreachable: fail closed — a lost genuine reaction is a rounding error,
		// an open gate during an outage is not.
		return false;
	}
}
