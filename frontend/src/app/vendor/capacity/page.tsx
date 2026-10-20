import { Card, Empty } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input } from "@/components/ui/Field";
import { formatDateOnlyID } from "@/lib/format";
import { todayDateOnly } from "@/lib/date";
import { apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import { upsertCapacityAction } from "@/server/vendor-actions";

type CapacityRow = { id: string; date: string; maxPax: number; reservedPax: number };

export default async function VendorCapacityPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  const { vendor } = await requireVendor();
  const allRows = await apiGet<CapacityRow[]>("/api/v1/vendor/capacity");
  // Hanya tanggal hari ini dan ke depan — tanggal lampau tidak relevan untuk perencanaan.
  const today = todayDateOnly().toISOString().slice(0, 10);
  const rows = allRows.filter((r) => r.date.slice(0, 10) >= today).slice(0, 60);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Kapasitas</h1>
      <p className="text-sm text-stone-500">
        Default <span className="font-bold text-stone-700">{vendor.maxPax} pax/hari</span> — turunkan di tanggal padat, naikkan saat dapur longgar.
      </p>
      {searchParams?.ok && <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
      {searchParams?.error && <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

      <Card className="mt-4">
        <h2 className="font-display text-lg font-bold">Atur kapasitas tanggal</h2>
        <p className="mt-0.5 text-[13px] text-stone-500">
          Kapasitas tidak bisa diturunkan di bawah jumlah pax yang sudah dipesan pada tanggal tersebut.
        </p>
        <form action={upsertCapacityAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Tanggal"><Input name="date" type="date" required /></Field>
          <Field label="Maks pax"><Input name="maxPax" type="number" min={0} defaultValue={vendor.maxPax} required /></Field>
          <div className="flex items-end"><SubmitButton>Simpan</SubmitButton></div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <div className="mt-4"><Empty title="Belum ada data kapasitas." hint="Setiap pesanan yang dikonfirmasi otomatis mengisi bar kapasitas tanggalnya." /></div>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((r) => {
            const pct = r.maxPax > 0 ? Math.round((r.reservedPax / r.maxPax) * 100) : 0;
            return (
              <Card key={r.id} className="!p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{formatDateOnlyID(r.date)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pct >= 100 ? "bg-red-100 text-red-700" : pct >= 80 ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                    {r.reservedPax}/{r.maxPax} pax · {pct}%
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <form action={upsertCapacityAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
                  <input type="hidden" name="date" value={r.date.slice(0, 10)} />
                  <label className="text-xs font-medium text-stone-600">
                    <span className="mb-1 block">Maks pax</span>
                    <Input name="maxPax" type="number" min={r.reservedPax} defaultValue={r.maxPax} required className="!w-28 !py-1.5" />
                  </label>
                  <SubmitButton variant="secondary" className="!py-1.5">Perbarui</SubmitButton>
                  <span className="pb-1.5 text-[11px] text-stone-400">Minimal {r.reservedPax} pax (sudah terpesan)</span>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
