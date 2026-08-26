/**
 * End-to-end smoke test against any deployed (or local) instance:
 *
 *   bun run smoke                                  # local preview (http://localhost:4173)
 *   bun run smoke https://dev.negirau.com
 *   bun run smoke http://localhost:4173 --write    # --write also sends one reaction
 *
 * Read-only by default so it is safe against any host; --write exercises
 * POST /subjects/{id}/reactions and passes only where the Turnstile TEST secret is
 * configured — i.e. locally (dev and production verify tokens for real).
 *
 * API coverage is driven by the route manifest: every public operation must
 * have a smoke URL below, so adding an endpoint without smoke coverage fails.
 */

import { API_OPERATIONS } from "~/lib/api/manifest";

import { SEED_SUBJECT } from "./seed/seed-subject";

const baseUrl = (process.argv[2] ?? "http://localhost:4173").replace(/\/$/, "");
const write = process.argv.includes("--write");

interface Check {
	name: string;
	path: string;
	expect: (response: Response, body: string) => string | undefined;
}

const okJson = (response: Response, body: string): string | undefined => {
	if (response.status !== 200) {
		return `status ${response.status}`;
	}
	try {
		JSON.parse(body);
	} catch {
		return "body is not JSON";
	}
	return undefined;
};

// Pull one id from the API up front: the {id} operations (and the write
// check) need a concrete subject on whatever instance we point at.
const listingResponse = await fetch(`${baseUrl}/v1/subjects?limit=1`);
const listing = (await listingResponse.json()) as { subjects: { id: string }[] };
const sampleId = listing.subjects[0]?.id;
if (sampleId === undefined) {
	console.error(`FAIL no subjects on ${baseUrl}; cannot smoke the {id} operations`);
	process.exit(1);
}

/** One concrete URL per manifest operation (path params filled with sampleId). */
const API_SMOKE_PATHS: Record<string, string> = {
	listSubjects: "/v1/subjects?limit=1",
	getSubject: `/v1/subjects/${sampleId}`,
	getSubjectReactions: `/v1/subjects/${sampleId}/reactions`,
};
const missing = API_OPERATIONS.filter((op) => !(op.operationId in API_SMOKE_PATHS));
if (missing.length > 0) {
	console.error(`FAIL no smoke path for: ${missing.map((op) => op.operationId).join(", ")}`);
	process.exit(1);
}

const CHECKS: Check[] = [
	{
		name: "top page",
		path: "/",
		expect: (r) => (r.status === 200 ? undefined : `status ${r.status}`),
	},
	...API_OPERATIONS.map((op) => ({
		name: op.operationId,
		path: API_SMOKE_PATHS[op.operationId] as string,
		expect: okJson,
	})),
	{ name: "v1 openapi", path: "/v1/openapi.json", expect: okJson },
	// The shared seed identity, so the check exercises the FTS path and can
	// actually hit on a freshly seeded instance without a hand-synced literal.
	{
		name: "v1 search",
		path: `/v1/subjects?q=${encodeURIComponent(SEED_SUBJECT.name)}&limit=5`,
		expect: okJson,
	},
	{
		name: "robots",
		path: "/robots.txt",
		expect: (r, body) => (r.ok && body.includes("Sitemap: ") ? undefined : `status ${r.status}`),
	},
];

let failures = 0;
for (const check of CHECKS) {
	const response = await fetch(`${baseUrl}${check.path}`);
	const body = await response.text();
	const problem = check.expect(response, body);
	if (problem === undefined) {
		console.log(`ok   ${check.name}`);
	} else {
		failures += 1;
		console.error(`FAIL ${check.name}: ${problem}`);
	}
}

if (write) {
	const response = await fetch(`${baseUrl}/subjects/${sampleId}/reactions`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		// Works only where the Turnstile TEST secret is configured (local).
		body: JSON.stringify({ type: "heart", token: "smoke-test-token" }),
	});
	if (response.status === 200) {
		console.log(`ok   react write (${sampleId})`);
	} else {
		failures += 1;
		console.error(`FAIL react write: status ${response.status}`);
	}
}

if (failures > 0) {
	console.error(`\n${failures} check(s) failed against ${baseUrl}`);
	process.exit(1);
}
console.log(`\nall checks passed against ${baseUrl}`);
