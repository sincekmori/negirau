// Official heart-pin icon, outline version; the stroke geometry
// lives in ~/lib/brand so every renderer draws the same mark.
import { HEART_PIN_DOT, HEART_PIN_OUTLINE_PATH } from "~/lib/brand";

export function BrandIcon({ size = 24 }: { size?: number }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={HEART_PIN_OUTLINE_PATH} />
			<circle cx={HEART_PIN_DOT.cx} cy={HEART_PIN_DOT.cy} r={HEART_PIN_DOT.r} />
		</svg>
	);
}
