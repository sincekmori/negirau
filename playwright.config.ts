/**
 * E2E configuration. Prerequisites (same as bun run a11y): a build plus seeded
 * local data — db:migrate, db:seed, then `bun run test:e2e`.
 * The runner starts (or reuses) the preview server itself.
 */

import { env } from "node:process";

import { defineConfig, devices } from "@playwright/test";

// Must match the preview script in package.json (webServer reuses it).
const PORT = 4173;

export default defineConfig({
	testDir: "e2e",
	// Precautionary: the reaction flows write to the shared local D1.
	workers: 1,
	forbidOnly: env["CI"] !== undefined,
	use: {
		baseURL: `http://localhost:${PORT}`,
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "bun run preview -- --strictPort",
		port: PORT,
		reuseExistingServer: env["CI"] === undefined,
	},
});
