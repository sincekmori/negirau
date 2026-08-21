// The one action-button skin: squared with a leading icon. A control that
// DOES something never shares the pill silhouette of choices — pills are for
// picking, corners are for acting.
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/lib/components/ui/button";

interface ActionButtonProps {
	icon: LucideIcon;
	children: React.ReactNode;
	/** Renders as an internal link. */
	to?: string;
	/** Renders as a plain anchor (mailto, external). */
	href?: string;
	type?: "button" | "submit";
	onClick?: () => void;
	disabled?: boolean;
	size?: React.ComponentProps<typeof Button>["size"];
	variant?: React.ComponentProps<typeof Button>["variant"];
	className?: string;
}

export function ActionButton({
	icon: Icon,
	children,
	to,
	href,
	type = "button",
	onClick,
	disabled,
	size,
	variant,
	className,
}: ActionButtonProps) {
	const content = (
		<>
			<Icon aria-hidden="true" className="size-4" />
			{children}
		</>
	);
	if (to !== undefined) {
		return (
			<Button asChild size={size} variant={variant} className={className}>
				<Link to={to}>{content}</Link>
			</Button>
		);
	}
	if (href !== undefined) {
		return (
			<Button asChild size={size} variant={variant} className={className}>
				<a href={href}>{content}</a>
			</Button>
		);
	}
	return (
		<Button
			type={type}
			onClick={onClick}
			disabled={disabled}
			size={size}
			variant={variant}
			className={className}
		>
			{content}
		</Button>
	);
}
