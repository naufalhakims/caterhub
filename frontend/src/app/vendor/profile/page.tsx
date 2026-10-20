import { Card, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { requireVendor } from "@/server/vendor-helpers";
import { updateVendorProfileAction } from "@/server/vendor-actions";
import { removeVendorImageAction, uploadVendorImageAction } from "@/server/image-actions";

const ACCEPT = "image/jpeg,image/png,image/webp";

function UploadForm({ kind, label, hint }: { kind: string; label: string; hint?: string }) {
  return (
    <form action={uploadVendorImageAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="kind" value={kind} />
      <label className="min-w-0 flex-1 text-xs font-medium text-stone-600">
        <span className="mb-1 block">{label}{hint ? <span className="font-normal text-stone-400"> · {hint}</span> : null}</span>
        <input
          name="image"
          type="file"
          required
          accept={ACCEPT}
          className="block w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:font-semibold file:text-brand-800"
        />
      </label>
      <Button type="submit" variant="secondary" className="!py-1.5 !text-xs">Unggah</Button>
    </form>
  );
}

export default async function VendorProfilePage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  const { vendor: fresh } = await requireVendor();
  const initial = fresh.businessName.trim().charAt(0).toUpperCase() || "C";

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Profil usaha</h1>
      <p className="text-sm text-stone-500">Tampil di marketplace — tulis semenarik etalase aslimu.</p>
      {searchParams?.ok && <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
      {searchParams?.error && <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

      <Card className="mt-4 !bg-gradient-to-r !from-stone-900 !to-brand-900 !text-white !border-transparent">
        <div className="flex items-center gap-4">
          {fresh.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fresh.logoUrl} alt={`Logo ${fresh.businessName}`} className="h-16 w-16 shrink-0 rounded-2xl bg-white object-cover" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white font-display text-3xl font-bold text-brand-800">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-display text-lg font-bold">{fresh.businessName}</p>
            <p className="text-sm text-white/70">
              {fresh.city} · ★ {fresh.rating.toFixed(1)} ({fresh.reviewCount} ulasan)
            </p>
            <div className="mt-1"><StatusBadge status={fresh.verificationStatus} /></div>
          </div>
        </div>
      </Card>

      {fresh.verificationStatus !== "VERIFIED" && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          Profil ini berstatus <span className="font-semibold">{fresh.verificationStatus}</span>. Paket belum tampil di marketplace sampai terverifikasi.{" "}
          <a href="/vendor/verification" className="font-semibold underline">Kelola dokumen verifikasi →</a>
        </p>
      )}

      <Card className="mt-4">
        <h2 className="font-display text-lg font-bold">Etalase</h2>
        <p className="text-[13px] text-stone-500">JPG/PNG/WEBP, maksimal 5 MB. Gambar lama otomatis dihapus saat diganti.</p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-200 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Logo</p>
            <div className="mt-2 flex items-center gap-3">
              {fresh.logoUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fresh.logoUrl} alt="Logo" className="h-16 w-16 rounded-xl bg-stone-100 object-cover ring-1 ring-stone-200" />
                  <form action={removeVendorImageAction}>
                    <input type="hidden" name="kind" value="logo" />
                    <input type="hidden" name="url" value={fresh.logoUrl} />
                    <Button type="submit" variant="ghost" className="!px-2 !py-1 !text-xs !text-red-600 hover:!bg-red-50">Hapus</Button>
                  </form>
                </>
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-xl bg-stone-100 text-xl font-bold text-stone-400">{initial}</span>
              )}
            </div>
            <div className="mt-3"><UploadForm kind="logo" label="Ganti logo" /></div>
          </div>

          <div className="rounded-xl border border-stone-200 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Foto cover</p>
            <div className="mt-2">
              {fresh.coverUrl ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fresh.coverUrl} alt="Cover" className="h-16 w-32 rounded-lg object-cover ring-1 ring-stone-200" />
                  <form action={removeVendorImageAction}>
                    <input type="hidden" name="kind" value="cover" />
                    <input type="hidden" name="url" value={fresh.coverUrl} />
                    <Button type="submit" variant="ghost" className="!px-2 !py-1 !text-xs !text-red-600 hover:!bg-red-50">Hapus</Button>
                  </form>
                </div>
              ) : (
                <div className="grid h-16 w-32 place-items-center rounded-lg bg-stone-100 text-xs text-stone-400">Belum ada</div>
              )}
            </div>
            <div className="mt-3"><UploadForm kind="cover" label="Ganti cover" /></div>
          </div>
        </div>

        <div className="mt-4 border-t border-stone-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Galeri tempat & hidangan ({fresh.gallery.length}/8)</p>
          {fresh.gallery.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {fresh.gallery.map((url) => (
                <div key={url} className="group relative overflow-hidden rounded-xl ring-1 ring-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Foto galeri" className="h-24 w-full object-cover" />
                  <form action={removeVendorImageAction} className="absolute right-1 top-1">
                    <input type="hidden" name="kind" value="gallery" />
                    <input type="hidden" name="url" value={url} />
                    <button className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs font-bold text-white transition hover:bg-red-600" title="Hapus foto">×</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          {fresh.gallery.length < 8 && (
            <div className="mt-3"><UploadForm kind="gallery" label="Tambah foto galeri" /></div>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="font-display text-lg font-bold">Informasi usaha</h2>
        <form action={updateVendorProfileAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nama usaha"><Input name="businessName" defaultValue={fresh.businessName} required /></Field>
          <Field label="Telepon / WA"><Input name="phone" defaultValue={fresh.phone ?? ""} placeholder="cth. 0812-3456-7890" /></Field>
          <Field label="Kota">
            <Select name="city" defaultValue={fresh.city}>
              <option>Surabaya</option><option>Sidoarjo</option><option>Gresik</option>
            </Select>
          </Field>
          <Field label="Alamat"><Input name="address" defaultValue={fresh.address ?? ""} placeholder="cth. Jl. Raya Nginden No. 12" /></Field>
          <Field label="Min pax per acara"><Input name="minPax" type="number" min={1} defaultValue={fresh.minPax} /></Field>
          <Field label="Maks pax/hari (kapasitas dapur)"><Input name="maxPax" type="number" min={1} defaultValue={fresh.maxPax} /></Field>
          <div className="sm:col-span-2"><Field label="Deskripsi usaha"><Textarea name="description" rows={3} defaultValue={fresh.description ?? ""} placeholder="Spesialisasi, gaya masakan, pengalaman…" /></Field></div>
          <div><Button type="submit">Simpan profil</Button></div>
        </form>
      </Card>
    </div>
  );
}
