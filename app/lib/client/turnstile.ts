/**
 * Turnstile widget loader for the browser. One widget per page; tokens are
 * single-use, so the widget is reset after each send to mint the next one.
 */

interface TurnstileApi {
	render: (
		container: HTMLElement,
		options: {
			sitekey: string;
			callback: (token: string) => void;
			"error-callback": () => void;
		},
	) => string;
	reset: (widgetId: string) => void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptLoading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
	scriptLoading ??= new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_SRC;
		script.async = true;
		script.addEventListener("load", () => {
			if (window.turnstile) {
				resolve(window.turnstile);
			} else {
				reject(new Error("turnstile api missing after load"));
			}
		});
		script.addEventListener("error", () => reject(new Error("failed to load turnstile")));
		// appendChild, not append: Workers' HTMLRewriter Element type merges into DOM Element
		// and shadows append()'s signature.
		document.head.appendChild(script);
	});
	return scriptLoading;
}

export interface TokenProvider {
	/** Resolves with a fresh single-use token — waiting for the script, the widget, and the mint. */
	take: () => Promise<string>;
}

/**
 * Mounts the widget and returns synchronously; take() awaits the mount, so an
 * early tap or submit waits instead of failing.
 */
export function mountTurnstile(container: HTMLElement, siteKey: string): TokenProvider {
	let pending: { resolve: (token: string) => void; reject: (error: Error) => void }[] = [];
	let stock: string | undefined;
	const ready = (async () => {
		const api = await loadTurnstile();
		const widgetId = api.render(container, {
			sitekey: siteKey,
			callback: (token) => {
				const waiter = pending.shift();
				if (waiter) {
					waiter.resolve(token);
				} else {
					stock = token;
				}
			},
			"error-callback": () => {
				for (const waiter of pending) {
					waiter.reject(new Error("turnstile error"));
				}
				pending = [];
			},
		});
		return { api, widgetId };
	})();
	return {
		take: async () => {
			const { api, widgetId } = await ready;
			if (stock !== undefined) {
				const token = stock;
				stock = undefined;
				return token;
			}
			return new Promise((resolve, reject) => {
				pending.push({ resolve, reject });
				api.reset(widgetId);
			});
		},
	};
}
