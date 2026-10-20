"use client";

import { useRef, useState } from "react";
import { formatIDRInput } from "@/lib/money";

type Props = {
  name: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** "bare" untuk dipakai di dalam field gabungan tanpa border sendiri. */
  variant?: "default" | "bare";
};

function digitsOf(value: string): string {
  // Buang nol di depan, tapi sisakan satu digit bila semuanya nol.
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

/**
 * Input rupiah dengan format otomatis (id-ID: 10.000).
 * Nilai yang dikirim ke server selalu angka murni lewat hidden input,
 * sehingga tidak ada parsing format di sisi bisnis.
 */
export function RupiahInput({
  name,
  defaultValue = 0,
  placeholder = "0",
  required,
  className = "",
  id,
  disabled,
  variant = "default",
}: Props) {
  const initial = digitsOf(String(defaultValue ?? ""));
  const [display, setDisplay] = useState(initial ? formatIDRInput(initial) : "");
  const [raw, setRaw] = useState(initial);
  const visibleRef = useRef<HTMLInputElement>(null);

  function commit(nextRaw: string, digitCursor: number) {
    const formatted = formatIDRInput(nextRaw);
    setRaw(nextRaw);
    setDisplay(formatted);
    // Kembalikan posisi kursor berdasarkan jumlah digit di kirinya.
    requestAnimationFrame(() => {
      const el = visibleRef.current;
      if (!el) return;
      let pos = 0;
      let seen = 0;
      while (pos < formatted.length && seen < digitCursor) {
        if (/\d/.test(formatted[pos])) seen++;
        pos++;
      }
      el.setSelectionRange(pos, pos);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = el.value.slice(0, caret).replace(/\D/g, "").length;
    const nextRaw = digitsOf(el.value);
    // Kursor tidak boleh melampaui jumlah digit yang tersisa.
    commit(nextRaw, Math.min(digitsBefore, nextRaw.length));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Backspace") return;
    const el = e.currentTarget;
    const caret = el.selectionStart ?? 0;
    const collapsed = caret === (el.selectionEnd ?? caret);
    if (!collapsed || caret === 0) return;
    // Jika karakter sebelum kursor adalah pemisah ribuan, hapus digit sebelumnya
    // agar Backspace terasa natural (tidak "nyangkut" di titik).
    if (/\d/.test(el.value[caret - 1] ?? "")) return;
    const left = el.value.slice(0, caret);
    const digitIndexes = [...left].map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0);
    if (digitIndexes.length === 0) return;
    e.preventDefault();
    const removeAt = digitIndexes[digitIndexes.length - 1];
    const nextValue = el.value.slice(0, removeAt) + el.value.slice(removeAt + 1);
    const nextRaw = digitsOf(nextValue);
    const digitsBefore = nextValue.slice(0, removeAt).replace(/\D/g, "").length;
    commit(nextRaw, digitsBefore);
  }

  const bare = variant === "bare";
  return (
    <span className="relative block">
      <span
        className={`pointer-events-none absolute inset-y-0 flex items-center text-sm font-medium text-stone-400 ${
          bare ? "left-0 pr-1" : "left-3"
        }`}
      >
        Rp
      </span>
      <input type="hidden" name={name} value={raw} />
      <input
        ref={visibleRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-label={name}
        className={
          bare
            ? `w-full bg-transparent py-0 pl-6 text-sm font-medium outline-none placeholder:text-stone-300 ${className}`
            : `w-full rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-stone-100 ${className}`
        }
      />
    </span>
  );
}
