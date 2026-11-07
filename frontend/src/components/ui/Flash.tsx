"use client";

import { useEffect, useState } from "react";

type Props = { ok?: string; error?: string };

const DISMISS_MS = { ok: 4500, error: 9000 } as const;

/**
 * Toast hasil aksi (status "selesai" / "error") dari parameter `?ok=` / `?error=`.
 * - Diumumkan pembaca layar lewat aria-live.
 * - Parameter dibersihkan dari URL tanpa render ulang, agar refresh/back tidak
 *   menampilkan pesan lama.
 * - Muncul dan pergi lewat jalur yang sama (dari atas).
 */
export function Flash({ ok, error }: Props) {
  const message = error || ok;
  const tone = error ? "error" : "ok";
  const [phase, setPhase] = useState<"in" | "out" | "gone">(message ? "in" : "gone");

  useEffect(() => {
    if (!message) return;
    setPhase("in");

    const url = new URL(window.location.href);
    if (url.searchParams.has("ok") || url.searchParams.has("error")) {
      url.searchParams.delete("ok");
      url.searchParams.delete("error");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }

    const hide = window.setTimeout(() => setPhase("out"), DISMISS_MS[tone]);
    return () => window.clearTimeout(hide);
  }, [message, tone]);

  if (!message || phase === "gone") return null;

  const styles =
    tone === "error"
      ? "bg-red-50/95 text-red-800 ring-red-200"
      : "bg-emerald-50/95 text-emerald-800 ring-emerald-200";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
      <div
        role={tone === "error" ? "alert" : "status"}
        aria-live={tone === "error" ? "assertive" : "polite"}
        onAnimationEnd={() => phase === "out" && setPhase("gone")}
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lift ring-1 ring-inset backdrop-blur ${styles} ${
          phase === "out" ? "animate-toast-out" : "animate-toast-in"
        }`}
      >
        <span aria-hidden className="mt-px font-bold">
          {tone === "error" ? "!" : "✓"}
        </span>
        <p className="min-w-0 flex-1">{message}</p>
        <button
          type="button"
          onClick={() => setPhase("out")}
          className="-m-1 rounded-lg p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
          aria-label="Tutup pesan"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
