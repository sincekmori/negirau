// The one copyable code block: the snippet with a translucent icon copy
// button overlaid in its top-right corner. Feedback is the icon swap alone —
// nothing moves (zero CLS).
import { Check, Copy } from "lucide-react";
import { useRef } from "react";

import { copyText } from "~/lib/client/share";
import { useCopiedFlag } from "~/lib/client/use-copied-flag";
import { Button } from "~/lib/components/ui/button";
import type { messages } from "~/lib/i18n";

export function CodeBlock({ code, m }: { code: string; m: ReturnType<typeof messages> }) {
	const { copied, confirm } = useCopiedFlag();
	const codeRef = useRef<HTMLElement>(null);

	async function copy(): Promise<void> {
		if (await copyText(code)) {
			confirm();
		} else if (codeRef.current) {
			// Clipboard unavailable: select the code so one keystroke copies it.
			const range = document.createRange();
			range.selectNodeContents(codeRef.current);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
		}
	}

	return (
		<div className="relative mt-2 max-w-full">
			{/* Wraps instead of scrolling: a scroll region would need to be
			    keyboard-focusable (axe scrollable-region-focusable). */}
			<pre className="border-hairline rounded border py-2 ps-3 pe-10 text-[0.8rem] wrap-anywhere whitespace-pre-wrap">
				<code ref={codeRef}>{code}</code>
			</pre>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				aria-label={m.copyButton}
				title={m.copyButton}
				className="absolute inset-e-1 top-1 size-7 rounded-md p-0 opacity-60 hover:opacity-100 focus-visible:opacity-100"
				onClick={() => void copy()}
			>
				{copied ? (
					<Check aria-hidden="true" className="text-brand-deep size-4" />
				) : (
					<Copy aria-hidden="true" className="size-4" />
				)}
			</Button>
			{/* Screen readers still hear the confirmation via this hidden live region. */}
			<span aria-live="polite" className="sr-only">
				{copied ? m.copiedAnnounce : ""}
			</span>
		</div>
	);
}
