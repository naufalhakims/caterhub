/**
 * Judul seksi bergaya editorial: serif besar, kata miring berwarna lewat <em>
 * di dalam `title`, opsional tanda pisah di akhir ("Temukan *pilihan* kami –").
 */
export function SectionHeading({
  eyebrow,
  title,
  hint,
  dash = false,
  align = "left",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  hint?: React.ReactNode;
  dash?: boolean;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-4xl text-center" : ""}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{eyebrow}</p>
      )}
      <h2 className="mt-2 font-display text-4xl text-ink sm:text-5xl">
        {title}
        {dash && <span className="text-stone-400"> –</span>}
      </h2>
      {hint && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-stone-600 serif-strong">{hint}</p>}
    </div>
  );
}
