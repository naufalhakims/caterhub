import Link from "next/link";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { Flash } from "@/components/ui/Flash";
import { FormButton } from "@/components/ui/FormButton";
import { formatIDR, formatDateID, formatDateTimeID } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { markRefundedAction } from "@/server/admin-actions";

type AdminOrder = {
  id: string;
  status: string;
  totalAmount: number;
  refundAmount: number | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  event: { name: string; eventDate: string };
  vendor: { businessName: string };
  customer: { name: string | null; email: string };
};

const NON_REVENUE = new Set(["CANCELLED", "REFUND_PENDING", "REFUNDED"]);
const BY_LABEL: Record<string, string> = { CUSTOMER: "pelanggan", VENDOR: "vendor", SYSTEM: "sistem" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: { filter?: string; ok?: string; error?: string };
}) {
  const refundView = searchParams?.filter === "refund";
  const orders = await apiGet<AdminOrder[]>(`/api/v1/admin/orders${refundView ? "?filter=refund" : ""}`);
  const gmv = orders.filter((o) => !NON_REVENUE.has(o.status)).reduce((s, o) => s + o.totalAmount, 0);

  const tab = (active: boolean) =>
    `pressable rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ease-fluid ${
      active ? "bg-white text-stone-900 shadow-soft" : "text-stone-500 hover:text-stone-800"
    }`;

  return (
    <div>
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Pesanan</h1>
      <p className="text-sm text-stone-500">
        {refundView ? (
          <>{orders.length} refund menunggu diproses</>
        ) : (
          <>
            {orders.length} pesanan · GMV <span className="font-bold text-stone-700">{formatIDR(gmv)}</span>
          </>
        )}
      </p>
      <Flash ok={searchParams?.ok} error={searchParams?.error} />

      <div className="mt-4 inline-flex gap-1 rounded-xl bg-stone-200/60 p-1" role="tablist">
        <Link href="/admin/orders" role="tab" aria-selected={!refundView} className={tab(!refundView)}>
          Semua
        </Link>
        <Link href="/admin/orders?filter=refund" role="tab" aria-selected={refundView} className={tab(refundView)}>
          Menunggu refund
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="mt-4">
          <Empty
            title={refundView ? "Tidak ada refund yang tertunda." : "Belum ada pesanan."}
            hint={refundView ? "Refund muncul saat pesanan lunas dibatalkan." : "Pesanan dari seluruh vendor tampil di sini."}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {orders.map((o) =>
            o.status === "REFUND_PENDING" ? (
              <Card key={o.id} className="!border-orange-200 !p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/bookings/${o.id}`} className="font-semibold hover:text-brand-700 hover:underline">
                      {o.event.name} · {o.vendor.businessName}
                    </Link>
                    <p className="text-sm text-stone-500">
                      Kembalikan <span className="font-bold text-orange-800">{formatIDR(o.refundAmount ?? 0)}</span> ke{" "}
                      {o.customer.name ?? o.customer.email} ({o.customer.email})
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Dibatalkan {o.cancelledBy ? `oleh ${BY_LABEL[o.cancelledBy] ?? o.cancelledBy}` : ""}
                      {o.cancelledAt ? ` · ${formatDateTimeID(o.cancelledAt)}` : ""}
                      {o.cancelReason ? `: ${o.cancelReason}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <form action={markRefundedAction} className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                  <input type="hidden" name="id" value={o.id} />
                  <input
                    name="note"
                    maxLength={500}
                    placeholder="Catatan untuk pelanggan (opsional), cth. no. referensi transfer"
                    className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                  <FormButton pendingLabel="Menyimpan…">Tandai sudah dikembalikan</FormButton>
                </form>
              </Card>
            ) : (
              <Link key={o.id} href={`/bookings/${o.id}`} className="block">
                <Card interactive className="flex items-center justify-between !p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {o.event.name} · {o.vendor.businessName}
                    </p>
                    <p className="text-sm text-stone-500">
                      {formatDateID(o.event.eventDate)} · {formatIDR(o.totalAmount)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </Card>
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
