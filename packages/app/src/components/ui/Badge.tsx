import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "./cn.js";

/**
 * A small label that carries state or metadata.
 *
 * `dot` is the default for a single value: a value that already reads from its
 * colour does not also need a pill around it. Reserve the filled variants for
 * places where several values sit side by side and each needs a boundary.
 */
const badge = cva(
	"inline-flex items-center gap-1.5 whitespace-nowrap leading-5 text-[12.5px]",
	{
		variants: {
			variant: {
				dot: "text-text-2",
				neutral: "bg-surface-3 text-text-2 px-[7px] rounded-sm",
				accent: "bg-accent-dim text-accent-2 px-[7px] rounded-sm",
				danger: "bg-danger-dim text-danger px-[7px] rounded-sm",
				outline:
					"border border-border text-text-2 px-[7px] rounded-sm bg-transparent",
			},
		},
		defaultVariants: { variant: "neutral" },
	},
);

export interface BadgeProps extends VariantProps<typeof badge> {
	children: ReactNode;
	/** Colour of the leading dot. Omit for no dot. */
	dotColor?: string;
	className?: string;
	title?: string;
}

export function Badge({
	variant,
	dotColor,
	className,
	children,
	title,
}: BadgeProps) {
	return (
		<span className={cn(badge({ variant }), className)} title={title}>
			{dotColor && (
				<i
					className="w-1.5 h-1.5 rounded-full shrink-0"
					style={{ background: dotColor }}
				/>
			)}
			{children}
		</span>
	);
}
