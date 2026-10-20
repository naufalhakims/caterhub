import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatIDR, formatDateID } from "@/lib/format";
import { requireCustomer } from "@/lib/auth-helpers";
import { apiGet } from "@/lib/api";

type EventRow = {
  id: string;
  name: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  location: string;
  city: string;
  budgetMax: number | null;
  quotations: { id: string }[];
  bookings: { id: string }[];
};

type BookingRow = {
  id: string;
  status: string;
  totalAmount: number;
  event: { name: string };
  vendor: { businessName: string };
};

type QuoteRow = {
  id: string;
  status: string;
  total: number;
  event: { name: string; eventDate: string; guestCount: number };
  vendor: { businessName: string };
};

type Dashboard = {
  events: EventRow[];
  bookings: BookingRow[];
  pendingQuotes: number;
  profile: { phone: string | null; address: string | null } | null;
  requests: QuoteRow[];
  offers: QuoteRow[];
};

const TYPE_LABEL: Record<string, string> = {
  WEDDING: "Pernikahan",
  BIRTHDAY: "Ulang Tahun",
  CORPORATE: "Korporat",
  MEETING: "Rapat",
  SEMINAR: "Seminar",
  GATHERING: "Gathering",
  GRADUATION: "Wisuda",
  OTHER: "Lainnya",
};

export default async function CustomerDashboard() {
  const user = await requireCustomer();
  const { events, bookings, pendingQuotes, profile, requests, offers } =
    await apiGet<Dashboard>("/api/v1/dashboard");
  const profileIncomplete = !profile?.phone || !profile?.address;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Dasbor pelanggan</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
              Halo, {user.name?.split(" ")[0] ?? "Kak"} 👋
            </h1>
          </div>
          <Link href="/events/new"><Button className="!px-5 !py-2.5">＋ Buat Acara</Button></Link>
        </div>
        {profileIncomplete && (
          <p className="mt-2 text-sm text-stone-500">
            Data kontak belum lengkap — vendor butuh nomor telepon & alamat Anda.{" "}
            <Link href="/profile" className="font-semibold text-brand-700 hover:underline">Lengkapi profil →</Link>
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-3 !p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">◫</span>
            <div>
              <p className="text-xl font-extrabold">{events.length}</p>
              <p className="text-xs text-stone-500">Acara dibuat</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 !p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">✎</span>
            <div>
              <p className="text-xl font-extrabold">{pendingQuotes}</p>
              <p className="text-xs text-stone-500">Penawaran menunggu respons</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 !p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">▣</span>
            <div>
              <p className="text-xl font-extrabold">{bookings.length}</p>
              <p className="text-xs text-stone-500">Pesanan dibuat</p>
            </div>
          </Card>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Acara saya</h2>
          {events.length > 0 && (
            <Link href="/events/new" className="text-sm font-semibold text-brand-700 hover:underline">
              + Acara baru
            </Link>
          )}
        </div>
        {events.length === 0 ? (
          <Empty
            title="Belum ada acara."
            hint="Ceritakan kebutuhan acaramu — tanggal, tamu, budget — dan kami carikan catering yang cocok."
            action={<Link href="/events/new"><Button>Buat acara pertama</Button></Link>}
          />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e, i) => (
              <Link key={e.id} href={`/events/${e.id}`} className="animate-rise" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold leading-tight">{e.name}</p>
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                      {TYPE_LABEL[e.eventType] ?? e.eventType}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-stone-500">
                    {formatDateID(e.eventDate)} · {e.guestCount} pax
                  </p>
                  <p className="text-sm text-stone-500">{e.location}, {e.city}</p>
                  {e.budgetMax != null && (
                    <p className="mt-1.5 text-sm font-semibold">Budget {formatIDR(e.budgetMax)}</p>
                  )}
                  <div className="mt-3 flex gap-1.5 border-t border-stone-100 pt-3 text-xs">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
                      {e.quotations.length} penawaran
                    </span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
                      {e.bookings.length} pesanan
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <h2 className="mt-8 font-display text-xl font-bold">Permintaan pesanan</h2>
        <p className="text-[13px] text-stone-500">Permintaan yang Anda kirim ke vendor — vendor memutuskan lebih dulu sebelum menjadi penawaran.</p>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Belum ada permintaan. Pilih vendor di marketplace untuk meminta penawaran.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {requests.map((q) => (
              <Link key={q.id} href={`/quotations/${q.id}`}>
                <Card className="flex flex-wrap items-center justify-between gap-2 !p-4 transition hover:shadow-lift">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{q.event.name} — {q.vendor.businessName}</p>
                    <p className="text-sm text-stone-500">
                      {formatDateID(q.event.eventDate)} · {q.event.guestCount} pax · estimasi {formatIDR(q.total)}
                    </p>
                  </div>
                  <StatusBadge status={q.status} />
                </Card>
              </Link>
            ))}
          </div>
        )}

        <h2 className="mt-7 font-display text-xl font-bold">Penawaran untuk Anda</h2>
        {offers.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Belum ada penawaran yang perlu diputuskan.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {offers.map((q) => (
              <Link key={q.id} href={`/quotations/${q.id}`}>
                <Card className="flex flex-wrap items-center justify-between gap-2 !p-4 transition hover:shadow-lift">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{q.event.name} — {q.vendor.businessName}</p>
                    <p className="text-sm text-stone-500">{formatDateID(q.event.eventDate)} · {formatIDR(q.total)}</p>
                  </div>
                  <StatusBadge status={q.status} />
                </Card>
              </Link>
            ))}
          </div>
        )}

        <h2 className="mt-8 font-display text-xl font-bold">Pesanan terbaru</h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Belum ada pesanan — mulai dari membuat acara.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft">
            {bookings.map((b, i) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className={`flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-brand-50/50 ${i > 0 ? "border-t border-stone-100" : ""}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{b.event.name} — {b.vendor.businessName}</p>
                  <p className="text-sm text-stone-500">{formatIDR(b.totalAmount)}</p>
                </div>
                <StatusBadge status={b.status} />
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
