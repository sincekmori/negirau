import { PolicyPage } from "~/lib/components/PolicyPage";
// The terms of service: free use for any purpose (a company's own internal use
// included), the prohibited acts, and the operator's removal rights — the legal
// counterpart to the praise-only design.
import { appContext } from "~/lib/context";
import { messages } from "~/lib/i18n";
import { TERMS_SECTIONS } from "~/lib/i18n/policies";

import type { Route } from "./+types/terms";

export function loader({ context }: Route.LoaderArgs) {
	const { locale } = context.get(appContext);
	return { locale };
}

export { pageHeaders as headers } from "~/lib/server/route-helpers";

export default function Terms({ loaderData }: Route.ComponentProps) {
	const { locale } = loaderData;
	return (
		<PolicyPage
			locale={locale}
			title={messages(locale).termsTitle}
			sections={TERMS_SECTIONS[locale]}
		/>
	);
}
