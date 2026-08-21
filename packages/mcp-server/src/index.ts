#!/usr/bin/env node
/* SPDX-License-Identifier: Apache-2.0 */

/**
 * MCP server for the Negirau public API.
 *
 * Self-updating by construction: at startup it fetches the live openapi.json
 * and registers one tool per operation from the spec's `x-mcp-tool-name` /
 * `x-agent-description` annotations. Adding an API operation on the server
 * side ships here without a new release.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, type ZodRawShape, type ZodType } from "zod";

const BASE_URL = process.env["NEGIRAU_BASE_URL"] ?? "https://api.negirau.com/v1";

interface ParameterObject {
	name: string;
	in: "query" | "path";
	required: boolean;
	description?: string;
	schema?: { type?: string };
}

interface OperationObject {
	operationId: string;
	summary?: string;
	description?: string;
	"x-mcp-tool-name"?: string;
	"x-agent-description"?: string;
	parameters?: ParameterObject[];
}

interface OpenApiDocument {
	info: { title: string; version: string };
	paths: Record<string, { get?: OperationObject }>;
}

function parameterSchema(parameter: ParameterObject): ZodType {
	const type = parameter.schema?.type;
	let schema: ZodType = type === "number" || type === "integer" ? z.coerce.number() : z.string();
	if (parameter.description !== undefined) {
		schema = schema.describe(parameter.description);
	}
	return parameter.required ? schema : schema.optional();
}

function toolInput(parameters: ParameterObject[]): ZodRawShape {
	return Object.fromEntries(parameters.map((p) => [p.name, parameterSchema(p)]));
}

async function callOperation(
	path: string,
	parameters: ParameterObject[],
	args: Record<string, unknown>,
): Promise<string> {
	let resolvedPath = path;
	const query = new URLSearchParams();
	for (const parameter of parameters) {
		const value = args[parameter.name];
		if (value === undefined) {
			continue;
		}
		if (parameter.in === "path") {
			resolvedPath = resolvedPath.replace(`{${parameter.name}}`, encodeURIComponent(String(value)));
		} else {
			query.set(parameter.name, String(value));
		}
	}
	const url = `${BASE_URL}${resolvedPath}${query.size > 0 ? `?${query}` : ""}`;
	const response = await fetch(url, { headers: { accept: "application/json" } });
	const body = await response.text();
	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText}: ${body}`);
	}
	return body;
}

async function main(): Promise<void> {
	const specResponse = await fetch(`${BASE_URL}/openapi.json`);
	if (!specResponse.ok) {
		throw new Error(`failed to fetch openapi.json: ${specResponse.status}`);
	}
	const spec = (await specResponse.json()) as OpenApiDocument;
	const server = new McpServer({ name: "negirau", version: spec.info.version });
	for (const [path, methods] of Object.entries(spec.paths)) {
		const operation = methods.get;
		if (!operation) {
			continue;
		}
		const parameters = operation.parameters ?? [];
		server.tool(
			operation["x-mcp-tool-name"] ?? operation.operationId,
			[operation["x-agent-description"], operation.description]
				.filter((s) => s !== undefined)
				.join("\n\n"),
			toolInput(parameters),
			async (args: Record<string, unknown>) => ({
				content: [{ type: "text" as const, text: await callOperation(path, parameters, args) }],
			}),
		);
	}
	await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
