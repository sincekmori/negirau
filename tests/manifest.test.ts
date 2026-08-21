// Glue test that makes the OpenAPI manifest load-bearing: every declared
// operation must be served by a registered /v1 route, and every /v1 route must
// serve a declared operation — a renamed route fails here instead of 404ing
// for clients.

import { describe, expect, it } from "vitest";

import { API_OPERATIONS, ROUTE_PREFIX } from "~/lib/api/manifest";

import routes from "../app/routes";

interface RouteEntry {
	path?: string;
	children?: RouteEntry[];
}

function collectPaths(entries: RouteEntry[], prefix = ""): string[] {
	return entries.flatMap((entry) => {
		const path = entry.path === undefined ? prefix : `${prefix}/${entry.path}`;
		const children = entry.children ? collectPaths(entry.children, path) : [];
		return [path, ...children];
	});
}

const v1Routes = collectPaths(routes as RouteEntry[]).filter((path) =>
	path.startsWith(`${ROUTE_PREFIX}/`),
);

/** Does a registered route pattern serve this operation path? ({id} and :id are the same slot.) */
function servedBy(operationPath: string): string | undefined {
	const concrete = operationPath.replaceAll(/\{\w+\}/g, "x");
	return v1Routes.find((pattern) => pattern.replaceAll(/:\w+/g, "x") === concrete);
}

describe("API manifest ↔ route registry", () => {
	it("serves every declared operation from a registered route", () => {
		for (const operation of API_OPERATIONS) {
			expect(servedBy(operation.path), operation.path).toBeDefined();
		}
	});

	it("registers no /v1 route that serves nothing in the manifest", () => {
		for (const pattern of v1Routes) {
			const used = API_OPERATIONS.some((operation) => servedBy(operation.path) === pattern);
			expect(used, pattern).toBe(true);
		}
	});
});
