/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Transport core shared by the resources: query
 * building, retries with exponential backoff, and error translation.
 */

import {
	APIConnectionError,
	APITimeoutError,
	INTERNAL_ERROR_FLOOR,
	makeStatusError,
} from "./error.js";

export const DEFAULT_BASE_URL = "https://api.negirau.com/v1";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RETRIES = 2;

// Retryable statuses: timeouts, conflicts, throttles, 5xx.
const RETRYABLE_STATUS = new Set([408, 409, 429]);

function shouldRetry(status: number): boolean {
	return RETRYABLE_STATUS.has(status) || status >= INTERNAL_ERROR_FLOOR;
}

function backoffMs(attempt: number): number {
	return Math.min(500 * 2 ** attempt, 8000);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function queryString(params: Record<string, string | number | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined) {
			search.set(key, String(value));
		}
	}
	const encoded = search.toString();
	return encoded === "" ? "" : `?${encoded}`;
}

export interface TransportOptions {
	baseURL: string;
	timeoutMs: number;
	maxRetries: number;
	fetch: typeof fetch;
}

/** One GET attempt; undefined means "retryable failure, back off and go again". */
async function attempt(
	transport: TransportOptions,
	url: string,
	last: boolean,
): Promise<Response | undefined> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), transport.timeoutMs);
	try {
		return await transport.fetch(url, {
			headers: { accept: "application/json" },
			signal: controller.signal,
		});
	} catch (cause) {
		if (!last) {
			return undefined;
		}
		if (controller.signal.aborted) {
			throw new APITimeoutError({ cause });
		}
		throw new APIConnectionError(undefined, { cause });
	} finally {
		clearTimeout(timer);
	}
}

/** GET a spec-relative path with retries; resolves to the parsed JSON body. */
export async function get<T>(
	transport: TransportOptions,
	path: string,
	params: Record<string, string | number | undefined> = {},
): Promise<T> {
	const url = `${transport.baseURL}${path}${queryString(params)}`;
	for (let tries = 0; tries <= transport.maxRetries; tries += 1) {
		const last = tries === transport.maxRetries;
		const response = await attempt(transport, url, last);
		if (response) {
			if (response.ok) {
				return (await response.json()) as T;
			}
			if (last || !shouldRetry(response.status)) {
				throw await makeStatusError(response);
			}
			// Unconsumed bodies pin the keep-alive socket under undici until GC.
			await response.body?.cancel();
		}
		await sleep(backoffMs(tries));
	}
	/* v8 ignore next 2 -- the loop always returns or throws */
	throw new Error("unreachable");
}
