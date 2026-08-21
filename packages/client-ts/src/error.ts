/* SPDX-License-Identifier: Apache-2.0 */

/** Exception hierarchy. */

/** Base class for every error this SDK throws. */
export class NegirauError extends Error {}

/** The request never produced a response (DNS, TLS, refused, ...). */
export class APIConnectionError extends NegirauError {
	constructor(message = "Connection error.", options?: { cause?: unknown }) {
		super(message, options);
		this.name = "APIConnectionError";
	}
}

/** The request timed out. */
export class APITimeoutError extends APIConnectionError {
	constructor(options?: { cause?: unknown }) {
		super("Request timed out.", options);
		this.name = "APITimeoutError";
	}
}

/** A non-success HTTP response, with the API's `code` (e.g. "not_found"). */
export class APIStatusError extends NegirauError {
	readonly statusCode: number;
	/** Machine-readable code from the API, e.g. "not_found" or "invalid_query". */
	readonly code: string;

	constructor(statusCode: number, code: string) {
		super(`${statusCode}: ${code}`);
		this.name = new.target.name;
		this.statusCode = statusCode;
		this.code = code;
	}
}

/** HTTP 400. */
export class BadRequestError extends APIStatusError {}

/** HTTP 404. */
export class NotFoundError extends APIStatusError {}

/** HTTP 429. */
export class RateLimitError extends APIStatusError {}

/** HTTP 5xx. */
export class InternalServerError extends APIStatusError {}

const STATUS_CLASSES: Record<number, typeof APIStatusError> = {
	400: BadRequestError,
	404: NotFoundError,
	429: RateLimitError,
};

/** Status classification boundary shared with the transport's retry logic. */
export const INTERNAL_ERROR_FLOOR = 500;

/** Build the most specific error class for a non-success response. */
export async function makeStatusError(response: Response): Promise<APIStatusError> {
	const code = await response
		.json()
		.then((body) => String((body as { error?: string }).error ?? "unknown"))
		.catch(() => "unknown");
	const Class =
		STATUS_CLASSES[response.status] ??
		(response.status >= INTERNAL_ERROR_FLOOR ? InternalServerError : APIStatusError);
	return new Class(response.status, code);
}
