import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import babel from "vite-plugin-babel";

// ?worker&url chunks (maplibre's map worker) are browser-only, but vite's
// cross-environment asset sharing re-emits them into the server bundle, where
// wrangler would upload them as dead modules (460 KB). The ssr module graph
// never references them (verified: no importer resolves ?worker&url there),
// so dropping them from the server output is safe.
const pruneClientWorkerChunks: Plugin = {
	name: "prune-client-worker-chunks",
	generateBundle(_options, bundle) {
		if (this.environment.name === "client") {
			return;
		}
		for (const fileName of Object.keys(bundle)) {
			if (fileName.includes("maplibre-gl-worker")) {
				// Reflect.deleteProperty over delete: the key is dynamic by nature
				// (hashed chunk names), which no-dynamic-delete would reject.
				Reflect.deleteProperty(bundle, fileName);
			}
		}
	},
};

// workers-og's .wasm imports need no special casing here: the Cloudflare
// plugin gives the ssr environment real workerd module resolution.
export default defineConfig({
	// Mirror tsconfig's "~/*" → app/*: builds resolve it via the react-router
	// plugin, but the Cloudflare plugin's dev-mode entry probe (workers/app.ts)
	// resolves through vite alone and needs the alias here too.
	resolve: { alias: { "~": new URL("app", import.meta.url).pathname } },
	plugins: [
		// React Compiler (automatic memoization). The react-router plugin owns
		// the JSX transform and exposes no babel hook, so the compiler runs as
		// its own pass first, on app code only — it no-ops outside components
		// and hooks. The react/react-compiler lint rule keeps every component
		// eligible (zero rule suppressions).
		babel({
			include: /\/app\/.+\.tsx$/,
			babelConfig: {
				// syntax-jsx forces JSX on: react-router's virtual route ids
				// (name.tsx?__client-route) defeat the preset's extension sniff.
				presets: ["@babel/preset-typescript"],
				plugins: ["@babel/plugin-syntax-jsx", "babel-plugin-react-compiler"],
			},
		}),
		babel({
			// Hooks live in plain .ts files; parsed without JSX so generic
			// arrows keep their meaning.
			include: /\/app\/.+\.ts$/,
			babelConfig: {
				presets: ["@babel/preset-typescript"],
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		reactRouter(),
		pruneClientWorkerChunks,
	],
});
