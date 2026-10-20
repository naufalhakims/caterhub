import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { formatDateID } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/api";
import { verifyVendorAction } from "@/server/admin-actions";

const DOC_LABEL: Record<string, string> = {
  BUSINESS_LICENSE: "Izin usaha / NIB",
  PREMISES_PHOTO: "Foto tempat usaha",
  KITCHEN_PHOTO: "Foto dapur",
  MENU_PACKAGE: "Menu / paket",
  OTHER: "Dokumen lain",
};

function kb(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type AdminVendorDetail = {
  id: string;
  businessName: string;
  verificationStatus: string;
  verificationNote: string | null;
  city: string;
  address: string | null;
  phone: string | null;
  minPax: number;
  maxPax: number;
  description: string | null;
  createdAt: string;
  user: { email: string };
  documents: {
    id: string;
    type: string;
    title: string | null;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }[];
  _count: { menuItems: number; packages: number; bookings: number };
};

export default async function AdminVendorDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { ok?: string; error?: string };
}) {
  let vendor: AdminVendorDetail;
  try {
    vendor = await apiGet<AdminVendorDetail>(`/api/v1/admin/vendors/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div>
      <p className="text-sm text-stone-500">
        <Link href="/admin/vendors" className="hover:text-brand-700 hover:underline">← Daftar vendor</Link>
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">{vendor.businessName}</h1>
        <StatusBadge status={vendor.verificationStatus} />
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {vendor.user.email} · {vendor.city} · bergabung {formatDateID(vendor.createdAt)}
      </p>

      {searchParams?.ok && <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
      {searchParams?.error && <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <Card>
            <h2 className="font-display text-lg font-bold">Dokumen verifikasi</h2>
            <p className="text-[13px] text-stone-500">Dokumen privat — tautan hanya bisa dibuka oleh admin dan vendor pemilik.</p>
            {vendor.documents.length === 0 ? (
              <div className="mt-3"><Empty title="Belum ada dokumen." hint="Vendor belum mengunggah bukti apa pun." /></div>
            ) : (
              <ul className="mt-3 space-y-2">
                {vendor.documents.map((d) => {
                  const isImage = d.mimeType.startsWith("image/");
                  return (
                    <li key={d.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-2.5">
                      <a
                        href={`/api/vendor-documents/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-stone-100 text-xs font-bold text-stone-500 ring-1 ring-stone-200"
                        title="Buka dokumen di tab baru"
                      >
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/vendor-documents/${d.id}`} alt={d.title ?? d.fileName} className="h-full w-full object-cover" />
                        ) : (
                          "PDF"
                        )}
                      </a>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{d.title || d.fileName}</p>
                        <p className="text-xs text-stone-500">
                          {DOC_LABEL[d.type] ?? d.type} · {kb(d.sizeBytes)} · {formatDateID(d.createdAt)}
                        </p>
                      </div>
                      <a
                        href={`/api/vendor-documents/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Periksa
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="font-display text-lg font-bold">Data usaha</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-bold uppercase tracking-wide text-stone-400">Alamat</dt><dd className="mt-0.5">{vendor.address || "—"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-stone-400">Telepon</dt><dd className="mt-0.5">{vendor.phone || "—"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-stone-400">Kapasitas</dt><dd className="mt-0.5">{vendor.minPax}–{vendor.maxPax} pax</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-stone-400">Konten</dt><dd className="mt-0.5">{vendor._count.menuItems} menu · {vendor._count.packages} paket · {vendor._count.bookings} pesanan</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase tracking-wide text-stone-400">Deskripsi</dt><dd className="mt-0.5 text-stone-600">{vendor.description || "—"}</dd></div>
            </dl>
          </Card>
        </div>

        <Card className="h-fit">
          <h2 className="font-display text-lg font-bold">Keputusan verifikasi</h2>
          <p className="text-[13px] text-stone-500">
            Status saat ini <span className="font-semibold">{vendor.verificationStatus}</span>. Catatan wajib diisi saat menolak atau meminta perbaikan.
          </p>
          {vendor.verificationNote && (
            <p className="mt-2 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-600">
              <span className="font-semibold">Catatan terakhir:</span> {vendor.verificationNote}
            </p>
          )}
          <form action={verifyVendorAction} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={vendor.id} />
            <Field label="Catatan untuk vendor (opsional)">
              <Textarea name="note" rows={3} placeholder="cth. Foto dapur kurang jelas, mohon unggah ulang." maxLength={1000} />
            </Field>
            <div className="grid gap-2">
              <Button type="submit" name="decision" value="approve">✓ Setujui (Terverifikasi)</Button>
              <Button type="submit" name="decision" value="review" variant="secondary">Tandai sedang ditinjau</Button>
              <Button type="submit" name="decision" value="request_info" variant="secondary">Minta perbaikan dokumen</Button>
              <Button type="submit" name="decision" value="reject" variant="danger">Tolak verifikasi</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
