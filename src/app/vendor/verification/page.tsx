import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { formatDateID } from "@/lib/format";
import { db } from "@/lib/db";
import { requireVendor } from "@/server/vendor-helpers";
import { deleteVendorDocumentAction, uploadVendorDocumentAction } from "@/server/verification-actions";

const DOC_LABEL: Record<string, string> = {
  BUSINESS_LICENSE: "Izin usaha / NIB",
  PREMISES_PHOTO: "Foto tempat usaha",
  KITCHEN_PHOTO: "Foto dapur",
  MENU_PACKAGE: "Menu / paket",
  OTHER: "Dokumen lain",
};

const CHECKLIST: { type: string; label: string; hint: string; required: boolean }[] = [
  { type: "BUSINESS_LICENSE", label: "Izin usaha / NIB", hint: "NIB, SIUP, atau akta usaha (PDF/gambar).", required: true },
  { type: "PREMISES_PHOTO", label: "Foto tempat usaha", hint: "Tampak depan/ruang usaha, JPG/PNG/WEBP.", required: true },
  { type: "KITCHEN_PHOTO", label: "Foto dapur", hint: "Dapur produksi yang akan dipakai memasak.", required: true },
  { type: "MENU_PACKAGE", label: "Menu / paket", hint: "Daftar menu atau paket yang ditawarkan.", required: false },
];

function kb(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function VendorVerificationPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  const { vendor } = await requireVendor();
  const documents = await db.vendorDocument.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  const haveTypes = new Set<string>(documents.map((d) => d.type));
  const missingRequired = CHECKLIST.filter((c) => c.required && !haveTypes.has(c.type));

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Verifikasi vendor</h1>
      <p className="text-sm text-stone-500">
        Dokumen disimpan privat — hanya Anda dan admin yang dapat melihatnya.
      </p>

      {searchParams?.ok && <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
      {searchParams?.error && <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Status saat ini</p>
            <div className="mt-1"><StatusBadge status={vendor.verificationStatus} /></div>
          </div>
          {vendor.reviewedAt && (
            <p className="text-xs text-stone-400">Ditinjau {formatDateID(vendor.reviewedAt)}</p>
          )}
        </div>
        {vendor.verificationNote && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            <span className="font-semibold">Catatan admin:</span> {vendor.verificationNote}
          </p>
        )}

        <div className="mt-4 rounded-xl bg-[#FAF7F1] p-4 ring-1 ring-inset ring-stone-200/70">
          <p className="text-sm font-semibold">Kelengkapan dokumen</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {CHECKLIST.map((c) => {
              const done = haveTypes.has(c.type);
              return (
                <li key={c.type} className="flex items-start gap-2">
                  <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${done ? "bg-emerald-500 text-white" : "bg-stone-300 text-white"}`}>
                    {done ? "✓" : "!"}
                  </span>
                  <span className={done ? "text-stone-600" : "text-stone-800"}>
                    <span className="font-medium">{c.label}</span>
                    {c.required && !done && <span className="ml-1 text-xs font-semibold text-amber-700">wajib</span>}
                    <span className="block text-xs text-stone-400">{c.hint}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {missingRequired.length > 0 && (
            <p className="mt-2 text-xs text-stone-500">
              Kurang {missingRequired.length} dokumen wajib sebelum admin dapat menyetujui verifikasi.
            </p>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="font-display text-lg font-bold">Unggah dokumen</h2>
        <p className="text-[13px] text-stone-500">JPG, PNG, WEBP, atau PDF. Maksimal 5 MB per file.</p>
        <form action={uploadVendorDocumentAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Jenis dokumen">
            <Select name="type" required defaultValue="BUSINESS_LICENSE">
              {Object.entries(DOC_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Keterangan (opsional)">
            <Input name="title" placeholder="cth. NIB 2024" maxLength={120} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="File">
              <input
                name="file"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="block w-full cursor-pointer rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100"
              />
            </Field>
          </div>
          <div><Button type="submit">Unggah dokumen</Button></div>
        </form>
      </Card>

      <h2 className="mt-6 font-display text-lg font-bold">Dokumen terunggah</h2>
      {documents.length === 0 ? (
        <div className="mt-2"><Empty title="Belum ada dokumen." hint="Unggah minimal izin usaha, foto tempat, dan foto dapur." /></div>
      ) : (
        <div className="mt-2 space-y-2">
          {documents.map((d) => {
            const isImage = d.mimeType.startsWith("image/");
            return (
              <Card key={d.id} className="!p-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={`/api/vendor-documents/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-stone-100 text-xs font-bold text-stone-500 ring-1 ring-stone-200"
                    title="Buka dokumen"
                  >
                    {isImage ? (
                      // Route privat memakai cookie sesi, jadi <img> biasa aman di sini.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/vendor-documents/${d.id}`} alt={d.title ?? d.fileName} className="h-full w-full object-cover" />
                    ) : (
                      "PDF"
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.title || d.fileName}</p>
                    <p className="text-xs text-stone-500">
                      {DOC_LABEL[d.type]} · {kb(d.sizeBytes)} · {formatDateID(d.createdAt)}
                    </p>
                  </div>
                  <a href={`/api/vendor-documents/${d.id}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-700 hover:underline">
                    Lihat
                  </a>
                  {vendor.verificationStatus !== "VERIFIED" && (
                    <form action={deleteVendorDocumentAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <Button type="submit" variant="ghost" className="!px-2.5 !text-red-600 hover:!bg-red-50">Hapus</Button>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
