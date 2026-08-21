// The website/blog embed, reached from the share menu: an overlay dialog
// with the badge itself, a Markdown/HTML toggle, and an icon copy — the page
// keeps viewing and sending as its only inline concerns.
import { useState } from "react";

import { CodeBlock } from "~/lib/components/CodeBlock";
import { OverlayDialog } from "~/lib/components/OverlayDialog";
import { pillClass } from "~/lib/components/pill";
import { messages } from "~/lib/i18n";
import type { Locale } from "~/lib/i18n";

const FORMATS = ["HTML", "Markdown"] as const;
type Format = (typeof FORMATS)[number];

function snippetFor(format: Format, imageUrl: string, target: string): string {
	return format === "HTML"
		? `<a href="${target}" target="_blank" rel="noopener noreferrer"><img src="${imageUrl}" alt="Negirau" /></a>`
		: `[![Negirau](${imageUrl})](${target})`;
}

export function EmbedDialog({
	origin,
	subjectId,
	locale,
	open,
	onOpenChange,
}: {
	origin: string;
	subjectId: string;
	locale: Locale;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const m = messages(locale);
	const [format, setFormat] = useState<Format>("HTML");

	// No lang parameter: the default badge (period=all) draws only the icon,
	// the subject name, and the number — language-neutral for every viewer.
	const imageUrl = `${origin}/subjects/${subjectId}/badge`;
	const target = `${origin}/subjects/${subjectId}`;
	const snippet = snippetFor(format, imageUrl, target);

	return (
		<OverlayDialog open={open} onOpenChange={onOpenChange} title={m.embedSummary}>
			{/* The badge itself, as a plain preview — it needs no explaining,
			    and navigating away mid-dialog would help nobody. */}
			<img src={imageUrl} alt="" className="h-5 w-fit" />
			{/* Format choice as real radios, styled as pills. */}
			<fieldset aria-label={m.embedFormatLabel} className="flex gap-1">
				{FORMATS.map((candidate) => (
					<label key={candidate} className={`cursor-pointer ${pillClass(format === candidate)}`}>
						<input
							type="radio"
							name="embed-format"
							value={candidate}
							checked={format === candidate}
							onChange={() => setFormat(candidate)}
							className="sr-only"
						/>
						{candidate}
					</label>
				))}
			</fieldset>
			<CodeBlock code={snippet} m={m} />
		</OverlayDialog>
	);
}
