// Shared shell for the two policy pages (privacy, terms): a titled list of
// prose sections ending in a link to the contact page. The contact page owns
// the mailto; a printed address would invite hand-typed mail without the
// [Negirau] subject prefix.
import { Link } from "react-router";

import { messages } from "~/lib/i18n";
import type { Locale } from "~/lib/i18n";
import type { PolicySection } from "~/lib/i18n/messages";

export function PolicyPage({
	locale,
	title,
	sections,
}: {
	locale: Locale;
	title: string;
	sections: readonly PolicySection[];
}) {
	const m = messages(locale);
	return (
		<>
			<title>{`${title} | Negirau`}</title>
			<meta name="robots" content="noindex" />
			<h1 className="text-2xl font-semibold">{title}</h1>
			{sections.map((section) => (
				<section key={section.title} className="mt-8">
					<h2 className="text-lg font-semibold">{section.title}</h2>
					<p className="mt-2">{section.body}</p>
				</section>
			))}
			<p className="mt-8">
				<Link to={`/${locale}/contact`}>{m.navContact}</Link>
			</p>
		</>
	);
}
