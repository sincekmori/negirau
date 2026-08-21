// Free-text subject search: a thin client over GET /v1/subjects?q= —
// debounced, race-safe via the shared search hook. A miss offers the
// creation form: the page you looked for is one name away from existing.
import { Link } from "react-router";

import { MIN_QUERY_LENGTH } from "~/lib/api/constants";
import { searchSubjects } from "~/lib/client/api";
import { useDebouncedSearch } from "~/lib/client/use-debounced-search";
import { Input } from "~/lib/components/ui/input";
import { messages } from "~/lib/i18n";
import type { Locale } from "~/lib/i18n";

const DEBOUNCE_MS = 250;
const HIT_LIMIT = 8;

export function SubjectSearch({ locale }: { locale: Locale }) {
	const m = messages(locale);
	const search = useDebouncedSearch(
		(query: string, signal: AbortSignal) => searchSubjects(query, HIT_LIMIT, signal),
		{ minLength: MIN_QUERY_LENGTH, debounceMs: DEBOUNCE_MS },
	);

	return (
		<section>
			<h2>{m.searchHeading}</h2>
			<Input
				type="search"
				className="mt-2"
				placeholder={m.searchPlaceholder}
				aria-label={m.searchHeading}
				onChange={(event) => search.onQueryChange(event.target.value)}
			/>
			{search.failed && <p className="mt-3">{m.searchFailed}</p>}
			{search.hits !== undefined &&
				(search.hits.length === 0 ? (
					<p className="mt-3">
						{m.searchNoHits} <Link to={`/${locale}/subjects/new`}>{m.searchNoHitsCta}</Link>
					</p>
				) : (
					<ul className="mt-4">
						{search.hits.map((hit) => (
							<li key={hit.id} className="border-hairline border-b py-1.5">
								<a href={`/${locale}/subjects/${hit.id}`}>{hit.name}</a>
							</li>
						))}
					</ul>
				))}
		</section>
	);
}
