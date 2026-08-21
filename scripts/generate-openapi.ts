/**
 * Build-time OpenAPI generation.
 *
 * The document itself is assembled in openapi-document.ts (shared with the
 * skill generator); this script only writes it where the deployed Worker
 * serves it as a static asset at /v1/openapi.json. There is no hand-written
 * YAML anywhere.
 *
 * Run via `bun run generate:openapi` (part of `bun run build`).
 */

import { mkdir, writeFile } from "node:fs/promises";

import { API_OPERATIONS } from "../app/lib/api/manifest";
import { OPENAPI_JSON } from "./openapi-document";

// public/v1/ so the asset layer serves it at {API_ORIGIN}/v1/openapi.json directly.
await mkdir("public/v1", { recursive: true });
await writeFile("public/v1/openapi.json", OPENAPI_JSON);
console.log(`generated public/v1/openapi.json (${API_OPERATIONS.length} operations)`);
