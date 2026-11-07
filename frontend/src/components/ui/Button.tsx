import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "dark" | "danger" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Tampilkan panah → di sisi kanan (gaya CTA utama). */
  arrow?: boolean;
};

/**
 * Tombol pil. Umpan balik muncul saat ditekan (bukan saat dilepas) dan hanya
 * menganimasikan transform/warna; durasi tekan lebih pendek dari durasi lepas.
 */
export const buttonBase =
  "inline-flex select-none items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold " +
  "transition-[transform,background-color,box-shadow,color] duration-200 ease-fluid " +
  "active:scale-[.97] active:duration-75 motion-reduce:active:scale-100 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-sun-400 text-ink hover:bg-sun-300",
  secondary: "bg-white text-ink ring-1 ring-inset ring-stone-300 hover:ring-ink",
  dark: "bg-ink text-white hover:bg-stone-800",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-stone-600 hover:bg-stone-100 hover:text-ink",
};

export function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", arrow = false, className = "", children, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={`${buttonBase} ${buttonVariants[variant]} ${arrow ? "group/btn !pr-4" : ""} ${className}`} {...rest}>
      {children}
      {arrow && <ArrowRight className="ml-3 transition-transform duration-300 ease-fluid group-hover/btn:translate-x-0.5" />}
    </button>
  );
});

/** Kelas tautan bergaya tombol (untuk <Link>). */
export function buttonLink(variant: ButtonVariant = "primary", extra = "") {
  return `${buttonBase} ${buttonVariants[variant]} ${extra}`;
}

/** Indikator proses kecil; diam bila reduced-motion. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none ${className}`}
    />
  );
}
