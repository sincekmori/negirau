// Location input for the creation form: nobody types raw coordinates.
// A place search (Nominatim), a tap on the map, or the device position all
// set the same pin; the chosen point rides the form as hidden lat/lng
// fields, and a picked place can also name the subject itself. The map
// boots when the section scrolls into view — a name-only creation above the
// fold never pays for tiles.
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { currentPosition } from "~/lib/client/geolocation";
import { MAP_FRAME_CLASS, bootMap } from "~/lib/client/maplibre-boot";
import type { MaplibreModule } from "~/lib/client/maplibre-boot";
import { useDebouncedSearch } from "~/lib/client/use-debounced-search";
import { useWhenVisible } from "~/lib/client/use-when-visible";
import { Button } from "~/lib/components/ui/button";
import { Input } from "~/lib/components/ui/input";
import { formatLatLng } from "~/lib/geo";
import { messages } from "~/lib/i18n";
import type { Locale } from "~/lib/i18n";

interface Point {
	lat: number;
	lng: number;
}

interface PlaceHit {
	/** The place's own short name (what a subject would be called). */
	name: string;
	/** The full disambiguating address line. */
	label: string;
	point: Point;
}

// Nominatim is a shared public service (1 req/s policy); debounce generously.
const DEBOUNCE_MS = 700;
const SEARCH_LIMIT = 5;

/** Reverse geocode a tapped point; undefined when OSM knows no name there. */
async function placeNameAt(point: Point, locale: Locale): Promise<string | undefined> {
	try {
		const response = await fetch(
			`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=${locale}&lat=${point.lat}&lon=${point.lng}`,
		);
		if (!response.ok) {
			return undefined;
		}
		const place = (await response.json()) as { name?: string };
		return place.name === "" ? undefined : place.name;
	} catch {
		return undefined;
	}
}

async function searchPlaces(
	query: string,
	locale: Locale,
	signal: AbortSignal,
): Promise<PlaceHit[]> {
	const response = await fetch(
		`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${SEARCH_LIMIT}&accept-language=${locale}&q=${encodeURIComponent(query)}`,
		{ signal },
	);
	if (!response.ok) {
		throw new Error(`nominatim ${response.status}`);
	}
	const places = (await response.json()) as {
		name?: string;
		display_name: string;
		lat: string;
		lon: string;
	}[];
	return places.map((place) => ({
		name: place.name ?? place.display_name.split(",")[0] ?? place.display_name,
		label: place.display_name,
		point: { lat: Number(place.lat), lng: Number(place.lon) },
	}));
}

function PlaceHits({
	hits,
	noHitsLabel,
	onPick,
}: {
	hits: PlaceHit[];
	noHitsLabel: string;
	onPick: (hit: PlaceHit) => void;
}) {
	if (hits.length === 0) {
		return <p className="text-ink-soft px-3 py-2 text-[0.85rem]">{noHitsLabel}</p>;
	}
	return (
		<ul>
			{hits.map((hit) => (
				<li key={hit.label} className="border-hairline border-b">
					<button
						type="button"
						className="hover:bg-brand-wash w-full px-3 py-1.5 text-start text-[0.9rem]"
						onClick={() => onPick(hit)}
					>
						{hit.label}
					</button>
				</li>
			))}
		</ul>
	);
}

function PointSummary({
	point,
	clearLabel,
	onClear,
}: {
	point: Point | undefined;
	clearLabel: string;
	onClear: () => void;
}) {
	if (point === undefined) {
		return null;
	}
	return (
		<>
			<span className="text-ink-soft">{formatLatLng(point.lat, point.lng)}</span>
			<Button
				type="button"
				variant="link"
				className="h-auto p-0 text-[0.85rem] underline"
				onClick={onClear}
			>
				{clearLabel}
			</Button>
		</>
	);
}

