// The subject's location, shown as a map from the start — no "view on a
// map" indirection. Read-only: a marker on the spot, standard pan/zoom.
import { useEffect, useRef } from "react";

import { bootMap, MAP_FRAME_CLASS } from "~/lib/client/maplibre-boot";
import { useWhenVisible } from "~/lib/client/use-when-visible";

export function SubjectMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
	const host = useRef<HTMLElement>(null);
	const visible = useWhenVisible(host);

	useEffect(() => {
		if (!host.current || !visible) {
			return;
		}
		const element = host.current;
		const lifetime = new AbortController();
		void (async () => {
			const booted = await bootMap(element, {
				zoom: 14,
				isDisposed: () => lifetime.signal.aborted,
			});
			if (!booted) {
				return;
			}
			booted.map.setCenter([lng, lat]);
			new booted.maplibre.Marker().setLngLat([lng, lat]).addTo(booted.map);
			const observer = new ResizeObserver(() => booted.map.resize());
			observer.observe(element);
			lifetime.signal.addEventListener(
				"abort",
				() => {
					observer.disconnect();
					booted.map.remove();
				},
				{ once: true },
			);
		})();
		return () => lifetime.abort();
		// `visible` flips once and starts the boot; a coordinate change (client
		// navigation to another subject) disposes and boots the new spot.
	}, [lat, lng, visible]);

	return <section className={`${MAP_FRAME_CLASS} mbs-4`} aria-label={label} ref={host} />;
}
