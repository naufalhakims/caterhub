export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Kartu yang bisa diklik: terangkat saat hover, mengecil sedikit saat ditekan. */
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-stone-200 bg-white p-5 ${
        interactive ? "pressable hover:shadow-lift" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-paper p-10 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  REQUESTED: "bg-amber-100 text-amber-800 ring-amber-200",
  DECLINED: "bg-red-100 text-red-800 ring-red-200",
  DRAFT: "bg-stone-100 text-stone-600 ring-stone-200",
  SENT: "bg-blue-100 text-blue-800 ring-blue-200",
  QUOTATION_SENT: "bg-blue-100 text-blue-800 ring-blue-200",
  QUOTATION_PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  REVISION_REQUESTED: "bg-purple-100 text-purple-800 ring-purple-200",
  ACCEPTED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CONFIRMED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  PAYMENT_PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  PAID: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  SETTLEMENT: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-red-100 text-red-800 ring-red-200",
  FAILED: "bg-red-100 text-red-800 ring-red-200",
  CANCELLED: "bg-red-100 text-red-800 ring-red-200",
  EXPIRED: "bg-stone-200 text-stone-600 ring-stone-300",
  VERIFIED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  UNDER_REVIEW: "bg-sky-100 text-sky-800 ring-sky-200",
  NEEDS_INFO: "bg-orange-100 text-orange-800 ring-orange-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  PREPARING: "bg-sky-100 text-sky-800 ring-sky-200",
  READY: "bg-sky-100 text-sky-800 ring-sky-200",
  DELIVERED: "bg-sky-100 text-sky-800 ring-sky-200",
  REFUND_PENDING: "bg-orange-100 text-orange-800 ring-orange-200",
  REFUNDED: "bg-stone-200 text-stone-700 ring-stone-300",
};

const badgeLabels: Record<string, string> = {
  CUSTOMER: "Pelanggan",
  VENDOR: "Vendor",
  ADMIN: "Admin",
  PENDING: "Menunggu",
  REQUESTED: "Menunggu Konfirmasi",
  DECLINED: "Ditolak Vendor",
  DRAFT: "Draf",
  SENT: "Terkirim",
  QUOTATION_PENDING: "Menunggu Penawaran",
  QUOTATION_SENT: "Penawaran Terkirim",
  REVISION_REQUESTED: "Minta Revisi",
  ACCEPTED: "Dikonfirmasi",
  CONFIRMED: "Dikonfirmasi",
  PAYMENT_PENDING: "Menunggu Pembayaran",
  PAID: "Lunas",
  SETTLEMENT: "Lunas",
  REJECTED: "Ditolak",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
  VERIFIED: "Terverifikasi",
  UNDER_REVIEW: "Sedang Ditinjau",
  NEEDS_INFO: "Perlu Perbaikan",
  COMPLETED: "Selesai",
  PREPARING: "Dipersiapkan",
  READY: "Siap",
  DELIVERED: "Terkirim",
  REFUND_PENDING: "Menunggu Refund",
  REFUNDED: "Dana Dikembalikan",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeStyles[status] ?? "bg-stone-100 text-stone-600 ring-stone-200"}`}
    >
      {badgeLabels[status] ?? status}
    </span>
  );
}
