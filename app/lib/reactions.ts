/**
 * Reaction vocabulary: a fixed emoji palette, nothing more. A reaction is a
 * `type` (the stable wire/DB value) rendered as its emoji — deliberately no
 * attached message, so the emotion stays the sender's own. The i18n
 * `reactionLabels` are accessible names for screen readers, not captions.
 *
 * Adding a type costs no creativity: the id is a plain English word for the
 * emoji, plus one accessible label per locale. Emoji are placeholders for an
 * original illustration set; swap them here when the art exists.
 */

// Renamed pre-launch (2026-08); from here on the ids are frozen wire/DB
// values — reaction_counts.type rows key off them. The array order is the
// display order everywhere: the heart leads as the signature reaction.
export const REACTION_TYPES = ["heart", "like", "handshake", "blossom", "tea"] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

/** The signature reaction: QR defaults and poster presets lead with it. */
export const DEFAULT_REACTION: ReactionType = "heart";

/**
 * How long an undo stays available. One value: the server signs vouchers that
 * live this long, and the pressed chip taps back off for exactly the same
 * window — a split definition would leave chips offering undos the server has
 * already stopped honouring.
 */
export const UNDO_WINDOW_MS = 60_000;

export const REACTION_EMOJI: Record<ReactionType, string> = {
	heart: "❤️",
	like: "👍",
	handshake: "🤝",
	blossom: "🌸",
	tea: "🍵",
};

export function isReactionType(value: string): value is ReactionType {
	return (REACTION_TYPES as readonly string[]).includes(value);
}
