/**
 * The OpenAPI document, assembled from the zod schemas + route manifest
 * Shared by generate-openapi.ts (the served spec) and
 * generate-skill.ts (the snapshot bundled into the agent skill) so either
 * generator can run alone and both copies stay byte-identical.
 */

import * as z from "zod";

import { API_OPERATIONS, specPath } from "../app/lib/api/manifest";
import { errorResponseSchema } from "../app/lib/api/schemas";
// The one project version; root package.json is the canonical copy (AGENTS.md "Releases").
import { version as PROJECT_VERSION } from "../package.json";
import { CANONICAL_ORIGIN, SERVER_URL } from "./site-config";

function toSchema(schema: z.ZodType): Record<string, unknown> {
	const jsonSchema = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
	delete jsonSchema["$schema"];
	return jsonSchema;
}

interface ParameterObject {
	name: string;
	in: "query" | "path";
	required: boolean;
	description?: string;
	schema: Record<string, unknown>;
}

function parametersFor(operation: (typeof API_OPERATIONS)[number]): ParameterObject[] {
	const parameters: ParameterObject[] = [];
	for (const [name, meta] of Object.entries(operation.pathParams ?? {})) {
		parameters.push({
			name,
			in: "path",
			required: true,
			description: meta.description,
			schema: { type: "string" },
		});
	}
	if (operation.query) {
		for (const [name, field] of Object.entries(operation.query.shape)) {
			const fieldSchema = toSchema(field as z.ZodType);
			const description =
				typeof fieldSchema["description"] === "string" ? fieldSchema["description"] : undefined;
			parameters.push({
				name,
				in: "query",
				required: !(field as z.ZodType).safeParse(undefined).success,
				...(description === undefined ? {} : { description }),
				schema: fieldSchema,
			});
		}
	}
	return parameters;
}

const errorContent = { "application/json": { schema: toSchema(errorResponseSchema) } };

const paths: Record<string, unknown> = {};
for (const operation of API_OPERATIONS) {
	paths[specPath(operation)] = {
		[operation.method]: {
			operationId: operation.operationId,
			summary: operation.summary,
			description: operation.description,
			"x-mcp-tool-name": operation.xMcpToolName,
			"x-agent-description": operation.xAgentDescription,
			parameters: parametersFor(operation),
			responses: {
				"200": {
					description: "Success",
					content: { "application/json": { schema: toSchema(operation.response) } },
				},
				...(operation.query && {
					"400": { description: "Invalid query or cursor", content: errorContent },
				}),
				...(operation.notFoundDescription !== undefined && {
					"404": { description: operation.notFoundDescription, content: errorContent },
				}),
			},
		},
	};
}

export const OPENAPI_DOCUMENT = {
	openapi: "3.1.0",
	info: {
		title: "Negirau Public API",
		description:
			'Read-only, anonymous, CORS-open API for building third-party viewers over Negirau data. Counts are exposed as display values — exact up to 100, "100+" beyond — and never as rankings.',
		version: PROJECT_VERSION,
		// The usage terms reach API-only consumers through the spec.
		termsOfService: `${CANONICAL_ORIGIN}/terms`,
	},
	servers: [{ url: SERVER_URL }],
	paths,
};

export const OPENAPI_JSON = `${JSON.stringify(OPENAPI_DOCUMENT, null, 2)}\n`;
