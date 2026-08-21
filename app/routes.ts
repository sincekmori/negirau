import { index, route } from "@react-router/dev/routes";
import type { RouteConfig } from "@react-router/dev/routes";

// Route ranking keeps the trees apart: static segments outrank the optional
// :locale? param, and the locale-free three-segment representation routes
// (subjects/:id/og|badge|feed) collide with nothing because the locale tree
// has no children by those names — never add ones that match. Subject ids
// are URL-safe and slash-free, so plain :id params suffice everywhere.
export default [
	// Locale-scoped pages; bare paths redirect in the site layout's loader.
	// The static "new" segment outranks :id, so no subject may take that id.
	route(":locale?", "routes/site.tsx", [
		index("routes/home.tsx"),
		route("contact", "routes/contact.tsx"),
		route("developers", "routes/developers.tsx"),
		route("privacy", "routes/privacy.tsx"),
		route("terms", "routes/terms.tsx"),
		route("subjects", "routes/subjects.tsx"),
		route("subjects/new", "routes/create.tsx"),
		route("subjects/:id", "routes/subject.tsx"),
		route("subjects/:id/edit", "routes/edit.tsx"),
		route("subjects/:id/poster", "routes/poster.tsx"),
	]),
	// Public API.
	route("v1/subjects", "routes/v1.subjects.ts"),
	route("v1/subjects/:id", "routes/v1.subjects.detail.ts"),
	route("v1/subjects/:id/reactions", "routes/v1.subjects.reactions.ts"),
	// Subject-scoped resources and representations: locale-free and terminal —
	// unlike the locale tree's pages above (a bare /subjects/{id}/poster 302s
	// to the visitor's locale, these never do). Reactions are the one write
	// (Turnstile-gated, deliberately not in the spec): POST sends, DELETE
	// undoes. The site's own OG card is the one non-subject image.
	route("subjects/:id/reactions", "routes/subject.reactions.ts"),
	route("subjects/:id/og", "routes/og.ts"),
	route("subjects/:id/badge", "routes/badge.ts"),
	route("subjects/:id/feed", "routes/feed.ts"),
	route("og/site", "routes/og.site.ts"),
	route("robots.txt", "routes/robots.ts"),
	route("sitemap.xml", "routes/sitemap.ts"),
	route("sitemaps/:page", "routes/sitemaps.ts"),
] satisfies RouteConfig;
