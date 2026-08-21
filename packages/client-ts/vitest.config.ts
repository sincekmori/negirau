import { defineConfig } from "vitest/config";

// Without a local config vitest resolves the monorepo root's workers-pool
// config; this package's contract tests run in plain node.
export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
		coverage: {
			enabled: true,
			provider: "v8",
			reporter: ["text"], // terminal only; no report files to stray into git
			include: ["src/**"],
			// The whole public surface is contract-tested; hold the line at 100%.
			thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
		},
	},
});
