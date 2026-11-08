import Link from "next/link";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { PrintButton } from "@/components/PrintButton";
import { buttonLink } from "@/components/ui/Button";
import { formatDateOnlyID, formatIDR, jakartaDateString } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import { advanceBookingAction, startCookingAllAction } from "@/server/vendor-actions";
import { FormButton } from "@/components/ui/FormButton";
import { Flash } from "@/components/ui/Flash";

type Summary = {
  menus: { id: string; name: string; category: string; portions: number }[];
  ingredients: { id: string; name: string; unit: string; recipeUnit: string; recipeQty: number; purchaseQty: number; cost: number }[];
  totalCost: number;
  missingRecipes: string[];
};
type OrderRow = {
  id: string;
  status: string;
  eventName: string;
  eventTime: string | null;
  guests: number;
  location: string;
  customerName: string | null;
  customerPhone: string | null;
  packageName: string | null;
  extras: string[];
};
type Group = { orders: OrderRow[]; guests: number; summary: Summary };
type Production = { date: string; upcomingDates: string[]; confirmed: Group; tentative: Group };

const qty = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });

function MenuTable({ summary }: { summary: Summary }) {
  const byCat = summary.menus.reduce<Record<string, Summary["menus"]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});
  return (
    <div className="space-y-3">
      {Object.entries(byCat).map(([cat, rows]) => (
        <div key={cat}>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{cat}</p>
          <ul className="mt-1 divide-y divide-stone-100">
            {rows.map((m) => (
              <li key={m.id} className="flex justify-between py-1.5 text-sm">
                <span>{m.name}</span>
                <span className="font-semibold tabular-nums">{qty(m.portions)} porsi</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ShoppingList({ summary }: { summary: Summary }) {
  if (summary.ingredients.length === 0) {
    return <p className="text-sm text-stone-500">Belum ada bahan — isi resep menu agar daftar belanja terbentuk.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
          <th className="pb-2 font-semibold">Bahan</th>
          <th className="pb-2 text-right font-semibold">Jumlah</th>
          <th className="pb-2 text-right font-semibold">Estimasi</th>
        </tr>
      </thead>
      <tbody>
        {summary.ingredients.map((i) => (
          <tr key={i.id} className="border-t border-stone-100">
            <td className="py-1.5">
              <span className="mr-2 inline-block h-3.5 w-3.5 rounded border border-stone-300 align-[-2px] print:inline-block" aria-hidden />
              {i.name}
            </td>
            <td className="text-right tabular-nums">
              {qty(i.purchaseQty)} {i.unit}
            </td>
            <td className="text-right tabular-nums text-stone-600">{formatIDR(i.cost)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-stone-200">
          <td className="pt-2 font-semibold" colSpan={2}>
            Total estimasi belanja
          </td>
          <td className="pt-2 text-right font-display text-lg">{formatIDR(summary.totalCost)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export default async function ProductionPage({ searchParams }: { searchParams?: { date?: string; ok?: string; error?: string } }) {
  await requireVendor();
  const date = searchParams?.date ?? "";
  const data = await apiGet<Production>(`/api/v1/vendor/production${date ? `?date=${encodeURIComponent(date)}` : ""}`);
  const today = jakartaDateString();
  const { confirmed, tentative } = data;
  const missing = [...new Set([...confirmed.summary.missingRecipes, ...tentative.summary.missingRecipes])];
  const notStarted = confirmed.orders.filter((o) => o.status === "PAID").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">
            Lembar <em>produksi</em>
          </h1>
          <p className="mt-1 text-sm text-stone-500">{formatDateOnlyID(data.date)} — rekap porsi, daftar belanja, dan jadwal kirim.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <form action="/vendor/production" method="get" className="flex items-center gap-2">
            <input
              type="date"
              name="date"
              defaultValue={data.date}
              aria-label="Tanggal produksi"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none focus:border-ink"
            />
            <button className={buttonLink("dark", "!py-2")}>Tampilkan</button>
          </form>
          <PrintButton label="Cetak lembar" />
        </div>
      </div>
      <Flash ok={searchParams?.ok} error={searchParams?.error} />

      {notStarted > 0 && (
        <form
          action={startCookingAllAction}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sun-100 px-4 py-3 ring-1 ring-inset ring-sun-300 print:hidden"
        >
          <input type="hidden" name="date" value={data.date} />
          <p className="text-sm text-stone-800">
            {notStarted} pesanan lunas belum masuk tahap masak. Otomatis dimulai pukul 00:00 pada hari acara — atau mulai
            sekarang bila dapur memasak lebih awal.
          </p>
          <FormButton variant="dark" pendingLabel="Memulai…">
            Mulai masak semua
          </FormButton>
        </form>
      )}

      {data.upcomingDates.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Jadwal mendatang</span>
          {data.upcomingDates.map((d) => (
            <Link
              key={d}
              href={`/vendor/production?date=${d}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                d === data.date ? "bg-sun-400 text-ink" : "ring-1 ring-inset ring-stone-300 hover:ring-ink"
              }`}
            >
              {d === today ? "Hari ini" : formatDateOnlyID(d)}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Pesanan lunas", String(confirmed.orders.length)],
          ["Total porsi (tamu)", qty(confirmed.guests)],
          ["Estimasi belanja bahan", formatIDR(confirmed.summary.totalCost)],
        ].map(([label, value]) => (
          <Card key={label} className="!p-4">
            <p className="font-display text-3xl text-ink">{value}</p>
            <p className="text-xs text-stone-500">{label}</p>
          </Card>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 print:hidden">
          Menu tanpa resep tidak masuk daftar belanja: {missing.join(", ")}.{" "}
          <Link href="/vendor/costing?tab=resep" className="font-semibold underline">Isi resep →</Link>
        </p>
      )}

      {confirmed.orders.length === 0 ? (
        <div className="mt-6">
          <Empty
            title="Tidak ada pesanan lunas di tanggal ini."
            hint={tentative.orders.length ? "Ada pesanan yang belum dibayar — lihat bagian tentatif di bawah." : "Pilih tanggal lain dari jadwal mendatang."}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Card className="!p-5">
            <h2 className="font-display text-2xl text-ink">Porsi per menu</h2>
            <div className="mt-3">
              <MenuTable summary={confirmed.summary} />
            </div>
          </Card>
          <Card className="!p-5">
            <h2 className="font-display text-2xl text-ink">Daftar belanja</h2>
            <div className="mt-3">
              <ShoppingList summary={confirmed.summary} />
            </div>
          </Card>
          <Card className="!p-5 lg:col-span-2">
            <h2 className="font-display text-2xl text-ink">Jadwal kirim</h2>
            <ul className="mt-3 divide-y divide-stone-100">
              {confirmed.orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {o.eventTime ?? "Jam menyusul"} · {o.eventName} · {o.guests} pax
                    </p>
                    <p className="text-stone-500">{o.location}</p>
                    <p className="text-stone-500">
                      {o.packageName ? `Paket ${o.packageName}` : "Paket kustom"}
                      {o.extras.length ? ` · ${o.extras.join(", ")}` : ""}
                    </p>
                    <p className="text-stone-500">
                      {o.customerName ?? "Pelanggan"}
                      {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                    </p>
                  </div>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    {["PAID", "PREPARING", "READY"].includes(o.status) && (
                      <form action={advanceBookingAction} className="print:hidden">
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="to" value="DELIVERED" />
                        <input type="hidden" name="productionDate" value={data.date} />
                        <FormButton pendingLabel="…" className="!px-4 !py-1.5">Berangkat antar →</FormButton>
                      </form>
                    )}
                    <Link href={`/bookings/${o.id}`} className="text-sm font-semibold text-brand-700 hover:underline print:hidden">
                      Detail →
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tentative.orders.length > 0 && (
        <section className="mt-8 rounded-4xl bg-paper p-5 ring-1 ring-inset ring-stone-200 print:hidden">
          <h2 className="font-display text-2xl text-ink">
            Tentatif <span className="text-stone-400">— belum dibayar</span>
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {tentative.orders.length} pesanan · {qty(tentative.guests)} porsi · estimasi bahan {formatIDR(tentative.summary.totalCost)}. Jangan
            belanja dulu — pesanan online batal otomatis bila tidak dilunasi; pesanan offline tandai lunas dari daftar pesanan.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {tentative.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {o.eventTime ?? "—"} · {o.eventName} · {o.guests} pax
                </span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
