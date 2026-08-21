// The one sharing hub: the device share sheet where it exists, share intents
// with a prefilled post, a plain link copy, the printable poster, and the
// website embed — feedback is the icon itself, never a moving line of text.
import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { canShareNatively, copyText, shareNatively } from "~/lib/client/share";
import { useCopiedFlag } from "~/lib/client/use-copied-flag";
import { Button } from "~/lib/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/lib/components/ui/dropdown-menu";
import type { messages } from "~/lib/i18n";

/** Share intents with a prefilled post where the service supports one. */
function intentTargets(text: string, url: string): { label: string; href: string }[] {
	const encodedText = encodeURIComponent(text);
	const encodedUrl = encodeURIComponent(url);
	// Bluesky's composer takes text only; the URL rides inside it.
	const encodedTextWithUrl = encodeURIComponent(`${text}\n${url}`);
	return [
		{ label: "X", href: `https://x.com/intent/post?text=${encodedText}&url=${encodedUrl}` },
		{ label: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}` },
		{
			label: "Threads",
			href: `https://www.threads.com/intent/post?text=${encodedText}&url=${encodedUrl}`,
		},
		{ label: "Bluesky", href: `https://bsky.app/intent/compose?text=${encodedTextWithUrl}` },
		{
			label: "Facebook",
			href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
		},
		{
			label: "Hatena Bookmark",
			href: `https://b.hatena.ne.jp/entry/panel/?url=${encodedUrl}`,
		},
	];
}

export function ShareMenu({
	name,
	pageUrl,
	posterHref,
	onOpenEmbed,
	m,
}: {
	name: string;
	pageUrl: string;
	posterHref: string;
	onOpenEmbed: () => void;
	m: ReturnType<typeof messages>;
}) {
	const { copied, confirm } = useCopiedFlag();
	// The menu opens only on the client, so the sheet item can decide at
	// open time; no state, no hydration mismatch.
	const [open, setOpen] = useState(false);
	const text = m.shareText(name);

	async function copyLink(): Promise<void> {
		if (await copyText(pageUrl)) {
			confirm();
		}
	}

	return (
		<DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="border-hairline">
					{copied ? (
						<Check aria-hidden="true" className="text-brand-deep size-4" />
					) : (
						<Share2 aria-hidden="true" className="size-4" />
					)}
					{m.shareButton}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				{open && canShareNatively() && (
					<DropdownMenuItem onSelect={() => void shareNatively(text, pageUrl)}>
						{m.shareNative}
					</DropdownMenuItem>
				)}
				{intentTargets(text, pageUrl).map((target) => (
					<DropdownMenuItem key={target.label} asChild>
						<a href={target.href} target="_blank" rel="external noopener">
							{target.label}
						</a>
					</DropdownMenuItem>
				))}
				<DropdownMenuItem onSelect={() => void copyLink()}>{m.shareCopyLink}</DropdownMenuItem>
				{/* Beyond links: the printable poster and the website embed live
				    here too — one hub for every way this page travels. */}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to={posterHref}>{m.printPoster}</Link>
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={onOpenEmbed}>{m.embedSummary}</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
