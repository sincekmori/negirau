import { env } from "node:process";

import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	// Env-specific output: a dev-environment build (deploy:dev) flattens the
	// negirau-dev D1 id into its wrangler.json, and if it landed in build/ a
	// later `bun run preview` would open an empty local database ("no such
	// table: subjects"). Separate directories keep preview and deploy:dev
	// from ever poisoning each other; wrangler follows the deploy redirect
	// written by whichever build ran last inside the same script.
	buildDirectory: env["CLOUDFLARE_ENV"] === "dev" ? "build-dev" : "build",
} satisfies Config;
