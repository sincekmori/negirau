/**
 * Debounced, race-safe remote search: the last-fired (not last-resolved)
 * query wins via abort, the pending timer and in-flight request die on
 * unmount, and identical queries are answered from a small cache.
 */

import { useEffect, useRef, useState } from "react";

interface Options {
	minLength: number;
	debounceMs: number;
}

export function useDebouncedSearch<T>(
	run: (query: string, signal: AbortSignal) => Promise<T>,
	{ minLength, debounceMs }: Options,
) {
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const inFlight = useRef<AbortController | undefined>(undefined);
	const cache = useRef(new Map<string, T>());
	const [hits, setHits] = useState<T | undefined>(undefined);
	const [failed, setFailed] = useState(false);

	useEffect(
		() => () => {
			clearTimeout(timer.current);
			inFlight.current?.abort();
		},
		[],
	);

	async function search(query: string): Promise<void> {
		inFlight.current?.abort();
		inFlight.current = new AbortController();
		setFailed(false);
		try {
			const result = await run(query, inFlight.current.signal);
			cache.current.set(query, result);
			setHits(result);
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return; // superseded; the newer query paints
			}
			setFailed(true);
		}
	}

	function onQueryChange(value: string): void {
		clearTimeout(timer.current);
		const query = value.trim();
		if (query.length < minLength) {
			reset();
			return;
		}
		const cached = cache.current.get(query);
		if (cached !== undefined) {
			setHits(cached);
			return;
		}
		timer.current = setTimeout(() => void search(query), debounceMs);
	}

	function reset(): void {
		clearTimeout(timer.current);
		inFlight.current?.abort();
		setHits(undefined);
		setFailed(false);
	}

	return { hits, failed, onQueryChange, reset };
}
