/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Hand-written, dependency-free client for the Negirau public API
 * (read-only, anonymous): resource namespaces, a typed error hierarchy,
 * and retries with exponential backoff.
 *
 * Conformance with the API's openapi.json is enforced by the contract tests in
 * tests/contract.test.ts — drift fails CI, the same guarantee code generation
 * gave, without generated code.
 */

import {
	DEFAULT_BASE_URL,
	DEFAULT_MAX_RETRIES,
	DEFAULT_TIMEOUT_MS,
	type TransportOptions,
} from "./core.js";
import { Subjects } from "./resources/subjects.js";

export {
	APIConnectionError,
	APIStatusError,
	APITimeoutError,
	BadRequestError,
	InternalServerError,
	NegirauError,
	NotFoundError,
	RateLimitError,
} from "./error.js";
export { Reactions, Subjects } from "./resources/index.js";
export type {
	DisplayValue,
	NearbySubject,
	ReactionsSummary,
	Subject,
	SubjectListParams,
	SubjectPage,
} from "./types.js";

export interface NegirauOptions {
	/** Defaults to the production base, https://api.negirau.com/v1. */
	baseURL?: string;
	/** Per-request timeout in milliseconds (default 10 000). */
	timeout?: number;
	/** Retries for 408/409/429/5xx and network failures (default 2). */
	maxRetries?: number;
	/** Custom fetch implementation (tests, polyfills). */
	fetch?: typeof fetch;
}

/**
 * Entry point:
 *
 * ```ts
 * import { Negirau } from "negirau";
 * const client = new Negirau();
 * const page = await client.subjects.list({ q: "消防" });
 * ```
 */
export class Negirau {
	readonly subjects: Subjects;

	constructor(options: NegirauOptions = {}) {
		const transport: TransportOptions = {
			baseURL: options.baseURL ?? DEFAULT_BASE_URL,
			timeoutMs: options.timeout ?? DEFAULT_TIMEOUT_MS,
			maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
			// The arrow keeps the global fetch on its expected receiver in browsers.
			fetch: options.fetch ?? ((input, init) => fetch(input, init)),
		};
		this.subjects = new Subjects(transport);
	}
}
