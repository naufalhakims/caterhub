export function SectionHeading({
  eyebrow,
  title,
  hint,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div>
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</p>
      )}
      <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {hint && <p className="mt-2 max-w-2xl text-sm text-stone-600">{hint}</p>}
    </div>
  );
}
