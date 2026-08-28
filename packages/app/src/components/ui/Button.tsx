import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.js";

export type ButtonVariant = "ghost" | "secondary" | "primary" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const button = cva(
	"inline-flex items-center gap-1.5 font-semibold border rounded-sm cursor-pointer leading-none whitespace-nowrap tracking-[0.005em] transition-[background,color,border-color,box-shadow] duration-[var(--t)] ease-[var(--ease)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
	{
		variants: {
			variant: {
				ghost:
					"bg-transparent border-transparent text-text-3 hover:bg-surface-3 hover:text-text",
				secondary:
					"bg-surface border-border-mid text-text-2 hover:bg-text hover:border-text hover:text-bg",
				primary:
					"bg-accent border-accent text-white hover:bg-text hover:border-text",
				danger:
					"bg-danger-dim border-danger-mid text-danger hover:bg-danger hover:border-danger hover:text-white",
			},
			size: {
				sm: "py-[5px] px-[11px] text-[12.5px]",
				md: "py-2 px-[15px] text-[13.5px]",
				lg: "py-2.5 px-5 text-sm",
			},
			icon: {
				true: "justify-center aspect-square p-0",
				false: "",
			},
		},
		compoundVariants: [
			{ icon: true, size: "sm", class: "w-7 h-7 text-sm" },
			{ icon: true, size: "md", class: "w-8 h-8 text-base" },
			{ icon: true, size: "lg", class: "w-[38px] h-[38px] text-lg" },
		],
		defaultVariants: { variant: "secondary", size: "md", icon: false },
	},
);

export interface ButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof button> {
	children: ReactNode;
}

export function Button({
	variant = "secondary",
	size = "md",
	className,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(button({ variant, size, icon: false }), className)}
			{...props}
		>
			{children}
		</button>
	);
}

/** Icon-only button — square, no label. Same variants/sizes as Button. */
export function IconButton({
	variant = "ghost",
	size = "sm",
	className,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(button({ variant, size, icon: true }), className)}
			{...props}
		>
			{children}
		</button>
	);
}
