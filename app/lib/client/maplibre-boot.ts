/**
 * The one place a map comes to life. Both maps (subject map, location picker)
 * boot through here so the fragile parts have a single home:
 * - v6 loads its worker from a separate file whose URL bundlers cannot
 *   rewrite; without setWorkerUrl the production build 404s on it.
 * - OpenFreeMap public instance: key-free; swap this URL to self-hosted
 *   PMTiles on R2 if it ever goes away.
 */

import type { Map as MapLibreMap } from "maplibre-gl";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";

/**
 * The shared map frame: near-square (a map wants area, not a letterbox), but
 * width AND height are capped against the viewport height so the page around
 * the map always stays visible — in the 60-75svh band the square deliberately
 * relaxes to at most 75:60. One home so the two maps cannot drift apart.
 */
export const MAP_FRAME_CLASS =
	"border-hairline mx-auto aspect-square max-h-[60svh] w-full max-w-[75svh] overflow-hidden rounded-xl border";

/** Tokyo, wide enough to orient without a position. */
const DEFAULT_CENTER: [number, number] = [139.69, 35.68];

/** The dynamically imported maplibre-gl module (never in the server bundle). */
export type MaplibreModule = Awaited<ReturnType<typeof importMaplibre>>;

function importMaplibre() {
	return import("maplibre-gl");
}

export async function bootMap(
	host: HTMLElement,
	options: { zoom: number; isDisposed?: () => boolean },
): Promise<{ maplibre: MaplibreModule; map: MapLibreMap } | undefined> {
	// Statically eliminable: keeps maplibre-gl (~286 KB gzip) out of the Worker bundle.
	if (import.meta.env.SSR) {
		return undefined;
	}
	const maplibre = await importMaplibre();
	const worker = await import("~/lib/client/maplibre-worker-url.client");
	maplibre.setWorkerUrl(worker.workerUrl);
	await import("maplibre-gl/dist/maplibre-gl.css");
	if (options.isDisposed?.()) {
		return undefined;
	}
	const map = new maplibre.Map({
		container: host,
		style: MAP_STYLE_URL,
		center: DEFAULT_CENTER,
		zoom: options.zoom,
		attributionControl: { compact: true },
	});
	return { maplibre, map };
}
