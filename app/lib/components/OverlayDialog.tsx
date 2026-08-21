// The house dialog shell — every overlay dialog (create/edit confirmations,
// the embed snippet) shares this frame, so a styling change lands once.
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/lib/components/ui/dialog";

export function OverlayDialog({
	open,
	onOpenChange,
	title,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined} className="border-hairline">
				<DialogHeader>
					<DialogTitle className="text-[1rem]">{title}</DialogTitle>
				</DialogHeader>
				{children}
			</DialogContent>
		</Dialog>
	);
}
