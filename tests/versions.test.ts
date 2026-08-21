// One project version everywhere (fixed/lockstep versioning — see AGENTS.md
// "Releases"). release-please fans the number out via extra-files at release
// time; this test makes total equality a continuous invariant, so a manual
// edit to any single version field fails CI immediately instead of desyncing
// silently until the next release PR.

import { describe, expect, it } from "vitest";

import manifest from "../.release-please-manifest.json";
import rootPkg from "../package.json";
import clientPyProject from "../packages/client-py/pyproject.toml?raw";
import clientTsPkg from "../packages/client-ts/package.json";
import mcpPkg from "../packages/mcp-server/package.json";
import serverJson from "../packages/mcp-server/server.json";
import skillMd from "../skills/negirau/SKILL.md?raw";

const pyVersion = /^version = "(?<version>[^"]+)"$/m.exec(clientPyProject)?.groups?.["version"];
const skillVersion = /^ {2}version: "(?<version>[^"]+)"/m.exec(skillMd)?.groups?.["version"];

describe("the one project version", () => {
	it("is identical in every version-bearing file", () => {
		expect(clientTsPkg.version).toBe(rootPkg.version);
		expect(pyVersion).toBe(rootPkg.version);
		expect(mcpPkg.version).toBe(rootPkg.version);
		expect(serverJson.version).toBe(rootPkg.version);
		expect(serverJson.packages[0]?.version).toBe(rootPkg.version);
		expect(manifest["."]).toBe(rootPkg.version);
		expect(skillVersion).toBe(rootPkg.version);
	});
});
