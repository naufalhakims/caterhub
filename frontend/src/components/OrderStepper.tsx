const STEPS = [
  { key: "REQUESTED", label: "Permintaan", hint: "Menunggu konfirmasi vendor" },
  { key: "PAYMENT_PENDING", label: "Pembayaran", hint: "Lunasi sebelum batas waktu" },
  { key: "PAID", label: "Lunas", hint: "Vendor menjadwalkan produksi" },
  { key: "PREPARING", label: "Dimasak", hint: "Makanan sedang disiapkan" },
  { key: "READY", label: "Siap", hint: "Siap dikirim" },
  { key: "DELIVERED", label: "Terkirim", hint: "Sampai di lokasi acara" },
  { key: "COMPLETED", label: "Selesai", hint: "Terima kasih!" },
] as const;

/**
 * Penunjuk arah pesanan: "saya di mana, berikutnya apa". Langkah aktif diberi
 * label lengkap juga di layar kecil, dan `aria-current="step"` untuk pembaca layar.
 */
export function OrderStepper({ status }: { status: string }) {
  const normalized = status === "CONFIRMED" ? "PAYMENT_PENDING" : status;
  const current = STEPS.findIndex((s) => s.key === normalized);
  if (current < 0) return null;
  const active = STEPS[current];

  return (
    <nav aria-label="Tahap pesanan">
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < current;
          const isCurrent = i === current;
          return (
            <li
              key={step.key}
              className={`flex flex-col items-end gap-1.5 first:items-start ${i > 0 ? "flex-1" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex w-full items-center">
                {i > 0 && (
                  <span
                    className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ease-fluid ${
                      done || isCurrent ? "bg-emerald-500" : "bg-stone-200"
                    }`}
                  />
                )}
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-4 transition-colors duration-500 ease-fluid ${
                    done
                      ? "bg-emerald-500 text-white ring-emerald-100"
                      : isCurrent
                        ? "bg-brand-700 text-white ring-brand-100"
                        : "bg-stone-100 text-stone-400 ring-transparent"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
              </div>
              <span
                className={`hidden text-[11px] font-semibold leading-tight sm:block ${
                  isCurrent ? "text-stone-900" : done ? "text-stone-600" : "text-stone-400"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm">
        <span className="font-semibold text-stone-900">{active.label}</span>
        <span className="text-stone-500"> — {active.hint}</span>
      </p>
    </nav>
  );
}
