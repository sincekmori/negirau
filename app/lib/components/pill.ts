// The one segmented-control skin: text pills share this exact class pair,
// whatever element carries it (link, radio label, button).
export function pillClass(selected: boolean): string {
	return `rounded-full border px-3 py-1 text-[0.85rem] ${
		selected ? "border-brand bg-brand-wash text-brand-deep" : "border-hairline text-ink-soft"
	}`;
}
