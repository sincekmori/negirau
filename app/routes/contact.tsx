// The contact page: one mailto for everything — inquiries, reports,
// takedown requests, disclosure requests. The address is wrangler.jsonc
// vars.CONTACT_EMAIL — site identity, not source — and is never printed as
// text: a hand-typed mail would lose the [Negirau] subject prefix the
// operator's inbox filters on.
import { Mail } from "lucide-react";

import { ActionButton } from "~/lib/components/ActionButton";
import { appContext } from "~/lib/context";
import { messages } from "~/lib/i18n";
import { contactMailto } from "~/lib/mailto";

import type { Route } from "./+types/contact";

export function loader({ context }: Route.LoaderArgs) {
	const { env, locale } = context.get(appContext);
	return { locale, contactEmail: env.CONTACT_EMAIL };
}

export { pageHeaders as headers } from "~/lib/server/route-helpers";

export default function Contact({ loaderData }: Route.ComponentProps) {
	const { contactEmail } = loaderData;
	const m = messages(loaderData.locale);
	return (
		<>
			<title>{`${m.contactTitle} | Negirau`}</title>
			<meta name="robots" content="noindex" />
			<h1 className="text-2xl font-semibold">{m.contactTitle}</h1>
			<p className="mt-4">{m.contactBody}</p>
			<p className="mt-6 flex justify-end">
				<ActionButton
					href={contactMailto(contactEmail, m.contactMailSubject)}
					size="lg"
					icon={Mail}
				>
					{m.contactCta}
				</ActionButton>
			</p>
		</>
	);
}
