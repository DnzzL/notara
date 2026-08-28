import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.js";

/**
 * A row in a dropdown or a popover menu.
 *
 * This exact class string was copy-pasted eight times in WorkspaceSwitcher
 * alone, plus a private `MENU_ITEM` constant in PageMenu and a near-identical
 * one in ViewSwitcher — which is how the three drifted apart on radius, padding
 * and hover colour.
 *
 * `active` uses the navigation language (accent tint + accent text), because a
 * menu row picks a *place* — a workspace, a saved view, a pane — rather than
 * toggling the mode of what you are already looking at. See ui/Tabs.tsx.
 */
const menuItem = cva(
	"flex items-center gap-2 w-full text-left cursor-pointer bg-transparent border-none [font-family:var(--font-ui)] rounded transition-[background,color] duration-[var(--t)] ease-[var(--ease)] disabled:opacity-50 disabled:cursor-not-allowed",
	{
		variants: {
			tone: {
				default: "text-text-2 hover:bg-surface-3 hover:text-text",
				danger: "text-text-2 hover:bg-danger-dim hover:text-danger",
			},
			size: {
				sm: "px-2.5 py-1 text-[12.5px]",
				md: "px-2.5 py-[7px] text-[13px]",
			},
			active: { true: "bg-accent-dim text-accent-2 font-medium", false: "" },
		},
		defaultVariants: { tone: "default", size: "md", active: false },
	},
);

export interface MenuItemProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">,
		VariantProps<typeof menuItem> {
	children: ReactNode;
	/** Rendered before the label — an icon, an emoji, an avatar. */
	leading?: ReactNode;
	/** Rendered pushed to the far right — a shortcut, a checkmark, a count. */
	trailing?: ReactNode;
}

export function MenuItem({
	tone,
	size,
	active,
	leading,
	trailing,
	className,
	children,
	...props
}: MenuItemProps) {
	return (
		<button
			type="button"
			className={cn(menuItem({ tone, size, active }), className)}
			{...props}
		>
			{leading}
			<span className="min-w-0 truncate">{children}</span>
			{trailing && <span className="ml-auto shrink-0">{trailing}</span>}
		</button>
	);
}
