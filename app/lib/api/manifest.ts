/**
 * Route manifest: the non-zod half of the OpenAPI single source of truth.
 * Adding or changing public API surface means touching this file and the zod
 * schemas — nothing downstream is written by hand.
 *
 * `summary` speaks to humans; `x-mcp-tool-name` / `x-agent-description` speak
 * to agent interfaces (MCP server, Agent Skill) generated from the spec.
 */

import * as z from "zod";

import { ROUTE_PREFIX } from "~/lib/api/constants";
import {
	nearListResponseSchema,
	reactionsQuerySchema,
	reactionsResponseSchema,
	subjectListQuerySchema,
	subjectListResponseSchema,
	subjectSchema,
} from "~/lib/api/schemas";

export interface ApiOperation {
	operationId: string;
	method: "get";
	/** OpenAPI-style path with {param} placeholders. */
	path: string;
	summary: string;
	description: string;
	query?: z.ZodObject;
	pathParams?: Record<string, { description: string }>;
	response: z.ZodType;
	/** When set, the spec declares a JSON 404 with this description. */
	notFoundDescription?: string;
	xMcpToolName: string;
	xAgentDescription: string;
}

/** The spec-relative form of an operation path ('/v1/subjects' → '/subjects'). */
export function specPath(operation: ApiOperation): string {
	return operation.path.slice(ROUTE_PREFIX.length);
}

export const API_OPERATIONS: ApiOperation[] = [
	{
		operationId: "listSubjects",
		method: "get",
		path: "/v1/subjects",
		summary: "List and search subjects",
		description:
			"Cursor-paginated subject listing. `q` does free-text name search (Japanese and English): 1-2 characters match as a name prefix (single page), 3 or more match anywhere in the name. With `near`, switches to a distance-ordered search over subjects that have a spatial dimension (no cursor; results truncated at `limit`).",
		query: subjectListQuerySchema,
		// The near variant answers with distances and no cursor; the union keeps the spec honest.
		response: z.union([subjectListResponseSchema, nearListResponseSchema]),
		xMcpToolName: "negirau_list_subjects",
		xAgentDescription:
			"Search Negirau subjects (the recipients of appreciation). Use q for name search, near='lat,lng' for proximity search.",
	},
	{
		operationId: "getSubject",
		method: "get",
		path: "/v1/subjects/{id}",
		summary: "Get one subject",
		description: "A single subject by its public identifier.",
		pathParams: { id: { description: "Public subject identifier" } },
		response: subjectSchema,
		notFoundDescription: "No active subject has this identifier.",
		xMcpToolName: "negirau_get_subject",
		xAgentDescription: "Fetch one Negirau subject by id.",
	},
	{
		operationId: "getSubjectReactions",
		method: "get",
		path: "/v1/subjects/{id}/reactions",
		summary: "Reaction display values for a period",
		description:
			'Total and per-type reaction display values for one subject over a period (week, month, year, or all time). Values are exact up to 100 and capped at "100+" beyond.',
		pathParams: { id: { description: "Public subject identifier" } },
		query: reactionsQuerySchema,
		response: reactionsResponseSchema,
		notFoundDescription: "No active subject has this identifier.",
		xMcpToolName: "negirau_get_reactions",
		xAgentDescription: "Reaction display values for a Negirau subject over a period.",
	},
];

export { EXAMPLE_QUERY, ROUTE_PREFIX } from "~/lib/api/constants";
