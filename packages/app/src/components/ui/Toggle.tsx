import { cn } from "./cn.js";

export interface ToggleProps {
	checked: boolean;
	onChange: () => void;
	disabled?: boolean;
	/** Accessible label. */
	label?: string;
	/** Smaller variant for inline use. */
	size?: "sm" | "md";
}

export function Toggle({
	checked,
	onChange,
	disabled,
	label,
	size = "md",
}: ToggleProps) {
	const sizeStyles =
		size === "sm"
			? {
					track: "h-[22px] w-[38px]",
					thumb: "h-[18px] w-[18px]",
					translate: "translateX(16px)",
				}
			: {
					track: "h-[26px] w-[46px]",
					thumb: "h-[22px] w-[22px]",
					translate: "translateX(20px)",
				};

	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={onChange}
			className={cn(
				"relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent",
				"transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
				checked ? "bg-accent" : "bg-border-mid",
				disabled && "opacity-50 cursor-not-allowed",
				sizeStyles.track,
			)}
		>
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none inline-block rounded-full bg-white shadow-sm",
					"transition duration-200 ease-in-out",
					sizeStyles.thumb,
				)}
				style={{ transform: checked ? sizeStyles.translate : "translateX(0)" }}
			/>
		</button>
	);
}
