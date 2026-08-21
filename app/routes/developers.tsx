// The developers page: everything an integrator needs without leaving the
// site — API base and endpoints, clients, the MCP server, the Agent Skill,
// llms.txt, and the GitHub link. The spec itself stays the one source of
// truth; this page is the guided tour.
//
// Everything derived from the API manifest is projected in the loader: the
// manifest holds live zod schemas, and importing it into the component would
// ship the whole zod runtime to the browser for four static strings.
import { API_OPERATIONS, EXAMPLE_QUERY, ROUTE_PREFIX, specPath } from "~/lib/api/manifest";
import { CodeBlock } from "~/lib/components/CodeBlock";
import { appContext } from "~/lib/context";
import { messages } from "~/lib/i18n";

import type { Route } from "./+types/developers";

const GITHUB_URL = "https://github.com/sincekmori/negirau";

export function loader({ context }: Route.LoaderArgs) {
	const { locale, site } = context.get(appContext);
	return {
		locale,
		curl: `curl "${site.api}${ROUTE_PREFIX}/subjects?q=${EXAMPLE_QUERY}&limit=5"`,
		endpoints: API_OPERATIONS.map((operation) => ({
			operationId: operation.operationId,
			path: specPath(operation),
			summary: operation.summary,
		})),
		specHref: `${ROUTE_PREFIX}/openapi.json`,
		clients: [
			{
				name: "TypeScript",
				install: "npm install negirau",
				snippet: `import { Negirau } from "negirau";

const client = new Negirau();
const page = await client.subjects.list({ q: "${EXAMPLE_QUERY}", limit: 5 });`,
				registryHref: "https://www.npmjs.com/package/negirau",
				registryLabel: "npm: negirau",
			},
			{
				name: "Python",
				install: "pip install negirau",
				snippet: `from negirau import Negirau

client = Negirau()
page = client.subjects.list(q="${EXAMPLE_QUERY}", limit=5)`,
				registryHref: "https://pypi.org/project/negirau/",
				registryLabel: "PyPI: negirau",
			},
		],
	};
}

export { pageHeaders as headers } from "~/lib/server/route-helpers";

export default function Developers({ loaderData }: Route.ComponentProps) {
	const { locale, curl, endpoints, specHref, clients } = loaderData;
	const m = messages(locale);
	return (
		<>
			<title>{`${m.devPageTitle} | Negirau`}</title>
			<meta name="description" content={m.devPageIntro} />
			<h1 className="text-2xl font-semibold">{m.devPageTitle}</h1>
			<p className="mt-4">{m.devPageIntro}</p>

			<section className="mt-10">
				<h2>{m.devApiHeading}</h2>
				<p className="text-ink-soft mt-2">{m.devApiBody}</p>
				<CodeBlock code={curl} m={m} />
				<ul className="mt-4 flex flex-col gap-1 text-[0.9rem]">
					{endpoints.map((endpoint) => (
						<li key={endpoint.operationId} className="flex flex-wrap gap-x-3">
							<code className="text-brand-deep shrink-0">GET {endpoint.path}</code>
							<span className="text-ink-soft">
								{m.devEndpointSummaries[endpoint.operationId] ?? endpoint.summary}
							</span>
						</li>
					))}
				</ul>
				<p className="mt-4 text-[0.9rem]">
					<a href={specHref}>{m.devSpecLabel}</a>
				</p>
			</section>

			<section className="mt-10">
				<h2>{m.devClientsHeading}</h2>
				<p className="text-ink-soft mt-2">{m.devClientsBody}</p>
				{clients.map((client) => (
					<div key={client.name}>
						<h3 className="mt-5 text-[0.95rem] font-semibold">{client.name}</h3>
						<CodeBlock code={client.install} m={m} />
						<CodeBlock code={client.snippet} m={m} />
						<p className="mt-2 text-[0.9rem]">
							<a href={client.registryHref} rel="external">
								{client.registryLabel}
							</a>
						</p>
					</div>
				))}
			</section>

			<section className="mt-10">
				<h2>{m.devMcpHeading}</h2>
				<p className="text-ink-soft mt-2">{m.devMcpBody}</p>
				<CodeBlock code="npx negirau-mcp" m={m} />
				<p className="mt-2 text-[0.9rem]">
					<a href="https://www.npmjs.com/package/negirau-mcp" rel="external">
						npm: negirau-mcp
					</a>
				</p>
			</section>

			<section className="mt-10">
				<h2>{m.devSkillHeading}</h2>
				<p className="text-ink-soft mt-2">{m.devSkillBody}</p>
				<CodeBlock code="npx skills add sincekmori/negirau" m={m} />
			</section>

			<section className="mt-10">
				<h2>
					<a href="https://llmstxt.org/" rel="external">
						llms.txt
					</a>
				</h2>
				<p className="text-ink-soft mt-2">{m.devLlmsBody}</p>
				{/* A list, so llms-full.txt and friends slot in without redesign. */}
				<ul className="mt-2 flex flex-col gap-1 text-[0.9rem]">
					<li>
						<a href="/llms.txt">llms.txt</a>
					</li>
				</ul>
			</section>

			<p className="mt-10">
				<a href={GITHUB_URL} rel="external">
					{m.devGithubLabel}
				</a>
			</p>
		</>
	);
}
