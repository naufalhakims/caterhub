import { Card, Empty } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { db } from "@/lib/db";
import { requireVendor } from "@/server/vendor-helpers";
import { upsertMenuAction, deleteMenuAction } from "@/server/vendor-actions";
import { formatIDR } from "@/lib/format";

const CATS = ["Nasi", "Lauk", "Sayur", "Dessert", "Minuman", "Snack", "Paket Add-on"];

export default async function VendorMenuPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  const { vendor } = await requireVendor();
  const items = await db.menuItem.findMany({ where: { vendorId: vendor.id }, orderBy: { name: "asc" } });
  const byCat = new Map<string, typeof items>();
  for (const m of items) byCat.set(m.category, [...(byCat.get(m.category) ?? []), m]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Menu</h1>
      <p className="text-sm text-stone-500">{items.length} item — tampil di profil publik & bisa dirangkai jadi paket.</p>
      {searchParams?.ok && <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
      {searchParams?.error && <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

      <Card className="mt-4">
        <h2 className="font-display text-lg font-bold">Tambah menu</h2>
        <form action={upsertMenuAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nama"><Input name="name" required placeholder="cth. Ayam bakar madu" /></Field>
          <Field label="Kategori">
            <select name="category" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Harga add-on/pax (Rp, 0 bila termasuk paket)"><RupiahInput name="price" defaultValue={0} /></Field>
          <Field label="Status">
            <select name="isAvailable" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
              <option value="on">Tersedia</option>
              <option value="off">Nonaktif</option>
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="Deskripsi"><Textarea name="description" rows={2} placeholder="cth. Ayam kampung bakar bumbu rujak." /></Field></div>
          <div className="sm:col-span-2">
            <Field label="Gambar menu (opsional)">
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full cursor-pointer rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-800" />
            </Field>
          </div>
          <div><Button type="submit">Simpan menu</Button></div>
        </form>
      </Card>

      {items.length === 0 ? (
        <div className="mt-4"><Empty title="Belum ada menu." hint="Tambahkan menu andalan lewat formulir di atas." /></div>
      ) : (
        <div className="mt-5 space-y-4">
          {[...byCat.entries()].map(([cat, list]) => (
            <div key={cat}>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{cat} · {list.length}</p>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {list.map((m) => (
                  <Card key={m.id} className="!p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {m.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.imageUrl} alt={m.name} className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-stone-200" />
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{m.name}</p>
                          <p className="text-[13px] text-stone-500">
                            {m.price > 0 ? `+${formatIDR(m.price)}/pax` : "Termasuk paket"}
                            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${m.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                              {m.isAvailable ? "Aktif" : "Nonaktif"}
                            </span>
                          </p>
                        </div>
                      </div>
                      <form action={deleteMenuAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <Button variant="ghost" type="submit" className="!px-2.5 !text-red-600 hover:!bg-red-50">Hapus</Button>
                      </form>
                    </div>
                    <details className="mt-2 border-t border-stone-100 pt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-brand-700">Ubah menu & gambar</summary>
                      <form action={upsertMenuAction} className="mt-2 space-y-2">
                        <input type="hidden" name="id" value={m.id} />
                        <Field label="Nama menu"><Input name="name" defaultValue={m.name} required /></Field>
                        <Field label="Kategori">
                          <select name="category" defaultValue={m.category} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                            {CATS.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </Field>
                        <Field label="Harga add-on/pax (Rp)"><RupiahInput name="price" defaultValue={m.price} /></Field>
                        <Field label="Deskripsi"><Textarea name="description" rows={2} defaultValue={m.description ?? ""} /></Field>
                        <Field label="Status">
                          <select name="isAvailable" defaultValue={m.isAvailable ? "on" : "off"} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                            <option value="on">Tersedia</option>
                            <option value="off">Nonaktif</option>
                          </select>
                        </Field>
                        <label className="block text-xs font-medium text-stone-600">
                          <span className="mb-1 block">Ganti gambar (opsional)</span>
                          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:font-semibold file:text-brand-800" />
                        </label>
                        {m.imageUrl && (
                          <label className="flex items-center gap-2 text-xs text-stone-600">
                            <input type="checkbox" name="removeImage" /> Hapus gambar saat disimpan
                          </label>
                        )}
                        <Button type="submit" variant="secondary" className="!py-1.5 !text-xs">Simpan perubahan</Button>
                      </form>
                    </details>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
