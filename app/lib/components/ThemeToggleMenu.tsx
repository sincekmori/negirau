// The theme menu proper — split from ThemeToggle so Radix's dropdown chunk
// (~53 KB shared by every page via the shell) loads on first use instead of
// on every page view. Mounted defaultOpen: by the time this file loads, the
// visitor has already pressed the trigger.
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { ThemeToggleIcons } from "~/lib/components/ThemeToggle";
import { Button } from "~/lib/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "~/lib/components/ui/dropdown-menu";
import { messages } from "~/lib/i18n";
import type { Locale } from "~/lib/i18n";

export function ThemeToggleMenu({ locale }: { locale: Locale }) {
	const m = messages(locale);
	const { theme, setTheme } = useTheme();
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label={m.themeLabel}>
					<ThemeToggleIcons />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
					<DropdownMenuRadioItem value="light">
						<SunIcon className="size-4" />
						{m.themeLight}
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="dark">
						<MoonIcon className="size-4" />
						{m.themeDark}
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="system">
						<MonitorIcon className="size-4" />
						{m.themeSystem}
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
