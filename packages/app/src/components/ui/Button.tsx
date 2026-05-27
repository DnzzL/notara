import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "ghost" | "secondary" | "primary" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, `btn-${size}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} {...props}>
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
  const classes = ["btn", "btn-icon", `btn-${variant}`, `btn-${size}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
