import { PolicyPage } from "~/lib/components/PolicyPage";
// The privacy policy: what is collected and why, third-party transmissions,
// and the takedown process.
import { appContext } from "~/lib/context";
import { messages } from "~/lib/i18n";
import { PRIVACY_SECTIONS } from "~/lib/i18n/policies";

import type { Route } from "./+types/privacy";

export function loader({ context }: Route.LoaderArgs) {
	const { locale } = context.get(appContext);
	return { locale };
}

export { pageHeaders as headers } from "~/lib/server/route-helpers";

export default function Privacy({ loaderData }: Route.ComponentProps) {
	const { locale } = loaderData;
	return (
		<PolicyPage
			locale={locale}
			title={messages(locale).privacyTitle}
			sections={PRIVACY_SECTIONS[locale]}
		/>
	);
}
