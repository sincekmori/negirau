import path from "node:path";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

export default defineConfig({
	plugins: [
		// Bindings are declared directly instead of via wrangler.jsonc: miniflare
		// has no ratelimit binding emulation, and tests must also work when the
		// operator removes those bindings from the real config.
		cloudflareTest({
			miniflare: {
				compatibilityDate: "2026-08-08", // keep in sync with wrangler.jsonc
				d1Databases: ["DB"],
				bindings: {
					SITE_DOMAIN: "negirau.test",
					CONTACT_EMAIL: "test@negirau.test",
					REACTIONS_ENABLED: "true",
					TURNSTILE_SITE_KEY: "test-site-key",
					TURNSTILE_SECRET_KEY: "test-secret-key",
					TEST_MIGRATIONS: migrations,
				},
			},
		}),
	],
	resolve: {
		// Tests run without the app's vite plugins, so the ~ alias is mapped by hand.
		alias: { "~": path.resolve(import.meta.dirname, "app") },
	},
	test: {
		include: ["tests/**/*.test.ts"],
		setupFiles: ["tests/apply-migrations.ts"],
	},
});