export function LocationPicker({
	locale,
	onPlacePicked,
}: {
	locale: Locale;
	/** Called with a picked place's short name (to offer it as the subject name). */
	onPlacePicked?: (name: string) => void;
}) {
	const m = messages(locale);
	const mapHost = useRef<HTMLElement>(null);
	const maplibre = useRef<MaplibreModule | undefined>(undefined);
	const map = useRef<MapLibreMap | undefined>(undefined);
	const marker = useRef<Marker | undefined>(undefined);
	// Boot the map once the location section nears the screen: visible
	// without a click, free for visitors who create a name-only page and
	// never scroll here (the map is megabytes of worker, style, and tiles).
	const mapWanted = useWhenVisible(mapHost);
	const [point, setPoint] = useState<Point | undefined>(undefined);
	const [notice, setNotice] = useState<string | undefined>(undefined);
	const search = useDebouncedSearch((query, signal) => searchPlaces(query, locale, signal), {
		minLength: 2,
		debounceMs: DEBOUNCE_MS,
	});

	function showPin(next: Point): void {
		if (!map.current || !maplibre.current) {
			return;
		}
		if (!marker.current) {
			marker.current = new maplibre.current.Marker({ draggable: true });
			// Dragging refines the point; subscribed once, where the marker is born.
			marker.current.on("dragend", () => {
				const at = marker.current?.getLngLat();
				if (at) {
					setPoint({ lat: at.lat, lng: at.lng });
				}
			});
		}
		marker.current.setLngLat([next.lng, next.lat]).addTo(map.current);
		map.current.flyTo({ center: [next.lng, next.lat], zoom: Math.max(map.current.getZoom(), 14) });
	}

	function placePin(next: Point): void {
		setPoint(next);
		search.reset();
		setNotice(undefined);
		showPin(next);
	}

	function pickPlace(hit: PlaceHit): void {
		placePin(hit.point);
		onPlacePicked?.(hit.name);
	}

	async function locateMe(): Promise<void> {
		try {
			const position = await currentPosition();
			placePin({ lat: position.coords.latitude, lng: position.coords.longitude });
		} catch {
			setNotice(m.nearbyPositionFailed);
		}
	}

	function clearPin(): void {
		setPoint(undefined);
		marker.current?.remove();
	}

	// Effect events, so the map boot (and its long-lived click handler) reads
	// the latest values without depending on them: making these reactive
	// would tear down and rebuild the map on every picked point.
	const pickTapped = useEffectEvent((tapped: Point) => {
		placePin(tapped);
		// A tapped facility names the page too, when OSM knows its name.
		void (async () => {
			const name = await placeNameAt(tapped, locale);
			if (name !== undefined) {
				onPlacePicked?.(name);
			}
		})();
	});
	// A point chosen before the map existed (search, device position)
	// appears as soon as there is a canvas to draw it on.
	const showChosenPin = useEffectEvent(() => {
		if (point) {
			showPin(point);
		}
	});

	useEffect(() => {
		if (!mapWanted || !mapHost.current || map.current) {
			return;
		}
		const host = mapHost.current;
		let disposed = false;
		let observer: ResizeObserver | undefined;
		void (async () => {
			const booted = await bootMap(host, { zoom: 9, isDisposed: () => disposed });
			if (!booted) {
				return;
			}
			maplibre.current = booted.maplibre;
			map.current = booted.map;
			booted.map.on("click", (event) => {
				pickTapped({ lat: event.lngLat.lat, lng: event.lngLat.lng });
			});
			// The map can boot before its stylesheet lays the container out;
			// track the real size instead of trusting the initial measure.
			observer = new ResizeObserver(() => booted.map.resize());
			observer.observe(host);
			showChosenPin();
		})();
		return () => {
			disposed = true;
			observer?.disconnect();
			map.current?.remove();
			map.current = undefined;
			marker.current = undefined;
		};
	}, [mapWanted]);

	return (
		<div className="flex flex-col gap-2">
			{/* The hit list overlays the map (portal-free absolute dropdown), so
			    results never reflow the content below — zero layout shift. */}
			<div className="relative">
				<Input
					type="search"
					placeholder={m.locationSearchPlaceholder}
					aria-label={m.locationSearchPlaceholder}
					onChange={(event) => search.onQueryChange(event.target.value)}
				/>
				{search.hits !== undefined && (
					<div className="border-hairline bg-paper absolute inset-x-0 top-full z-20 mt-1 rounded-md border shadow-md">
						<PlaceHits hits={search.hits} noHitsLabel={m.searchNoHits} onPick={pickPlace} />
					</div>
				)}
			</div>
			<section className={MAP_FRAME_CLASS} aria-label={m.locationMapLabel} ref={mapHost} />
			<div className="flex flex-wrap items-center gap-4 text-[0.85rem]">
				<Button
					type="button"
					variant="link"
					className="h-auto p-0 text-[0.85rem] underline"
					onClick={() => void locateMe()}
				>
					{m.locationUseCurrent}
				</Button>
				<PointSummary point={point} clearLabel={m.locationClear} onClear={clearPin} />
			</div>
			<p className="text-ink-soft text-[0.8rem]">{m.locationHint}</p>
			{(notice !== undefined || search.failed) && (
				<p className="text-ink-soft text-[0.85rem]">{notice ?? m.locationSearchFailed}</p>
			)}
			{/* The form reads the chosen point from these; empty means no location. */}
			<input type="hidden" name="lat" value={point?.lat ?? ""} />
			<input type="hidden" name="lng" value={point?.lng ?? ""} />
		</div>
	);
}
