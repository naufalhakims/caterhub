import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatIDR, formatDateID } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";

type EventDetail = {
  id: string;
  name: string;
  eventType: string;
  eventDate: string;
  eventTime: string | null;
  guestCount: number;
  location: string;
  city: string;
  budgetMin: number | null;
  budgetMax: number | null;
  notes: string | null;
  quotations: { id: string; status: string; total: number; vendor: { businessName: string } }[];
  bookings: { id: string; status: string; totalAmount: number; vendor: { businessName: string } }[];
};

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  await requireUser();
  let event: EventDetail;
  try {
    event = await apiGet<EventDetail>(`/api/v1/events/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }

  const eventTime =
    event.eventTime && /^\d{2}:\d{2}$/.test(event.eventTime) ? event.eventTime : undefined;
  const qs = new URLSearchParams({
    date: event.eventDate.slice(0, 10),
    guests: String(event.guestCount),
    city: event.city,
    ...(eventTime ? { time: eventTime } : {}),
    ...(event.budgetMax != null ? { budgetMax: String(event.budgetMax) } : {}),
  });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-stone-500"><Link href="/dashboard" className="hover:text-brand-700 hover:underline">← Dashboard</Link></p>

        <Card className="mt-3 !bg-gradient-to-br !from-stone-900 !to-brand-900 !text-white !border-transparent">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-200">
            {event.eventType === "WEDDING" ? "Pernikahan" : event.eventType}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{event.name}</h1>
          <p className="mt-2 text-sm text-white/80">
            {formatDateID(event.eventDate)}{event.eventTime ? ` · ${event.eventTime}` : ""} · {event.guestCount} pax
          </p>
          <p className="text-sm text-white/80">{event.location}, {event.city}</p>
          {(event.budgetMin != null || event.budgetMax != null) && (
            <p className="mt-2 inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-semibold ring-1 ring-white/20">
              Budget {event.budgetMin != null ? formatIDR(event.budgetMin) : "…"} – {event.budgetMax != null ? formatIDR(event.budgetMax) : "…"}
            </p>
          )}
          {event.notes && <p className="mt-2 text-sm text-white/70">“{event.notes}”</p>}
        </Card>

        <Link href={`/catering?${qs}`}>
          <Button className="mt-4 w-full !py-3 sm:w-auto sm:!px-8">Cari catering yang cocok →</Button>
        </Link>

        <h2 className="mt-8 font-display text-xl font-bold">
          Permintaan pesanan <span className="ml-1 rounded-full bg-stone-200/70 px-2 py-0.5 align-middle font-sans text-xs font-bold">{event.quotations.length}</span>
        </h2>
        <div className="mt-2.5 space-y-2">
          {event.quotations.map((q) => (
            <Link key={q.id} href={`/quotations/${q.id}`}>
              <Card className="flex items-center justify-between !p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div>
                  <p className="font-semibold">{q.vendor.businessName}</p>
                  <p className="text-sm text-stone-500">{formatIDR(q.total)}</p>
                </div>
                <StatusBadge status={q.status} />
              </Card>
            </Link>
          ))}
          {event.quotations.length === 0 && (
            <Empty title="Belum ada permintaan pesanan." hint="Cari catering, buka profil vendor, isi tanggal & jam, lalu kirim permintaan." />
          )}
        </div>

        <h2 className="mt-8 font-display text-xl font-bold">
          Pesanan <span className="ml-1 rounded-full bg-stone-200/70 px-2 py-0.5 align-middle font-sans text-xs font-bold">{event.bookings.length}</span>
        </h2>
        <div className="mt-2.5 space-y-2">
          {event.bookings.map((b) => (
            <Link key={b.id} href={`/bookings/${b.id}`}>
              <Card className="flex items-center justify-between !p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div>
                  <p className="font-semibold">{b.vendor.businessName}</p>
                  <p className="text-sm text-stone-500">{formatIDR(b.totalAmount)}</p>
                </div>
                <StatusBadge status={b.status} />
              </Card>
            </Link>
          ))}
          {event.bookings.length === 0 && <p className="text-sm text-stone-500">Belum ada pesanan.</p>}
        </div>
      </main>
    </>
  );
}
