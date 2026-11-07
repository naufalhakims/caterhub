import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Textarea } from "@/components/ui/Field";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { formatIDR, formatDateID, formatDateTimeID } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";
import {
  confirmQuotationRequestAction,
  declineQuotationRequestAction,
  decideOfferAction,
} from "@/server/quotation-actions";
import { OfferEditor } from "@/components/OfferEditor";
import { FormButton } from "@/components/ui/FormButton";
import { sendOfferMessageAction } from "@/server/chat-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Flash } from "@/components/ui/Flash";

const ACTION_LABEL: Record<string, string> = {
  created: "Permintaan pesanan dibuat",
  sent: "Penawaran khusus dikirim",
  revised: "Penawaran diperbarui",
  accepted: "Pesanan dikonfirmasi vendor",
  rejected: "Ditolak pelanggan",
  revision_requested: "Revisi diminta",
  declined: "Permintaan ditolak vendor",
  expired: "Kedaluwarsa",
};

type QuotationDetail = {
  id: string;
  customerId: string;
  packageId: string | null;
  status: string;
  origin: string;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  notes: string | null;
  revisionNote: string | null;
  expiresAt: string | null;
  event: {
    id: string;
    name: string;
    eventDate: string;
    eventTime: string | null;
    guestCount: number;
    location: string;
    city: string;
  };
  vendor: { businessName: string; userId: string };
  items: { id: string; name: string; quantity: number; unitPrice: number; subtotal: number; menuItemId: string | null }[];
  booking: { id: string; status: string } | null;
  messages: {
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
    sender: { id: string; name: string | null };
  }[];
  history: {
    id: string;
    action: string;
    note: string | null;
    createdAt: string;
    actor: { name: string | null; role: string } | null;
  }[];
  viewer: { isParty: boolean };
};

