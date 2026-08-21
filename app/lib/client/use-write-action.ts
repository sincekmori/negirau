/**
 * The first-party write flow shared by the create and edit pages: mount the
 * Turnstile widget, mint a token per submit, send JSON through react-router's
 * data protocol (a raw fetch to a page route would get the rendered document
 * back, not the action's JSON), and map refusals to user-facing copy.
 * Success is the caller's to read from `data` — each action names its own key.
 */

import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { mountTurnstile } from "~/lib/client/turnstile";
import type { TokenProvider } from "~/lib/client/turnstile";
import type { Messages } from "~/lib/i18n";

interface WriteData {
	ok?: boolean;
	id?: string;
	error?: string;
}

interface WriteTarget {
	method: "POST" | "PATCH" | "DELETE";
	action: string;
}

export function useWriteAction(args: { siteKey: string; m: Messages; failed: string }) {
	const hostRef = useRef<HTMLDivElement>(null);
	const tokens = useRef<TokenProvider | undefined>(undefined);
	const fetcher = useFetcher<WriteData>();
	const [taking, setTaking] = useState(false);
	const [localNotice, setLocalNotice] = useState<string | undefined>(undefined);

	useEffect(() => {
		if (hostRef.current) {
			// The site key never changes within a page, so this mounts once.
			tokens.current = mountTurnstile(hostRef.current, args.siteKey);
		}
	}, [args.siteKey]);

	// `taking` covers the token mint; the fetcher covers the submission. The
	// awaited submit overlaps them — deliberately belt and braces, so a gap in
	// either signal can never re-enable the button mid-flight.
	const submitting = taking || fetcher.state !== "idle";

	function notice(): string | undefined {
		if (submitting) {
			return undefined;
		}
		if (localNotice !== undefined) {
			return localNotice;
		}
		if (fetcher.data === undefined || fetcher.data.ok === true) {
			return undefined;
		}
		return fetcher.data.error === "rate_limited" ? args.m.noticeRateLimited : args.failed;
	}

	async function submit(payload: Record<string, unknown>, target: WriteTarget): Promise<void> {
		if (submitting || !tokens.current) {
			return;
		}
		setTaking(true);
		setLocalNotice(undefined);
		try {
			const token = await tokens.current.take();
			await fetcher.submit({ ...payload, token }, { ...target, encType: "application/json" });
		} catch {
			setLocalNotice(args.m.noticeNetworkFailed);
		} finally {
			setTaking(false);
		}
	}

	return {
		/** Attach to the fixed host div the widget renders into. */
		hostRef,
		submitting,
		notice: notice(),
		/** The action's settled verdict; undefined while anything is in flight. */
		data: fetcher.state === "idle" ? fetcher.data : undefined,
		submit,
		clearNotice: () => setLocalNotice(undefined),
	};
}
