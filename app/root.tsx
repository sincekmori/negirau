import { ThemeProvider } from "next-themes";
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData,
} from "react-router";

// no-inline: as a data URI the icon would ride along in every SSR response
// and the root chunk; as a fingerprinted asset it is one cached request.
import faviconUrl from "~/lib/assets/favicon.svg?no-inline";
import { appContext } from "~/lib/context";
import { DEFAULT_LOCALE } from "~/lib/i18n";

import type { Route } from "./+types/root";

import "~/lib/app.css";

export const links: Route.LinksFunction = () => [
	{ rel: "icon", type: "image/svg+xml", href: faviconUrl },
];

export function loader({ context }: Route.LoaderArgs) {
	return { locale: context.get(appContext).locale };
}

export function Layout({ children }: { children: React.ReactNode }) {
	const data = useRouteLoaderData<typeof loader>("root");
	return (
		// suppressHydrationWarning: next-themes stamps the `dark` class before hydration.
		<html lang={data?.locale ?? DEFAULT_LOCALE} suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					{children}
				</ThemeProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	const status = isRouteErrorResponse(error) ? error.status : 500;
	return (
		<main className="mx-auto max-w-3xl px-6 py-24 text-center">
			<h1 className="text-3xl font-semibold">{status}</h1>
		</main>
	);
}
