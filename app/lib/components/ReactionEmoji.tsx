// The one emoji renderer: visible glyph, accessible name — never a caption.
import { REACTION_EMOJI } from "~/lib/reactions";
import type { ReactionType } from "~/lib/reactions";

export function ReactionEmoji({ type, label }: { type: ReactionType; label: string }) {
	return (
		// A text glyph cannot be an <img> element; span[role="img"] with an
		// aria-label is the canonical accessible-emoji pattern.
		// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
		<span role="img" aria-label={label}>
			{REACTION_EMOJI[type]}
		</span>
	);
}
