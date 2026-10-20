import Link from "next/link";
import { Card, StatusBadge } from "@/components/ui/Card";
import { formatIDR, formatDateID } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";

type VendorDashboard = {
  vendor: { businessName: string; verificationStatus: string };
  pendingQuotes: {
    id: string;
    status: string;
    total: number;
    event: { name: string; guestCount: number; eventDate: string };
  }[];
  upcoming: {
    id: string;
    status: string;
    event: { name: string; guestCount: number; eventDate: string; location: string };
  }[];
  recent: { id: string; status: string; totalAmount: number; event: { name: string } }[];
  pendingCount: number;
  revenue: number;
  orderTotal: number;
  todayAvail: { maxPax: number; reservedPax: number } | null;
};

function Kpi({ icon, bg, label, value, hint }: { icon: string; bg: string; label: string; value: string; hint?: string }) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${bg}`}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold">{value}</p>
          <p className="text-xs text-stone-500">{label}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-[11px] leading-snug text-stone-400">{hint}</p>}
    </Card>
  );
}

export default async function VendorDashboard() {
  await requireVendor();
  const { vendor: v, pendingQuotes, upcoming, revenue, orderTotal, recent, pendingCount, todayAvail } =
    await apiGet<VendorDashboard>("/api/v1/vendor/dashboard");

  const upcomingPax = upcoming.reduce((s, b) => s + b.event.guestCount, 0);
  const util =
    todayAvail && todayAvail.maxPax > 0
      ? Math.round((todayAvail.reservedPax / todayAvail.maxPax) * 100)
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Dasbor vendor</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{v.businessName}</h1>
        </div>
        {v.verificationStatus !== "VERIFIED" && <StatusBadge status={v.verificationStatus} />}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi icon="◈" bg="bg-emerald-50 text-emerald-700 ring-emerald-100" label="Pendapatan cair" value={formatIDR(revenue)} />
        <Kpi icon="◫" bg="bg-blue-50 text-blue-700 ring-blue-100" label="Acara mendatang" value={String(upcoming.length)} hint={upcomingPax > 0 ? `${upcomingPax} pax terjadwal` : undefined} />
        <Kpi icon="✎" bg="bg-amber-50 text-amber-700 ring-amber-100" label="Penawaran menunggu" value={String(pendingCount)} hint={pendingCount > 0 ? "Segera respons agar tak kabur" : undefined} />
        <Kpi icon="▣" bg="bg-purple-50 text-purple-700 ring-purple-100" label="Pax terpesan" value={String(upcomingPax)} />
        <Kpi icon="◍" bg="bg-brand-50 text-brand-700 ring-brand-100" label="Utilisasi hari ini" value={util == null ? "—" : `${util}%`} hint={todayAvail ? `${todayAvail.reservedPax}/${todayAvail.maxPax} pax` : "Belum ada jadwal hari ini"} />
        <Kpi icon="↗" bg="bg-stone-100 text-stone-700 ring-stone-200" label="Total nilai pesanan" value={formatIDR(orderTotal)} />
      </div>

      <h2 className="mt-7 font-display text-lg font-bold">
        Penawaran menunggu <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 align-middle font-sans text-xs font-bold text-amber-800">{pendingQuotes.length}</span>
      </h2>
      <div className="mt-2.5 space-y-2">
        {pendingQuotes.map((q) => (
          <Link key={q.id} href={`/quotations/${q.id}`}>
            <Card className="flex items-center justify-between !p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
              <div>
                <p className="font-semibold">{q.event.name} · {q.event.guestCount} pax</p>
                <p className="text-sm text-stone-500">{formatDateID(q.event.eventDate)} · {formatIDR(q.total)}</p>
              </div>
              <StatusBadge status={q.status} />
            </Card>
          </Link>
        ))}
        {pendingQuotes.length === 0 && <p className="text-sm text-stone-500">Tidak ada penawaran menunggu. Bagus — semua sudah direspons.</p>}
      </div>

      <h2 className="mt-7 font-display text-lg font-bold">Acara mendatang</h2>
      <div className="mt-2.5 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft">
        {upcoming.map((b, i) => (
          <Link
            key={b.id}
            href={`/bookings/${b.id}`}
            className={`flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-brand-50/50 ${i > 0 ? "border-t border-stone-100" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">
                {new Date(b.event.eventDate).getUTCDate()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.event.name} · {b.event.guestCount} pax</p>
                <p className="text-sm text-stone-500">{formatDateID(b.event.eventDate)} · {b.event.location}</p>
              </div>
            </div>
            <StatusBadge status={b.status} />
          </Link>
        ))}
        {upcoming.length === 0 && <p className="px-5 py-4 text-sm text-stone-500">Belum ada acara mendatang.</p>}
      </div>

      <h2 className="mt-7 font-display text-lg font-bold">Pesanan terbaru</h2>
      <div className="mt-2.5 space-y-2">
        {recent.map((b) => (
          <Link key={b.id} href={`/bookings/${b.id}`}>
            <Card className="flex items-center justify-between !p-4 transition hover:shadow-lift">
              <div>
                <p className="font-semibold">{b.event.name}</p>
                <p className="text-sm text-stone-500">{formatIDR(b.totalAmount)}</p>
              </div>
              <StatusBadge status={b.status} />
            </Card>
          </Link>
        ))}
        {recent.length === 0 && <p className="text-sm text-stone-500">Belum ada pesanan.</p>}
      </div>
    </div>
  );
}
