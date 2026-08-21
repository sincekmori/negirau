// GPS nearby search: the precise position never leaves the device.
// The API is queried from the CENTER OF THE GEOHASH CELL (precision 5, ≈5 km)
// the user is in — a quantized point, comparable to IP-level coarseness — and
// true distances are then computed in the browser from the real position.
import { LocateFixed } from "lucide-react";
import { useState } from "react";

import { nearbySubjects } from "~/lib/client/api";
import { currentPosition } from "~/lib/client/geolocation";
import { ActionButton } from "~/lib/components/ActionButton";
import { haversineMeters } from "~/lib/geo";
import { encodeGeohash, geohashBounds } from "~/lib/geohash";
import { messages } from "~/lib/i18n";
import type { Locale } from "~/lib/i18n";

interface NearbyHit {
	id: string;
	name: string;
	distanceM: number;
}

const MAX_HITS = 10;
/** Covers the target 3 km plus the ≤2.5 km quantization offset with margin. */
const SEARCH_RADIUS_M = 8000;

function formatDistance(meters: number): string {
	return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

export function NearbyFinder({ locale }: { locale: Locale }) {
	const m = messages(locale);
	const [hits, setHits] = useState<NearbyHit[] | undefined>(undefined);
	const [message, setMessage] = useState<string | undefined>(undefined);
	const [searching, setSearching] = useState(false);

	async function locate(): Promise<void> {
		if (!navigator.geolocation) {
			setMessage(m.nearbyNoGeolocation);
			return;
		}
		setSearching(true);
		setMessage(undefined);
		try {
			const position = await currentPosition();
			const { latitude, longitude } = position.coords;
			const cell = geohashBounds(encodeGeohash(latitude, longitude));
			const centerLat = (cell.minLat + cell.maxLat) / 2;
			const centerLng = (cell.minLng + cell.maxLng) / 2;
			let subjects: Awaited<ReturnType<typeof nearbySubjects>>;
			try {
				subjects = await nearbySubjects({
					lat: centerLat,
					lng: centerLng,
					radius: SEARCH_RADIUS_M,
					limit: 100,
				});
			} catch {
				setMessage(m.nearbyDataUnavailable);
				return;
			}
			setHits(
				subjects
					.map((subject) => ({
						id: subject.id,
						name: subject.name,
						distanceM: Math.round(haversineMeters(latitude, longitude, subject.lat, subject.lng)),
					}))
					.toSorted((a, b) => a.distanceM - b.distanceM)
					.slice(0, MAX_HITS),
			);
		} catch {
			setMessage(m.nearbyPositionFailed);
		} finally {
			setSearching(false);
		}
	}

	return (
		<section>
			<h2>{m.nearbyHeading}</h2>
			<p className="text-ink-soft mb-4 text-[0.8rem]">{m.nearbyPrivacyNote}</p>
			<ActionButton
				icon={LocateFixed}
				onClick={() => void locate()}
				disabled={searching}
				variant="outline"
				className="border-brand text-brand-deep hover:bg-brand-wash ms-auto flex"
			>
				{searching ? m.nearbySearching : m.nearbyButton}
			</ActionButton>
			{message !== undefined && <p className="mt-3">{message}</p>}
			{hits !== undefined &&
				(hits.length === 0 ? (
					<p className="mt-3">{m.nearbyNoHits}</p>
				) : (
					<ul className="mt-4">
						{hits.map((hit) => (
							<li key={hit.id} className="border-hairline flex justify-between border-b py-1.5">
								<a href={`/${locale}/subjects/${hit.id}`}>{hit.name}</a>
								<span className="text-ink-soft text-[0.85rem]">
									{formatDistance(hit.distanceM)}
								</span>
							</li>
						))}
					</ul>
				))}
		</section>
	);
}
