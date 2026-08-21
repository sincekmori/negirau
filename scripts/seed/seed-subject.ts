/**
 * The canonical seed subject (see dev-seed.sql beside this file) as data, so
 * e2e specs and the a11y audit reference one identity instead of restating it.
 */
export const SEED_SUBJECT = {
	id: "d987e945-2d23-4e33-a725-76fc11a7c0c2",
	name: "東京駅",
	lat: 35.68115,
	lng: 139.76448,
} as const;
