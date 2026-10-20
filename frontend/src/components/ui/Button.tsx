import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", ...rest },
  ref,
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  const styles = {
    primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 hover:shadow",
    secondary: "bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-100",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
    ghost: "text-stone-600 hover:bg-stone-200/70",
  } as const;
  return <button ref={ref} className={`${base} ${styles[variant]} ${className}`} {...rest} />;
});