export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  const user = await requireUser();
  let q: QuotationDetail;
  try {
    q = await apiGet<QuotationDetail>(`/api/v1/quotations/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  const isCustomer = q.customerId === user.id;
  const isVendor = q.vendor.userId === user.id;
  const isParty = q.viewer.isParty;
  const backHref = user.role === "ADMIN" ? "/admin/orders" : isVendor ? "/vendor/quotations" : "/dashboard";
  const messages = isParty ? q.messages : [];
  const history = q.history;
  const waiting = q.status === "REQUESTED";
  const offered = q.status === "SENT";
  const revising = q.status === "REVISION_REQUESTED";
  const confirmed = q.status === "ACCEPTED";
  const declined = q.status === "DECLINED";
  const rejected = q.status === "REJECTED";
  const expired = q.status === "EXPIRED";
  const negotiating = offered || revising;
  const editorProps = {
    quotationId: q.id,
    eventId: q.event.id,
    customerId: q.customerId,
    packageId: q.packageId,
    guestCount: q.event.guestCount,
    items: q.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, menuItemId: i.menuItemId })),
    deliveryFee: q.deliveryFee,
    serviceFee: q.serviceFee,
    discount: q.discount,
    notes: null,
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-stone-500">
          <Link href={backHref} className="hover:text-brand-700 hover:underline">← Kembali</Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-4xl text-ink sm:text-5xl">Pesanan — {q.event.name}</h1>
          <StatusBadge status={q.status} />
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {q.vendor.businessName} · {formatDateID(q.event.eventDate)}
          {q.event.eventTime ? ` · ${q.event.eventTime}` : ""} · {q.event.guestCount} pax · {q.event.location}, {q.event.city}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          {q.origin === "CUSTOMER_REQUEST"
            ? isCustomer
              ? "Permintaan pesanan dari Anda"
              : "Permintaan pesanan pelanggan"
            : isVendor
              ? "Penawaran yang Anda kirim"
              : "Penawaran dari vendor"}
        </p>
        {waiting && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            {isVendor
              ? "Konfirmasi permintaan ini dan tentukan biaya tambahan untuk nota pelanggan."
              : "Menunggu vendor mengonfirmasi pesanan. Anda belum perlu membayar."}
          </p>
        )}
        {confirmed && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
            <p className="font-semibold">✓ Pesanan dikonfirmasi vendor.</p>
            <p className="mt-0.5">
              {isCustomer
                ? "Silakan bayar lunas. Vendor baru mulai mempersiapkan pesanan setelah pembayaran diterima."
                : "Menunggu pelanggan membayar lunas sebelum persiapan dimulai."}
            </p>
            {q.booking && (
              <Link
                href={`/bookings/${q.booking.id}`}
                className="mt-2 inline-block font-semibold text-emerald-800 underline"
              >
                {isCustomer ? "Buka pesanan & bayar →" : "Lihat pesanan →"}
              </Link>
            )}
          </div>
        )}
        {offered && (
          <div className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-inset ring-sky-200">
            <p className="font-semibold">{isCustomer ? "Vendor mengirim penawaran khusus." : "Penawaran terkirim — menunggu keputusan pelanggan."}</p>
            <p className="mt-0.5">
              {isCustomer
                ? "Tinjau item dan total di bawah, lalu terima, minta revisi, atau tolak."
                : "Pelanggan bisa menerima, meminta revisi, atau menolak. Anda masih bisa mengubah penawaran."}
              {q.expiresAt ? ` Berlaku sampai ${formatDateTimeID(q.expiresAt)} WIB.` : ""}
            </p>
          </div>
        )}
        {revising && (
          <div className="mt-3 rounded-2xl bg-purple-50 px-4 py-3 text-sm text-purple-900 ring-1 ring-inset ring-purple-200">
            <p className="font-semibold">{isVendor ? "Pelanggan meminta revisi." : "Revisi diminta — menunggu vendor memperbarui penawaran."}</p>
            {q.revisionNote && <p className="mt-0.5">“{q.revisionNote}”</p>}
          </div>
        )}
        {rejected && (
          <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            Penawaran ini ditolak pelanggan.
          </p>
        )}
        {expired && (
          <p className="mt-3 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700 ring-1 ring-inset ring-stone-200">
            Penawaran/permintaan ini sudah kedaluwarsa.
          </p>
        )}
        {declined && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            Vendor tidak dapat memenuhi permintaan ini. Silakan cari vendor lain.
          </p>
        )}
        <Flash ok={searchParams?.ok} error={searchParams?.error} />

        <Card className="mt-4 overflow-hidden !p-0">
          <div className="overflow-x-auto p-5 pb-2">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                  <th className="pb-2 font-bold">Item</th>
                  <th className="pb-2 text-right font-bold">Qty</th>
                  <th className="pb-2 text-right font-bold">Harga</th>
                  <th className="pb-2 text-right font-bold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((i) => (
                  <tr key={i.id} className="border-t border-stone-100">
                    <td className="py-2.5 pr-2 font-medium">{i.name}</td>
                    <td className="text-right text-stone-500">{i.quantity}</td>
                    <td className="text-right text-stone-500">{formatIDR(i.unitPrice)}</td>
                    <td className="text-right font-semibold">{formatIDR(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="space-y-1.5 bg-paper px-5 py-4 text-sm ring-1 ring-inset ring-stone-100">
            <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd className="font-medium">{formatIDR(q.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Ongkos kirim</dt><dd className="font-medium">{formatIDR(q.deliveryFee)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Biaya layanan / lainnya</dt><dd className="font-medium">{formatIDR(q.serviceFee)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Diskon</dt><dd className="font-medium text-emerald-700">−{formatIDR(q.discount)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-stone-200 pt-2.5">
              <dt className="font-bold">{confirmed ? "Total nota" : negotiating ? "Total penawaran" : "Estimasi total"}</dt>
              <dd className="font-display text-2xl font-bold text-brand-800">{formatIDR(q.total)}</dd>
            </div>
          </dl>
        </Card>
        {q.notes && (
          <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-stone-600 ring-1 ring-inset ring-brand-100">
            <span className="font-semibold text-brand-800">{q.origin === "CUSTOMER_REQUEST" && waiting ? "Catatan pelanggan:" : "Catatan:"}</span> {q.notes}
          </p>
        )}

        {isVendor && waiting && (
          <Card className="mt-4 border-brand-100">
            <h2 className="font-display text-2xl text-ink">Konfirmasi pesanan</h2>
            <p className="text-[13px] text-stone-500">
              Tambahkan ongkir/biaya lain bila ada. Total nota dihitung otomatis dan langsung
              masuk ke halaman pembayaran pelanggan.
            </p>
            <form action={confirmQuotationRequestAction} className="mt-3 space-y-3">
              <input type="hidden" name="quotationId" value={q.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Ongkos kirim (Rp)"><RupiahInput name="deliveryFee" defaultValue={q.deliveryFee} /></Field>
                <Field label="Biaya layanan / lainnya (Rp)"><RupiahInput name="serviceFee" defaultValue={q.serviceFee} /></Field>
                <Field label="Diskon (Rp, opsional)"><RupiahInput name="discount" defaultValue={q.discount} /></Field>
              </div>
              <SubmitButton requireDirty={false} className="!px-6 !py-2.5">
                ✓ Konfirmasi pesanan
              </SubmitButton>
            </form>
            <details className="group mt-5 border-t border-stone-100 pt-4">
              <summary className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                Ajukan penawaran khusus (ubah item / harga)
                <span aria-hidden className="transition-transform duration-300 ease-fluid group-open:rotate-180">⌄</span>
              </summary>
              <div className="disclose-panel mt-3">
                <p className="mb-3 text-[13px] text-stone-500">
                  Gunakan bila menu perlu diganti atau harga disesuaikan. Pelanggan harus menyetujui penawaran sebelum pesanan dibuat.
                </p>
                <OfferEditor {...editorProps} submitLabel="Kirim penawaran" />
              </div>
            </details>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-red-600">Tolak permintaan…</summary>
              <form action={declineQuotationRequestAction} className="mt-2 space-y-2">
                <input type="hidden" name="quotationId" value={q.id} />
                <Field label="Alasan (dikirim ke pelanggan)">
                  <Textarea name="reason" rows={2} required maxLength={500} placeholder="cth. Tanggal tersebut kapasitas dapur sudah penuh." />
                </Field>
                <SubmitButton variant="danger" className="!py-1.5 !text-xs">Tolak permintaan</SubmitButton>
              </form>
            </details>
          </Card>
        )}

        {isVendor && negotiating && (
          revising ? (
            <Card className="mt-4">
              <h2 className="font-display text-2xl text-ink">
                Perbarui <em>penawaran</em>
              </h2>
              <p className="mb-4 text-[13px] text-stone-500">Sesuaikan item atau harga sesuai catatan revisi pelanggan.</p>
              <OfferEditor {...editorProps} submitLabel="Kirim revisi" />
            </Card>
          ) : (
            <details className="group mt-4 rounded-3xl border border-stone-200 bg-white p-5">
              <summary className="inline-flex items-center gap-1.5 font-display text-xl text-ink">
                Ubah penawaran
                <span aria-hidden className="font-sans text-base transition-transform duration-300 ease-fluid group-open:rotate-180">⌄</span>
              </summary>
              <div className="disclose-panel mt-4">
                <OfferEditor {...editorProps} submitLabel="Kirim ulang penawaran" />
              </div>
            </details>
          )
        )}

        {isCustomer && negotiating && (
          <Card className="mt-4 !rounded-4xl shadow-lift">
            <h2 className="font-display text-3xl text-ink">
              {offered ? (
                <>
                  Setujui <em>penawaran</em>?
                </>
              ) : (
                "Masih ingin memakai versi ini?"
              )}
            </h2>
            <p className="mt-1 text-[13px] text-stone-500">
              Menerima penawaran langsung membuat pesanan dan mengunci jadwal vendor. Setelah itu Anda punya batas waktu
              untuk membayar lunas.
            </p>
            <form action={decideOfferAction} className="mt-4">
              <input type="hidden" name="quotationId" value={q.id} />
              <input type="hidden" name="decision" value="accept" />
              <FormButton arrow pendingLabel="Membuat pesanan…" className="!px-6 !py-3">
                Terima {formatIDR(q.total)} & lanjut bayar
              </FormButton>
            </form>
            <div className="mt-5 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-2">
              {offered && (
                <details className="group">
                  <summary className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-purple-800 transition-colors hover:bg-purple-50">
                    Minta revisi
                    <span aria-hidden className="transition-transform duration-300 ease-fluid group-open:rotate-180">⌄</span>
                  </summary>
                  <form action={decideOfferAction} className="disclose-panel mt-2 space-y-2">
                    <input type="hidden" name="quotationId" value={q.id} />
                    <input type="hidden" name="decision" value="revision" />
                    <Textarea name="note" rows={2} required minLength={5} maxLength={1000} placeholder="cth. Bisa ganti rendang dengan ayam bakar dan kurangi ongkir?" />
                    <FormButton variant="secondary" pendingLabel="Mengirim…">Kirim permintaan revisi</FormButton>
                  </form>
                </details>
              )}
              <details className="group">
                <summary className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50">
                  Tolak penawaran
                  <span aria-hidden className="transition-transform duration-300 ease-fluid group-open:rotate-180">⌄</span>
                </summary>
                <form action={decideOfferAction} className="disclose-panel mt-2 space-y-2 rounded-2xl bg-red-50/60 p-3 ring-1 ring-inset ring-red-200">
                  <input type="hidden" name="quotationId" value={q.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <p className="text-[13px] text-red-900">Penawaran ditutup dan tidak bisa diterima lagi.</p>
                  <Textarea name="note" rows={2} maxLength={1000} placeholder="Alasan (opsional)" />
                  <FormButton variant="danger" pendingLabel="Menolak…">Ya, tolak</FormButton>
                </form>
              </details>
            </div>
          </Card>
        )}

        {history.length > 0 && (
          <Card className="mt-4">
            <h2 className="font-display text-2xl text-ink">Riwayat pesanan</h2>
            <ol className="mt-2 space-y-2.5 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {ACTION_LABEL[h.action] ?? h.action}
                      <span className="ml-1 font-normal text-stone-400">· {formatDateTimeID(h.createdAt)}</span>
                    </p>
                    {h.note && <p className="text-stone-500">{h.note}</p>}
                    {h.actor?.name && <p className="text-[11px] text-stone-400">oleh {h.actor.name}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {isParty ? (
          <Card className="mt-4">
            <div id="chat" className="scroll-mt-24">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-2xl text-ink">Diskusi</h2>
                <span className="text-[11px] text-stone-400">{messages.length} pesan</span>
              </div>
              <p className="text-[13px] text-stone-500">
                Tanya detail menu, lokasi, atau waktu pengiriman. Diskusi tidak mengubah status pesanan.
              </p>

              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-xl bg-paper p-3 ring-1 ring-inset ring-stone-200/70">
                {messages.length === 0 && (
                  <p className="py-6 text-center text-sm text-stone-400">Belum ada pesan. Mulai percakapan.</p>
                )}
                {messages.map((m) => {
                  const mine = m.senderId === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? "bg-brand-700 text-white" : "bg-white text-stone-800 ring-1 ring-stone-200"}`}>
                        <p className={`text-[11px] font-semibold ${mine ? "text-white/70" : "text-stone-400"}`}>
                          {mine ? "Anda" : (m.sender.name ?? (isCustomer ? q.vendor.businessName : "Vendor"))} · {formatDateTimeID(m.createdAt)}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form action={sendOfferMessageAction} className="mt-3 space-y-2">
                <input type="hidden" name="quotationId" value={q.id} />
                <Textarea name="body" rows={2} required maxLength={2000} placeholder="Tulis pesan…" />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-stone-400">Pesan tersimpan dan bisa dibaca kedua pihak.</p>
                  <SubmitButton className="!py-1.5">Kirim</SubmitButton>
                </div>
              </form>
            </div>
          </Card>
        ) : (
          <p className="mt-4 rounded-xl bg-stone-100 px-4 py-3 text-xs text-stone-500 ring-1 ring-inset ring-stone-200">
            Mode admin: percakapan pelanggan–vendor bersifat privat dan tidak ditampilkan.
          </p>
        )}

        {isParty && <AutoRefresh />}
      </main>
    </>
  );
}
