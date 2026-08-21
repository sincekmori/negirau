// The MCP registry caps server.json's description at 100 characters and
// answers 422 when it is longer. That check runs after `npm publish` has
// already succeeded, so the release lands half-done and cannot be retried:
// the npm version is taken. Fail here, before the release PR is ever opened.

import { describe, expect, it } from "vitest";

import serverJson from "../packages/mcp-server/server.json";

const DESCRIPTION_CAP = 100;

describe("the MCP registry manifest", () => {
	it("keeps the description within the registry's cap", () => {
		expect(serverJson.description.length).toBeLessThanOrEqual(DESCRIPTION_CAP);
	});
});
