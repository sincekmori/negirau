// The listed/link-only choice, shared by the create and edit flows. Listed
// first: public is the default, link-only the deliberate opt-out.
import { pillClass } from "~/lib/components/pill";
import type { Messages } from "~/lib/i18n";

const VISIBILITY_OPTIONS = [true, false] as const;

export function VisibilityPills({
	listed,
	onChange,
	m,
}: {
	listed: boolean;
	onChange: (listed: boolean) => void;
	m: Messages;
}) {
	return (
		<fieldset aria-label={m.createVisibilityLegend} className="flex flex-wrap gap-1">
			{VISIBILITY_OPTIONS.map((candidate) => (
				<label
					key={String(candidate)}
					className={`cursor-pointer ${pillClass(listed === candidate)}`}
				>
					<input
						type="radio"
						name="visibility"
						checked={listed === candidate}
						onChange={() => onChange(candidate)}
						className="sr-only"
					/>
					{candidate ? m.visibilityListed : m.visibilityUnlisted}
				</label>
			))}
		</fieldset>
	);
}
