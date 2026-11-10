import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatIDR } from "@/lib/format";
import { apiGet } from "@/lib/api";

type AdminDashboardData = {
  users: number;
  verified: number;
  pending: number;
  bookings: number;
  revenue: number;
  refunds: number;
};

export default async function AdminDashboard() {
  const stats = await apiGet<AdminDashboardData>("/api/v1/admin/dashboard");
  const users = stats.users;
  const vendors = stats.verified;
  const pendingVendors = stats.pending;
  const bookings = stats.bookings;
  const revenue = { _sum: { amount: stats.revenue } };
  const kpis = [
    { label: "Pengguna", value: String(users) },
    { label: "Vendor terverifikasi", value: String(vendors) },
    { label: "Menunggu verifikasi", value: String(pendingVendors) },
    { label: "Total pesanan", value: String(bookings) },
    { label: "Transaksi lunas", value: formatIDR(revenue._sum.amount ?? 0) },
  ];
  return (
    <div>
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Ringkasan platform</h1>
      <p className="text-sm text-stone-500">Kesehatan marketplace sekilas.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className="!p-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xl font-extrabold">{k.value}</p>
                <p className="text-xs text-stone-500">{k.label}</p>
              </div>
            </div>
          </Card>
        ))}
        {stats.refunds > 0 && (
          <Link href="/admin/orders?filter=refund" className="block">
            <Card interactive className="flex h-full items-center justify-between !border-orange-200 !bg-orange-50 !p-4">
              <p className="text-sm font-semibold text-orange-900">{stats.refunds} refund menunggu diproses</p>
              <span className="text-orange-700">→</span>
            </Card>
          </Link>
        )}
        {pendingVendors > 0 && (
          <Link href="/admin/vendors" className="block">
            <Card interactive className="flex h-full items-center justify-between !border-amber-200 !bg-amber-50 !p-4">
              <p className="text-sm font-semibold text-amber-900">{pendingVendors} vendor menunggu verifikasi</p>
              <span className="text-amber-700">→</span>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
