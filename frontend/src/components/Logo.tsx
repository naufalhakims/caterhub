/** Ikon CaterHub: tudung saji (cloche) dengan kenop jeruk, sama dengan favicon `app/icon.svg`. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#FBE734" />
      <path d="M7 21.5a9 9 0 0 1 18 0z" fill="#1D1B16" />
      <rect x="5" y="22.5" width="22" height="2.6" rx="1.3" fill="#1D1B16" />
      <circle cx="16" cy="10.6" r="2" fill="#EE5A1F" />
    </svg>
  );
}

/** Logo: ikon + wordmark serif "caterhub." dengan titik jeruk. */
export function Logo({
  className = "",
  tone = "ink",
  mark = true,
}: {
  className?: string;
  tone?: "ink" | "sun";
  mark?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-[0.3em] font-display leading-none ${tone === "sun" ? "text-sun-400" : "text-ink"} ${className}`}
      aria-label="CaterHub"
    >
      {mark && <LogoMark className="h-[0.95em] w-[0.95em] shrink-0" />}
      <span>
        caterhub<span className="text-tangerine">.</span>
      </span>
    </span>
  );
}
