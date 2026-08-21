/**
 * The one mailto builder. Every mail the site initiates carries a
 * "[Negirau]" subject prefix so the operator's shared inbox can filter on
 * it — the address serves many purposes beyond this site.
 */
export function contactMailto(email: string, topic: string): string {
	return `mailto:${email}?subject=${encodeURIComponent(`[Negirau] ${topic}`)}`;
}
