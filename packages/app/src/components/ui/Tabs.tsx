import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "./cn.js";

/**
 * Two ways to be active, and the difference means something.
 *
 * The app used to express "active" six different ways — a solid accent fill, an
 * accent underline, a checkmark with no fill, a taupe panel tint, a rogue cyan
 * tint, and a black-alpha tint — for what was, mostly, the same idea. The rule
 * this component encodes:
 *
 *   toggle — you are switching the *mode* of the same content (Table / Board /
 *            Calendar all render the same records). Solid accent fill: the
 *            control is a switch and should read as thrown.
 *
 *   nav    — you are moving between *places* (a saved view, an admin pane, a
 *            page in the tree). Accent tint plus an accent marker. Quieter,
 *            because navigation is context, not an action you just took.
 *
 * Selection of data — a picked row, a chosen option — is a third thing and uses
 * an accent tint with no marker. It is not a tab, so it does not live here.
 */

const tabList = cva("inline-flex", {
	variants: {
		variant: {
			toggle: "bg-sb border border-border rounded p-0.5 gap-0",
			nav: "gap-0 border-b border-border",
		},
	},
	defaultVariants: { variant: "toggle" },
});

const tab = cva(
	"bg-transparent border-none cursor-pointer font-medium transition-[background,color,box-shadow] duration-[var(--t)] ease-[var(--ease)] whitespace-nowrap",
	{
		variants: {
			variant: { toggle: "py-1 px-3 rounded-sm", nav: "py-2 px-3" },
			active: { true: "", false: "" },
		},
		compoundVariants: [
			{ variant: "toggle", active: true, class: "bg-accent text-white" },
			{
				variant: "toggle",
				active: false,
				class: "text-text-3 hover:text-text-2",
			},
			{
				variant: "nav",
				active: true,
				class:
					"text-accent-2 bg-accent-dim shadow-[inset_0_-2px_0_var(--accent)]",
			},
			{ variant: "nav", active: false, class: "text-text-3 hover:text-text-2" },
		],
		defaultVariants: { variant: "toggle", active: false },
	},
);

export type TabsVariant = "toggle" | "nav";

export interface TabItem<T extends string> {
	value: T;
	label: ReactNode;
	title?: string;
}

export interface TabsProps<T extends string> {
	items: readonly TabItem<T>[];
	value: T;
	onChange: (value: T) => void;
	variant?: TabsVariant;
	size?: "sm" | "md";
	className?: string;
	"aria-label"?: string;
}

export function Tabs<T extends string>({
	items,
	value,
	onChange,
	variant = "toggle",
	size = "sm",
	className,
	...rest
}: TabsProps<T>) {
	return (
		<div
			className={cn(tabList({ variant }), className)}
			role="tablist"
			aria-label={rest["aria-label"]}
		>
			{items.map((item) => (
				<button
					key={item.value}
					type="button"
					role="tab"
					aria-selected={value === item.value}
					title={item.title}
					className={cn(
						tab({ variant, active: value === item.value }),
						size === "sm" ? "text-[12px]" : "text-[13px]",
					)}
					onClick={() => onChange(item.value)}
				>
					{item.label}
				</button>
			))}
		</div>
	);
}
