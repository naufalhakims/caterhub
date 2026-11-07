/** Wordmark serif "caterhub." dengan titik jeruk — padanan logo referensi. */
export function Logo({ className = "", tone = "ink" }: { className?: string; tone?: "ink" | "sun" }) {
  return (
    <span
      className={`font-display leading-none ${tone === "sun" ? "text-sun-400" : "text-ink"} ${className}`}
      aria-label="CaterHub"
    >
      caterhub<span className="text-tangerine">.</span>
    </span>
  );
}
