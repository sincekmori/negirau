/** Poster size vocabulary; display labels live in the i18n catalog. */

export const POSTER_SIZES = ["a4", "a5", "postcard", "card", "pop"] as const;

export type PosterSize = (typeof POSTER_SIZES)[number];

/** Paper size per poster variant as [width, height] in millimetres. */
export const POSTER_PAGE_MM: Record<PosterSize, readonly [number, number]> = {
	a4: [210, 297],
	a5: [148, 210],
	postcard: [100, 148],
	card: [210, 297],
	pop: [210, 297],
};

/**
 * The same sizes as CSS lengths. Fed into a per-request `@page { size: … }`
 * rule: without it browsers print onto their default paper, which paginates
 * the exactly-page-sized sheets onto two pages and mislays the smaller ones.
 */
export const POSTER_PAGE_SIZE = Object.fromEntries(
	POSTER_SIZES.map((size) => {
		const [width, height] = POSTER_PAGE_MM[size];
		return [size, `${width}mm ${height}mm`];
	}),
) as Record<PosterSize, string>;

export function isPosterSize(value: string): value is PosterSize {
	return (POSTER_SIZES as readonly string[]).includes(value);
}
