// Light / dark / follow-the-system. next-themes owns the state: it resolves
// the stored choice before first paint (no flash) and tracks live system
// changes while in "system". The menu itself (Radix dropdown, a sizable
// shared chunk) loads on the first press; until then only this button ships.
import { MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";

import { Button } from "~/lib/components/ui/button";
import { messages } from "~/lib/i18n";
import type { Locale } from "~/lib/i18n";

/** The sun/moon pair — one fixed-size glyph before and after the menu mounts (zero CLS). */
export function ThemeToggleIcons() {
	return (
		<>
			<SunIcon className="size-4.5 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
			<MoonIcon className="absolute size-4.5 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
		</>
	);
}

export function ThemeToggle({ locale }: { locale: Locale }) {
	const m = messages(locale);
	const [menu, setMenu] = useState<ComponentType<{ locale: Locale }> | undefined>(undefined);
	async function engage(): Promise<void> {
		const module = await import("~/lib/components/ThemeToggleMenu");
		// A function value, or useState would call the component as an updater.
		setMenu(() => module.ThemeToggleMenu);
	}
	if (menu === undefined) {
		return (
			<Button
				variant="ghost"
				size="icon"
				aria-label={m.themeLabel}
				onPointerDown={() => void engage()}
				onClick={() => void engage()}
			>
				<ThemeToggleIcons />
			</Button>
		);
	}
	const Menu = menu;
	return <Menu locale={locale} />;
}
