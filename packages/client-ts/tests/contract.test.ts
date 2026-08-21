/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Spec-conformance contract tests (the replacement for code generation).
 *
 * The canonical, build-time-generated openapi.json is loaded from the monorepo
 * and the hand-written client is proven against it: every spec operation is
 * covered, requests only target spec paths with spec-declared parameters, and
 * sample payloads — first validated against the spec's response schemas —
 * satisfy the exported types (the `satisfies` clauses make the compiler close
 * that loop).
 */

import { readFileSync } from "node:fs";

import { Ajv2020 } from "ajv/dist/2020.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_BASE_URL } from "../src/core.js";
import {
	APIConnectionError,
	APIStatusError,
	APITimeoutError,
	BadRequestError,
	InternalServerError,
	Negirau,
	NotFoundError,
	RateLimitError,
} from "../src/index.js";
import type {
	NearbySubject,
	NegirauOptions,
	ReactionsSummary,
	Subject,
	SubjectPage,
} from "../src/index.js";

interface ParameterObject {
	name: string;
	in: "query" | "path";
}

interface OperationObject {
	parameters?: ParameterObject[];
	responses: Record<string, { content: Record<string, { schema: object }> }>;
}

interface OpenApiDocument {
	servers: { url: string }[];
	paths: Record<string, { get: OperationObject }>;
}

const SPEC = JSON.parse(
	readFileSync(new URL("../../../public/v1/openapi.json", import.meta.url), "utf8"),
) as OpenApiDocument;

const ajv = new Ajv2020();

const SUBJECT_ID = "0e6f9b3a-6b1e-4b8a-9a6a-1c2d3e4f5a6b";

const SUBJECT_SAMPLE = {
	id: SUBJECT_ID,
	name: "世田谷消防署",
	lat: 35.6466,
	lng: 139.6532,
} satisfies Subject;

// A subject is "a name, optionally with a location" — the location-less
// variant is first-class, so the parsing path must be pinned too.
const NAME_ONLY_SAMPLE = {
	id: "6f1d2c3b-4a59-4e6f-8a7b-9c0d1e2f3a4b",
	name: "山田 太郎",
	lat: null,
	lng: null,
} satisfies Subject;

// One entry per spec operation: sample 200 payload (validated against the spec
// schema before the client must parse it) and the client calls that consume it.
const OPERATIONS: Record<
	string,
	{ payload: unknown; calls: ((client: Negirau) => Promise<unknown>)[] }
> = {
	"/subjects": {
		payload: {
			subjects: [SUBJECT_SAMPLE, NAME_ONLY_SAMPLE],
			next_cursor: null,
		} satisfies SubjectPage,
		calls: [
			(c) => c.subjects.list({ q: "消防署", limit: 5 }),
			(c) => c.subjects.list({ cursor: "abc" }),
		],
	},
	"/subjects/{id}": {
		payload: SUBJECT_SAMPLE,
		calls: [(c) => c.subjects.retrieve(SUBJECT_ID)],
	},
	"/subjects/{id}/reactions": {
		payload: {
			id: SUBJECT_ID,
			period: "2026-W33",
			total: "100+",
			by_type: { heart: "80", like: "40" },
		} satisfies ReactionsSummary,
		calls: [(c) => c.subjects.reactions.retrieve(SUBJECT_ID, { period: "2026-W33" })],
	},
};

// The near variant answers on /subjects with a different response shape.
const NEAR_PAYLOAD = {
	subjects: [{ ...SUBJECT_SAMPLE, distance_m: 1808 }],
} satisfies { subjects: NearbySubject[] };

function responseSchema(template: string): object {
	const operation = SPEC.paths[template];
	if (!operation) {
		throw new Error(`unknown template: ${template}`);
	}
	const content = operation.get.responses["200"]?.content["application/json"];
	if (!content) {
		throw new Error(`no 200 schema for ${template}`);
	}
	return content.schema;
}

function declaredQueryParams(template: string): Set<string> {
	const parameters = SPEC.paths[template]?.get.parameters ?? [];
	return new Set(parameters.filter((p) => p.in === "query").map((p) => p.name));
}

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}

