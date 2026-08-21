/**
 * Accessibility audit: axe-core (WCAG 2.1 A/AA) against the built Worker in
 * real workerd, in both locales and both color schemes.
 *
 * Self-contained: starts its own preview server on a scratch port, so CI and
 * local runs are one command. Prerequisites: `bun run build` and seeded local
 * data (db:migrate, db:seed), plus `bunx playwright install chromium`.
 *
 *   bun run a11y
 */

import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

import { SEED_SUBJECT } from "./seed/seed-subject";

const PORT = 4180;
const BASE = `http://localhost:${PORT}`;
const PAGES = [
	"/ja",
	"/en",
	"/ja/subjects/new",
	"/en/subjects/new",
	"/ja/privacy",
	"/ja/contact",
	"/ja/developers",
	"/ja/terms",
	"/ja/subjects",
	`/ja/subjects/${SEED_SUBJECT.id}`,
	`/ja/subjects/${SEED_SUBJECT.id}/edit`,
];
const SCHEMES = ["light", "dark"] as const;

// Read as a file, not an import: axe ships the minified bundle without an ESM entry.
const axeSource = await Bun.file("node_modules/axe-core/axe.min.js").text();

interface AxeViolation {
	id: string;
	impact: string | null;
	help: string;
	nodes: { target: string[] }[];
}

interface AxeGlobal {
	run: (context: Document, options: object) => Promise<{ violations: AxeViolation[] }>;
}

async function waitForServer(): Promise<void> {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(`${BASE}/ja`);
			if (response.ok) {
				return;
			}
		} catch {
			// Not up yet.
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 500);
		});
	}
	throw new Error("preview server did not come up");
}

async function auditPage(page: Page, path: string): Promise<AxeViolation[]> {
	// "load", not "networkidle": Turnstile keeps a connection open on subject pages.
	await page.goto(`${BASE}${path}`, { waitUntil: "load" });
	// Collapsed disclosures hide their contents from axe; audit them open.
	await page.locator("details").evaluateAll((nodes) => {
		for (const node of nodes) {
			node.setAttribute("open", "");
		}
	});
	await page.addScriptTag({ content: axeSource });
	return page.evaluate(async () => {
		const { axe } = window as unknown as { axe: AxeGlobal };
		const result = await axe.run(document, {
			runOnly: {
				type: "tag",
				// Everything axe can enforce: WCAG 2.0/2.1/2.2 A+AA, the automatable
				// AAA rules (e.g. 7:1 enhanced contrast), and axe best practices.
				values: [
					"wcag2a",
					"wcag2aa",
					"wcag2aaa",
					"wcag21a",
					"wcag21aa",
					"wcag22aa",
					"best-practice",
				],
			},
		});
		return result.violations;
	});
}

function report(path: string, scheme: string, violations: AxeViolation[]): void {
	if (violations.length === 0) {
		console.log(`ok   ${path} (${scheme})`);
		return;
	}
	for (const violation of violations) {
		console.error(
			`FAIL ${path} (${scheme}): ${violation.id} [${violation.impact ?? "n/a"}] ${violation.help}`,
		);
		for (const node of violation.nodes) {
			console.error(`     ${node.target.join(" ")}`);
		}
	}
}

async function auditAll(browser: Browser): Promise<number> {
	let failures = 0;
	for (const scheme of SCHEMES) {
		const context = await browser.newContext({ colorScheme: scheme });
		const page = await context.newPage();
		for (const path of PAGES) {
			const violations = await auditPage(page, path);
			report(path, scheme, violations);
			failures += violations.length;
		}
		await context.close();
	}
	return failures;
}

const server = Bun.spawn(["bunx", "vite", "preview", "--port", String(PORT)], {
	stdout: "ignore",
	stderr: "ignore",
});

let failures = 0;
try {
	await waitForServer();
	const browser = await chromium.launch();
	try {
		failures = await auditAll(browser);
	} finally {
		await browser.close();
	}
} finally {
	server.kill();
}

if (failures > 0) {
	console.error(`\n${failures} accessibility violation(s)`);
	process.exit(1);
}
console.log("\nno accessibility violations");
