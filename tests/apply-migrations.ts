import { applyD1Migrations, env } from "cloudflare:test";
import type { D1Migration } from "cloudflare:test";

// The test env carries the migration list injected by vitest.config.ts.
declare global {
	namespace Cloudflare {
		interface Env {
			TEST_MIGRATIONS: D1Migration[];
		}
	}
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