/** The one client constructor for every test; overrides vary retries/timeout. */
function clientFor(fetchImpl: typeof fetch, overrides: Partial<NegirauOptions> = {}): Negirau {
	return new Negirau({
		baseURL: "https://negirau.test",
		maxRetries: 0,
		fetch: fetchImpl,
		...overrides,
	});
}

async function capture(
	call: (client: Negirau) => Promise<unknown>,
	payload: unknown,
): Promise<URL> {
	let captured: URL | undefined;
	const client = clientFor((input) => {
		captured = new URL(String(input));
		return Promise.resolve(jsonResponse(payload));
	});
	await call(client);
	if (!captured) {
		throw new Error("client sent no request");
	}
	return captured;
}

/** Resolve a concrete request path to the spec template it instantiates ({id} is one segment). */
function matchingTemplate(path: string): string | undefined {
	return Object.keys(SPEC.paths).find((template) => {
		const pattern = template.replaceAll(/\{[^}]+\}/g, "[^/]+");
		return new RegExp(`^${pattern}$`).test(path);
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("contract with openapi.json", () => {
	it("declares reaction totals as display-value strings, never numbers", () => {
		const totalSchema = (
			responseSchema("/subjects/{id}/reactions") as {
				properties: { total: { type: string } };
			}
		).properties.total;
		expect(totalSchema.type).toBe("string");
	});

	it("covers every spec operation", () => {
		expect(Object.keys(SPEC.paths).sort()).toEqual(Object.keys(OPERATIONS).sort());
	});

	it("defaults to the spec's server URL", () => {
		expect(DEFAULT_BASE_URL).toBe(SPEC.servers[0]?.url);
	});

	for (const [template, entry] of Object.entries(OPERATIONS)) {
		// The payload is spec-validated once; each call is captured once and
		// checked for both path-template and declared-parameter conformance
		// (the payload's fit with the exported types is proven by `satisfies`).
		it(`${template}: spec-valid payload, spec path, declared parameters`, async () => {
			expect(ajv.validate(responseSchema(template), entry.payload), ajv.errorsText()).toBe(true);
			for (const call of entry.calls) {
				const url = await capture(call, entry.payload);
				expect(matchingTemplate(url.pathname)).toBe(template);
				const declared = declaredQueryParams(template);
				for (const name of new Set(url.searchParams.keys())) {
					expect(declared, `undeclared query parameter: ${name}`).toContain(name);
				}
			}
		});
	}

	it("near search stays on /subjects with declared parameters and parses", async () => {
		expect(ajv.validate(responseSchema("/subjects"), NEAR_PAYLOAD), ajv.errorsText()).toBe(true);
		const url = await capture(
			(c) => c.subjects.listNear(35.6, 139.65, { radius: 3000, limit: 5 }),
			NEAR_PAYLOAD,
		);
		expect(matchingTemplate(url.pathname)).toBe("/subjects");
		const declared = declaredQueryParams("/subjects");
		for (const name of new Set(url.searchParams.keys())) {
			expect(declared).toContain(name);
		}
	});
});

describe("errors and retries", () => {
	it.each([
		[400, BadRequestError],
		[404, NotFoundError],
		[502, InternalServerError],
		// Unmapped statuses fall back to the base class, not a subclass.
		[418, APIStatusError],
	])("maps status %i to its error class", async (status, errorClass) => {
		const client = clientFor(() => Promise.resolve(jsonResponse({ error: "some_code" }, status)));
		const error: unknown = await client.subjects.retrieve("nope").then(
			() => null,
			(thrown: unknown) => thrown,
		);
		expect((error as APIStatusError).constructor).toBe(errorClass);
		expect(error).toMatchObject({ statusCode: status, code: "some_code" });
	});

	it("falls back to 'unknown' when the error body has no error field or is not JSON", async () => {
		const missingField = clientFor(() => Promise.resolve(jsonResponse({ detail: "boom" }, 400)));
		await expect(missingField.subjects.retrieve("x")).rejects.toMatchObject({ code: "unknown" });
		const notJson = clientFor(() => Promise.resolve(new Response("Bad Gateway", { status: 502 })));
		await expect(notJson.subjects.retrieve("x")).rejects.toMatchObject({ code: "unknown" });
	});

	it("retries retryable statuses until success", async () => {
		vi.useFakeTimers();
		let attempts = 0;
		const client = clientFor(
			() => {
				attempts += 1;
				return Promise.resolve(
					attempts < 3
						? jsonResponse({ error: "rate_limited" }, 429)
						: jsonResponse(SUBJECT_SAMPLE),
				);
			},
			{ maxRetries: 2 },
		);
		const promise = client.subjects.retrieve(SUBJECT_ID);
		await vi.runAllTimersAsync();
		const subject = await promise;
		expect(subject.id).toBe(SUBJECT_SAMPLE.id);
		expect(attempts).toBe(3);
	});

	it("retries 5xx responses too", async () => {
		vi.useFakeTimers();
		let attempts = 0;
		const client = clientFor(
			() => {
				attempts += 1;
				return Promise.resolve(
					// A body-less 503 covers the null branch of the retry-path drain.
					attempts < 2 ? new Response(null, { status: 503 }) : jsonResponse(SUBJECT_SAMPLE),
				);
			},
			{ maxRetries: 1 },
		);
		const promise = client.subjects.retrieve(SUBJECT_ID);
		await vi.runAllTimersAsync();
		expect((await promise).id).toBe(SUBJECT_SAMPLE.id);
		expect(attempts).toBe(2);
	});

	it("raises the status error once retries are exhausted", async () => {
		vi.useFakeTimers();
		let attempts = 0;
		const client = clientFor(
			() => {
				attempts += 1;
				return Promise.resolve(jsonResponse({ error: "rate_limited" }, 429));
			},
			{ maxRetries: 1 },
		);
		const promise = client.subjects.retrieve("x");
		const assertion = expect(promise).rejects.toBeInstanceOf(RateLimitError);
		await vi.runAllTimersAsync();
		await assertion;
		expect(attempts).toBe(2);
	});

	it("turns an aborted request into APITimeoutError", async () => {
		vi.useFakeTimers();
		const client = clientFor(
			(_input, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new DOMException("aborted", "AbortError"));
					});
				}),
			{ timeout: 50 },
		);
		const promise = client.subjects.retrieve("x");
		const assertion = expect(promise).rejects.toBeInstanceOf(APITimeoutError);
		await vi.runAllTimersAsync();
		await assertion;
	});

	it("turns network failures into APIConnectionError (after retrying)", async () => {
		vi.useFakeTimers();
		let attempts = 0;
		const client = clientFor(
			() => {
				attempts += 1;
				return Promise.reject(new TypeError("fetch failed"));
			},
			{ maxRetries: 1 },
		);
		const promise = client.subjects.retrieve("x");
		const assertion = expect(promise).rejects.toBeInstanceOf(APIConnectionError);
		await vi.runAllTimersAsync();
		await assertion;
		expect(attempts).toBe(2);
	});
});

describe("client construction and edge branches", () => {
	it("uses the production base URL and the global fetch when unconfigured", async () => {
		const stub = vi.fn((_input: RequestInfo | URL) =>
			Promise.resolve(jsonResponse({ subjects: [], next_cursor: null })),
		);
		vi.stubGlobal("fetch", stub);
		const client = new Negirau();
		await client.subjects.list();
		const url = new URL(String(stub.mock.calls[0]?.[0]));
		expect(`${url.origin}${url.pathname}`).toBe("https://api.negirau.com/v1/subjects");
		expect(url.search).toBe("");
	});

	it("retrieves reactions without a period parameter", async () => {
		const url = await capture(
			(c) => c.subjects.reactions.retrieve(SUBJECT_ID),
			OPERATIONS["/subjects/{id}/reactions"]?.payload,
		);
		expect(url.search).toBe("");
	});
});
