/**
 * True once the element has (nearly) scrolled into view — the gate that keeps
 * heavy below-the-fold work (the 1.5 MB MapLibre boot) off page load for
 * visitors who never scroll down. 200px of root margin starts the work just
 * before arrival, so the map is usually ready when it enters the viewport.
 */

import { useEffect, useState } from "react";

export function useWhenVisible(ref: React.RefObject<Element | null>): boolean {
	const [visible, setVisible] = useState(false);
	useEffect(() => {
		const element = ref.current;
		if (!element || visible) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "200px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
		// The ref identity is stable, so in practice this runs until the first
		// intersection and never again.
	}, [ref, visible]);
	return visible;
}
