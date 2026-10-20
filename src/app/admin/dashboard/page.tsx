import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatIDR } from "@/lib/format";
import { db } from "@/lib/db";

export default async function AdminDashboard() {
  const [users, vendors, pendingVendors, bookings, revenue] = await Promise.all([
    db.user.count(),
    db.vendorProfile.count({ where: { verificationStatus: "VERIFIED" } }),
    db.vendorProfile.count({ where: { verificationStatus: "PENDING" } }),
    db.booking.count(),
    db.payment.aggregate({ where: { status: "SETTLEMENT" }, _sum: { amount: true } }),
  ]);
  const kpis = [
    { label: "Pengguna", value: String(users), icon: "○", bg: "bg-stone-100 text-stone-700 ring-stone-200" },
    { label: "Vendor terverifikasi", value: String(vendors), icon: "✓", bg: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    { label: "Menunggu verifikasi", value: String(pendingVendors), icon: "◷", bg: "bg-amber-50 text-amber-700 ring-amber-100" },
    { label: "Total pesanan", value: String(bookings), icon: "▣", bg: "bg-blue-50 text-blue-700 ring-blue-100" },
    { label: "Transaksi lunas", value: formatIDR(revenue._sum.amount ?? 0), icon: "◈", bg: "bg-brand-50 text-brand-700 ring-brand-100" },
  ];
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Ringkasan platform</h1>
      <p className="text-sm text-stone-500">Kesehatan marketplace sekilas.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className="!p-4">
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${k.bg}`}>{k.icon}</span>
              <div>
                <p className="text-xl font-extrabold">{k.value}</p>
                <p className="text-xs text-stone-500">{k.label}</p>
              </div>
            </div>
          </Card>
        ))}
        {pendingVendors > 0 && (
          <Link href="/admin/vendors">
            <Card className="flex h-full items-center justify-between !border-amber-200 !bg-amber-50 !p-4 transition hover:shadow-lift">
              <p className="text-sm font-semibold text-amber-900">{pendingVendors} vendor menunggu verifikasi</p>
              <span className="text-amber-700">→</span>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
