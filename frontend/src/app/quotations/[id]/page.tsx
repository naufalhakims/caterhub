import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { formatIDR, formatDateID, formatDateTimeID } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";
import { quotationDecisionAction, declineQuotationRequestAction } from "@/server/quotation-actions";
import { sendOfferMessageAction } from "@/server/chat-actions";
import { AutoRefresh } from "@/components/AutoRefresh";

const ACTION_LABEL: Record<string, string> = {
  created: "Permintaan dibuat",
  sent: "Penawaran dikirim",
  revised: "Penawaran diperbarui",
  accepted: "Penawaran diterima",
  rejected: "Penawaran ditolak",
  revision_requested: "Revisi diminta",
  declined: "Permintaan ditolak vendor",
  expired: "Penawaran kedaluwarsa",
};

type QuotationDetail = {
  id: string;
  customerId: string;
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
  event: { name: string; eventDate: string; guestCount: number; location: string };
  vendor: { businessName: string; userId: string };
  items: { id: string; name: string; quantity: number; unitPrice: number; subtotal: number }[];
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

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-stone-500">
          <Link href={backHref} className="hover:text-brand-700 hover:underline">← Kembali</Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Penawaran — {q.event.name}</h1>
          <StatusBadge status={q.status} />
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {q.vendor.businessName} · {formatDateID(q.event.eventDate)} · {q.event.guestCount} pax · {q.event.location}
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
        {q.status === "REQUESTED" && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            Menunggu vendor memutuskan. Anda akan menerima penawaran atau penolakan.
          </p>
        )}
        {q.status === "DECLINED" && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            Vendor tidak dapat memenuhi permintaan ini.
          </p>
        )}
        {searchParams.ok && <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
        {searchParams.error && <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

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
          <dl className="space-y-1.5 bg-[#FAF7F1] px-5 py-4 text-sm ring-1 ring-inset ring-stone-100">
            <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd className="font-medium">{formatIDR(q.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Ongkos kirim</dt><dd className="font-medium">{formatIDR(q.deliveryFee)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Biaya layanan</dt><dd className="font-medium">{formatIDR(q.serviceFee)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Diskon</dt><dd className="font-medium text-emerald-700">−{formatIDR(q.discount)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-stone-200 pt-2.5">
              <dt className="font-bold">Total</dt>
              <dd className="font-display text-2xl font-bold text-brand-800">{formatIDR(q.total)}</dd>
            </div>
          </dl>
        </Card>
        {q.notes && (
          <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-stone-600 ring-1 ring-inset ring-brand-100">
            <span className="font-semibold text-brand-800">Catatan vendor:</span> {q.notes}
          </p>
        )}
        {q.revisionNote && <p className="mt-3 rounded-xl bg-purple-50 px-4 py-3 text-sm text-purple-800 ring-1 ring-inset ring-purple-200">Revisi diminta: {q.revisionNote}</p>}
        {q.expiresAt && <p className="mt-2 text-xs text-stone-400">Penawaran berlaku hingga {formatDateID(q.expiresAt)}</p>}

        {isCustomer && (q.status === "SENT" || q.status === "REVISION_REQUESTED") && (
          <Card className="mt-4 border-brand-100">
            <h2 className="font-display text-lg font-bold">Keputusan Anda</h2>
            <p className="text-[13px] text-stone-500">Menerima penawaran langsung mengunci kapasitas vendor & membuat pesanan.</p>
            <form action={quotationDecisionAction} className="mt-3 space-y-3">
              <input type="hidden" name="quotationId" value={q.id} />
              <Field label="Catatan revisi (isi hanya bila minta revisi)">
                <Textarea name="revisionNote" rows={2} placeholder="cth. Tambah 1 menu dessert, budget maks 9 juta." />
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" name="decision" value="accept" className="flex-1 !py-2.5">✓ Terima & buat pesanan</Button>
                <Button type="submit" name="decision" value="revision" variant="secondary" className="flex-1">Minta revisi</Button>
                <Button type="submit" name="decision" value="reject" variant="danger">Tolak</Button>
              </div>
            </form>
          </Card>
        )}

        {isVendor && (q.status === "REQUESTED" || q.status === "SENT" || q.status === "REVISION_REQUESTED") && (
          <Card className="mt-4 border-brand-100">
            <h2 className="font-display text-lg font-bold">
              {q.status === "REQUESTED" ? "Permintaan pelanggan menunggu keputusan" : "Kelola penawaran"}
            </h2>
            <p className="text-[13px] text-stone-500">
              {q.status === "REQUESTED"
                ? "Kirim penawaran (harga bisa disesuaikan) atau tolak dengan alasan."
                : "Perbarui rincian harga bila pelanggan meminta revisi."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/vendor/quotations?compose=${q.id}`}
                className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
              >
                {q.status === "REQUESTED" ? "Susun penawaran" : "Ubah penawaran"}
              </Link>
              {q.status === "REQUESTED" && (
                <details className="w-full">
                  <summary className="cursor-pointer text-xs font-semibold text-red-600">Tolak permintaan…</summary>
                  <form action={declineQuotationRequestAction} className="mt-2 space-y-2">
                    <input type="hidden" name="quotationId" value={q.id} />
                    <Field label="Alasan (dikirim ke pelanggan)">
                      <Textarea name="reason" rows={2} required maxLength={500} placeholder="cth. Tanggal tersebut kapasitas dapur sudah penuh." />
                    </Field>
                    <Button type="submit" variant="danger" className="!py-1.5 !text-xs">Tolak permintaan</Button>
                  </form>
                </details>
              )}
            </div>
          </Card>
        )}

        {history.length > 0 && (
          <Card className="mt-4">
            <h2 className="font-display text-lg font-bold">Riwayat penawaran</h2>
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
          <Card className="mt-4" >
            <div id="chat" className="scroll-mt-24">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">Diskusi</h2>
                <span className="text-[11px] text-stone-400">{messages.length} pesan</span>
              </div>
              <p className="text-[13px] text-stone-500">
                Tanya detail menu, lokasi, atau waktu pengiriman. Diskusi tidak mengubah status penawaran.
              </p>

              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-xl bg-[#FAF7F1] p-3 ring-1 ring-inset ring-stone-200/70">
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
                  <Button type="submit" className="!py-1.5">Kirim</Button>
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
