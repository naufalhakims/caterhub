export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-8 w-40 animate-pulse rounded bg-stone-200" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-stone-200" />
        ))}
      </div>
    </main>
  );
}
