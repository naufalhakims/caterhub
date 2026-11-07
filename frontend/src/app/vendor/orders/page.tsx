import Link from "next/link";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { FormButton } from "@/components/ui/FormButton";
import { Flash } from "@/components/ui/Flash";
import { CancelBookingForm } from "@/components/CancelBookingForm";
import { formatIDR, formatDateID, formatDateTimeID } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import { advanceBookingAction } from "@/server/vendor-actions";
import { recordManualPaymentAction } from "@/server/offline-actions";
import { ArrowRight, buttonLink } from "@/components/ui/Button";

/** Satu langkah produksi berikutnya per status — label menyebut hasilnya. */
const NEXT: Record<string, [string, string] | undefined> = {
  PAID: ["PREPARING", "Mulai memasak"],
  PREPARING: ["READY", "Tandai siap kirim"],
  READY: ["DELIVERED", "Tandai sudah diantar"],
  DELIVERED: ["COMPLETED", "Selesaikan pesanan"],
};

// Status yang masih boleh dibatalkan vendor (lihat decideCancellation di backend).
const CANCELLABLE = new Set(["PAYMENT_PENDING", "CONFIRMED", "PAID", "PREPARING"]);
const PAID_STATUSES = new Set(["PAID", "PREPARING"]);

type VendorOrder = {
  id: string;
  status: string;
  totalAmount: number;
  paymentDueAt: string | null;
  cancelReason: string | null;
  source: string;
  invoiceNumber: string | null;
  offlineCustomerName: string | null;
  offlineCustomerPhone: string | null;
  event: { name: string; guestCount: number; location: string; eventDate: string; eventTime: string | null };
  customer: { name: string | null };
};

export default async function VendorOrdersPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  await requireVendor();
  const orders = await apiGet<VendorOrder[]>("/api/v1/vendor/bookings");
  const active = orders.filter((o) => !["CANCELLED", "REFUND_PENDING", "REFUNDED", "COMPLETED"].includes(o.status));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">Pesanan</h1>
          <p className="text-sm text-stone-500">
            {active.length} aktif dari {orders.length} pesanan — majukan status seiring produksi.
          </p>
        </div>
        <Link href="/vendor/orders/new" className={buttonLink("primary", "!pr-4")}>
          Catat pesanan offline
          <ArrowRight className="ml-2" />
        </Link>
      </div>
      <Flash ok={searchParams?.ok} error={searchParams?.error} />
      {orders.length === 0 ? (
        <div className="mt-4">
          <Empty title="Belum ada pesanan." hint="Pesanan muncul setelah Anda mengonfirmasi permintaan pelanggan." />
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {orders.map((o) => {
            const next = NEXT[o.status];
            return (
              <Card key={o.id} className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/bookings/${o.id}`} className="font-semibold hover:text-brand-700 hover:underline">
                      {o.event.name} · {o.event.guestCount} pax
                    </Link>
                    {o.source === "OFFLINE" && (
                      <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-white">
                        Offline
                      </span>
                    )}
                    <p className="text-sm text-stone-500">
                      {formatDateID(o.event.eventDate)}
                      {o.event.eventTime ? ` · ${o.event.eventTime}` : ""} · {o.event.location}
                    </p>
                    <p className="mt-0.5 text-sm">
                      <span className="font-bold">{formatIDR(o.totalAmount)}</span>
                      <span className="text-stone-500">
                        {" "}· {o.source === "OFFLINE" ? o.offlineCustomerName : o.customer.name}
                        {o.source === "OFFLINE" && o.offlineCustomerPhone ? ` (${o.offlineCustomerPhone})` : ""}
                      </span>
                      {o.invoiceNumber && (
                        <Link href={`/bookings/${o.id}/invoice`} className="ml-2 font-mono text-xs text-brand-700 hover:underline">
                          {o.invoiceNumber}
                        </Link>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                {o.status === "PAYMENT_PENDING" && o.source === "OFFLINE" && (
                  <form action={recordManualPaymentAction} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
                    <input type="hidden" name="bookingId" value={o.id} />
                    <span className="font-medium">Belum dibayar — catat pelunasan:</span>
                    <select name="method" defaultValue="CASH" aria-label="Metode pembayaran" className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs">
                      <option value="CASH">Tunai</option>
                      <option value="TRANSFER">Transfer</option>
                    </select>
                    <FormButton variant="dark" pendingLabel="Menyimpan…" className="!px-3 !py-1 !text-xs">
                      Tandai lunas
                    </FormButton>
                  </form>
                )}
                {o.status === "PAYMENT_PENDING" && o.source !== "OFFLINE" && (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                    Menunggu pelanggan melunasi
                    {o.paymentDueAt ? ` sebelum ${formatDateTimeID(o.paymentDueAt)} WIB` : ""}. Bila lewat, pesanan batal otomatis
                    dan kapasitas kembali tersedia.
                  </p>
                )}
                {o.cancelReason && (
                  <p className="mt-2 text-xs text-stone-500">Alasan batal: {o.cancelReason}</p>
                )}

                {(next || CANCELLABLE.has(o.status)) && (
                  <div className="mt-3 flex flex-wrap items-start justify-between gap-2 border-t border-stone-100 pt-3">
                    {next ? (
                      <form action={advanceBookingAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="to" value={next[0]} />
                        <FormButton pendingLabel="Menyimpan…">{next[1]} →</FormButton>
                      </form>
                    ) : (
                      <span />
                    )}
                    {CANCELLABLE.has(o.status) && (
                      <CancelBookingForm
                        bookingId={o.id}
                        returnTo="/vendor/orders"
                        label="Batalkan"
                        consequence={
                          PAID_STATUSES.has(o.status)
                            ? o.source === "OFFLINE"
                              ? "Pesanan offline sudah lunas — kembalikan dana ke pelanggan secara langsung bila perlu."
                              : "Pelanggan sudah membayar lunas — dana akan dikembalikan penuh melalui admin. Pembatalan sepihak menurunkan kepercayaan pelanggan."
                            : "Kapasitas pada tanggal ini dikembalikan dan pelanggan diberi tahu."
                        }
                      />
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
