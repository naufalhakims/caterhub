export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-8 w-56 animate-pulse rounded bg-stone-200" />
      <div className="mt-4 h-24 animate-pulse rounded-xl bg-stone-200" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-stone-200" />
        ))}
      </div>
    </main>
  );
}
