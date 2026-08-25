/* SPDX-License-Identifier: Apache-2.0 */

/** The `subjects` resource (`client.subjects.list()` etc.). */

import { get, type TransportOptions } from "../core.js";
import type {
	NearbySubject,
	ReactionsSummary,
	Subject,
	SubjectListParams,
	SubjectPage,
} from "../types.js";

/** Sub-resource: `client.subjects.reactions.retrieve(id)`. */
export class Reactions {
	readonly #transport: TransportOptions;

	constructor(transport: TransportOptions) {
		this.#transport = transport;
	}

	/** All-time reaction display values for a subject. */
	retrieve(id: string): Promise<ReactionsSummary> {
		return get(this.#transport, `/subjects/${encodeURIComponent(id)}/reactions`);
	}
}

/** The recipients of appreciation. */
export class Subjects {
	readonly #transport: TransportOptions;
	readonly reactions: Reactions;

	constructor(transport: TransportOptions) {
		this.#transport = transport;
		this.reactions = new Reactions(transport);
	}

	/** List/search subjects (cursor-paginated); `q` is free-text name search. */
	list(params: SubjectListParams = {}): Promise<SubjectPage> {
		return get(this.#transport, "/subjects", {
			q: params.q,
			limit: params.limit,
			cursor: params.cursor,
		});
	}

	/** Find spatial subjects near a point, closest first (radius in meters). */
	async listNear(
		lat: number,
		lng: number,
		params: { radius?: number; limit?: number } = {},
	): Promise<NearbySubject[]> {
		const page = await get<{ subjects: NearbySubject[] }>(this.#transport, "/subjects", {
			near: `${lat},${lng}`,
			radius: params.radius,
			limit: params.limit,
		});
		return page.subjects;
	}

	/** Fetch one subject by its public identifier. */
	retrieve(id: string): Promise<Subject> {
		return get(this.#transport, `/subjects/${encodeURIComponent(id)}`);
	}
}
