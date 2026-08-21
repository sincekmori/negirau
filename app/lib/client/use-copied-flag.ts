// The shared "copied ✓" feedback: a flag that confirms in place and clears
// itself — including on unmount, so no timer outlives its component.
import { useEffect, useRef, useState } from "react";

const COPIED_RESET_MS = 2000;

export function useCopiedFlag(): { copied: boolean; confirm: () => void } {
	const [copied, setCopied] = useState(false);
	const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => () => clearTimeout(resetTimer.current), []);

	function confirm(): void {
		setCopied(true);
		clearTimeout(resetTimer.current);
		resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
	}

	return { copied, confirm };
}
