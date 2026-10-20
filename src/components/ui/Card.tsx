export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200/80 bg-white p-5 shadow-soft ${className}`}>
      {children}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-10 text-center">
      <p className="font-semibold text-stone-800">{title}</p>
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
};

const badgeLabels: Record<string, string> = {
  CUSTOMER: "Pelanggan",
  VENDOR: "Vendor",
  ADMIN: "Admin",
  PENDING: "Menunggu",
  REQUESTED: "Permintaan Baru",
  DECLINED: "Ditolak Vendor",
  DRAFT: "Draf",
  SENT: "Terkirim",
  QUOTATION_PENDING: "Menunggu Penawaran",
  QUOTATION_SENT: "Penawaran Terkirim",
  REVISION_REQUESTED: "Minta Revisi",
  ACCEPTED: "Diterima",
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
