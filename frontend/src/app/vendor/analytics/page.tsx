import { Card, Empty } from "@/components/ui/Card";
import { RevenueChart } from "@/components/RevenueChart";
import { formatIDR, formatDateOnlyID } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";

type Analytics = {
  chart: { month: string; revenue: number }[];
  popular: [string, number][];
  total: number;
  avail: { id: string; date: string; maxPax: number; reservedPax: number }[];
  paymentCount: number;
};

export default async function VendorAnalyticsPage() {
  await requireVendor();
  const { chart, popular, total, avail, paymentCount } = await apiGet<Analytics>("/api/v1/vendor/analytics");

  const insight =
    popular.length > 0 && total > 0
      ? `“${popular[0][0]}” menyumbang ${Math.round((popular[0][1] / total) * 100)}% pendapatanmu — pertimbangkan paket turunan di harga berdekatan.`
      : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Analitik usaha</h1>
      <p className="text-sm text-stone-500">Angka dari transaksi nyata — bukan data hiasan.</p>

      {insight && (
        <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-inset ring-brand-100">
          💡 {insight}
        </p>
      )}

      <Card className="mt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Pendapatan</h2>
          <p className="text-sm font-extrabold text-brand-800">{formatIDR(total)}</p>
        </div>
        {chart.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Belum ada pendapatan tercatat.</p>
        ) : (
          <RevenueChart data={chart} />
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-bold">Paket populer</h2>
          {popular.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Belum ada data.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {popular.map(([name, rev], i) => {
                const pct = total > 0 ? Math.round((rev / total) * 100) : 0;
                return (
                  <li key={name}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold">#{i + 1} {name}</span>
                      <span className="text-stone-500">{formatIDR(rev)} · {pct}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold">Utilisasi 14 hari ke depan</h2>
          {avail.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Belum ada data kapasitas.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {avail.map((a) => {
                const pct = a.maxPax > 0 ? Math.round((a.reservedPax / a.maxPax) * 100) : 0;
                return (
                  <li key={a.id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{formatDateOnlyID(a.date)}</span>
                      <span className={pct >= 90 ? "font-bold text-red-600" : "text-stone-500"}>
                        {a.reservedPax}/{a.maxPax} pax
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {paymentCount === 0 && popular.length === 0 && (
        <div className="mt-4"><Empty title="Analitik kosong." hint="Selesaikan satu pesanan sampai lunas — grafik terisi otomatis." /></div>
      )}
    </div>
  );
}
