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
		let disposed = false;
		let observer: ResizeObserver | undefined;
		let remove: (() => void) | undefined;
		void (async () => {
			const booted = await bootMap(element, { zoom: 14, isDisposed: () => disposed });
			if (!booted) {
				return;
			}
			booted.map.setCenter([lng, lat]);
			new booted.maplibre.Marker().setLngLat([lng, lat]).addTo(booted.map);
			observer = new ResizeObserver(() => booted.map.resize());
			observer.observe(element);
			remove = () => booted.map.remove();
		})();
		return () => {
			disposed = true;
			observer?.disconnect();
			remove?.();
		};
		// `visible` flips once and starts the boot; a coordinate change (client
		// navigation to another subject) disposes and boots the new spot.
	}, [lat, lng, visible]);

	return <section className={`${MAP_FRAME_CLASS} mt-4`} aria-label={label} ref={host} />;
}
