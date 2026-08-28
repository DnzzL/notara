import { cva, type VariantProps } from "class-variance-authority";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "./cn.js";

/**
 * The one focus treatment.
 *
 * The app had five: a global `outline`, a compliant ring in four CSS rules, a
 * bare `focus:border-accent` with no ring at all (which the design doc names as
 * a mistake), a 2px ring, and an inline outline duplicating the global one.
 * docs/design-system.md specifies border + a 3px accent-dim ring; that lives
 * here now, once.
 */
const field = cva(
	"w-full bg-surface border text-text font-[inherit] rounded-sm transition-[border-color,box-shadow] duration-[var(--t)] ease-[var(--ease)] outline-none placeholder:text-text-3 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed",
	{
		variants: {
			size: {
				sm: "px-[7px] py-[3px] text-[12px]",
				md: "px-[11px] py-[7px] text-[13px]",
				lg: "px-[13px] py-[11px] text-sm",
			},
			invalid: {
				true: "border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-dim)]",
				false: "border-border-mid",
			},
		},
		defaultVariants: { size: "md", invalid: false },
	},
);

export interface InputProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
		VariantProps<typeof field> {}

export function Input({ size, invalid, className, ...props }: InputProps) {
	return (
		<input className={cn(field({ size, invalid }), className)} {...props} />
	);
}

export interface SelectProps
	extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">,
		VariantProps<typeof field> {}

export function Select({ size, invalid, className, ...props }: SelectProps) {
	return (
		<select
			className={cn(field({ size, invalid }), "cursor-pointer", className)}
			{...props}
		/>
	);
}
