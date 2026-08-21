/**
 * Dependency-free API constants. The worker entry and browser components
 * import these directly so neither pulls zod (schemas) or the message
 * catalogs into their startup graph.
 */

/** The public API lives under this prefix; a breaking v2 would be added beside it. */
export const ROUTE_PREFIX = "/v1";

/** Example search used across docs and smoke checks (long enough for the trigram path). */
export const EXAMPLE_QUERY = "library";

/**
 * Search works from the first character: 1-2 characters run as a bounded
 * name-prefix seek, 3+ as trigram substring search (see listSubjects).
 */
export const MIN_QUERY_LENGTH = 1;

/** One limit for the name field, shared by the forms and the validators. */
export const SUBJECT_NAME_MAX = 200;
