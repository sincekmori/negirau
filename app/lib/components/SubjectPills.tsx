// The one subject-pill list: the home shelf and the /subjects listing render
// the same wrapping pills, including the "nothing yet, add the first" empty
// state with its create link.
import { Link } from "react-router";

import { messages } from "~/lib/i18n";
import type { Locale } from "~/lib/i18n";

export function SubjectPills({
	locale,
	subjects,
}: {
	locale: Locale;
	subjects: readonly { id: string; name: string }[];
}) {
	const m = messages(locale);
	if (subjects.length === 0) {
		return (
			<p>
				{m.recentEmpty} <Link to={`/${locale}/subjects/new`}>{m.heroCtaCreate}</Link>
			</p>
		);
	}
	return (
		<ul className="flex flex-wrap gap-3">
			{subjects.map((subject) => (
				<li key={subject.id}>
					<Link
						to={`/${locale}/subjects/${subject.id}`}
						className="border-hairline text-ink hover:border-brand hover:text-brand-deep inline-block rounded-full border px-4 py-2 text-[0.9rem] no-underline"
					>
						{subject.name}
					</Link>
				</li>
			))}
		</ul>
	);
}
