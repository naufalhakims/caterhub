import { Card, Empty } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import { upsertPackageAction } from "@/server/vendor-actions";
import { formatIDR } from "@/lib/format";

type PackageRow = {
  id: string;
  name: string;
  description: string | null;
  pricePerPax: number;
  minPax: number;
  maxPax: number;
  imageUrl: string | null;
  isActive: boolean;
  items: { menuItemId: string; menuItem: { id: string; name: string } }[];
};

type MenuOption = { id: string; name: string; isAvailable: boolean };

export default async function VendorPackagesPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  await requireVendor();
  const [packages, menus] = await Promise.all([
    apiGet<PackageRow[]>("/api/v1/vendor/packages"),
    apiGet<MenuOption[]>("/api/v1/vendor/menu"),
  ]);
  const activeMenus = menus.filter((m) => m.isAvailable);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Paket</h1>
      <p className="text-sm text-stone-500">Rangkai menu jadi paket harga per pax — ini yang muncul di marketplace.</p>
      {searchParams?.ok && <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
      {searchParams?.error && <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

      <Card className="mt-4">
        <h2 className="font-display text-lg font-bold">Tambah paket</h2>
        <form action={upsertPackageAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nama paket"><Input name="name" required placeholder="cth. Nusantara Premium" /></Field>
          <Field label="Harga/pax (Rp)"><RupiahInput name="pricePerPax" required placeholder="35.000" /></Field>
          <Field label="Min pax"><Input name="minPax" type="number" min={1} required defaultValue={50} /></Field>
          <Field label="Maks pax"><Input name="maxPax" type="number" min={1} required defaultValue={500} /></Field>
          <div className="sm:col-span-2"><Field label="Deskripsi"><Textarea name="description" rows={2} placeholder="cth. Nasi, 2 lauk, sayur, dessert, + pramusaji." /></Field></div>
          <div className="sm:col-span-2">
            <Field label="Gambar paket (opsional)">
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full cursor-pointer rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-800" />
            </Field>
          </div>
          <fieldset className="rounded-xl bg-[#FAF7F1] p-3 ring-1 ring-inset ring-stone-200/70 sm:col-span-2">
            <legend className="px-1 text-sm font-medium text-stone-700">Menu dalam paket</legend>
            <div className="grid gap-1 sm:grid-cols-3">
              {activeMenus.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition hover:bg-white">
                  <input type="checkbox" name="menuIds" value={m.id} className="h-4 w-4 accent-orange-700" /> {m.name}
                </label>
              ))}
              {activeMenus.length === 0 && <p className="text-sm text-stone-400">Buat menu dulu di halaman Menu.</p>}
            </div>
          </fieldset>
          <div><SubmitButton>Simpan paket</SubmitButton></div>
        </form>
      </Card>

      {packages.length === 0 ? (
        <div className="mt-4"><Empty title="Belum ada paket." hint="Paket aktif otomatis tampil di marketplace dan bisa dipesan." /></div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {packages.map((p, i) => (
            <Card key={p.id} className={`relative ${i === 0 ? "ring-2 ring-brand-200" : ""}`}>
              {i === 0 && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-brand-700 px-2.5 py-0.5 text-[11px] font-bold text-white">TERMURAH</span>
              )}
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} className="mb-2 h-28 w-full rounded-xl object-cover ring-1 ring-stone-200" />
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{p.name}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                  {p.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <p className="mt-0.5">
                <span className="text-lg font-extrabold text-brand-800">{formatIDR(p.pricePerPax)}</span>
                <span className="text-sm text-stone-500">/pax · {p.minPax}–{p.maxPax} pax</span>
              </p>
              {p.description && <p className="mt-1 text-sm text-stone-600">{p.description}</p>}
              <ul className="mt-2 space-y-1 text-sm text-stone-600">
                {p.items.map((it) => (
                  <li key={it.menuItemId} className="flex items-center gap-2">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">✓</span>
                    {it.menuItem.name}
                  </li>
                ))}
              </ul>
              <details className="mt-3 border-t border-stone-100 pt-2">
                <summary className="cursor-pointer text-xs font-semibold text-brand-700">Ubah paket & gambar</summary>
                <form action={upsertPackageAction} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={p.id} />
                  <Field label="Nama paket"><Input name="name" defaultValue={p.name} required /></Field>
                  <Field label="Harga/pax (Rp)"><RupiahInput name="pricePerPax" defaultValue={p.pricePerPax} required /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Min pax"><Input name="minPax" type="number" min={1} required defaultValue={p.minPax} /></Field>
                    <Field label="Maks pax"><Input name="maxPax" type="number" min={1} required defaultValue={p.maxPax} /></Field>
                  </div>
                  <Field label="Deskripsi"><Textarea name="description" rows={2} defaultValue={p.description ?? ""} /></Field>
                  <Field label="Status">
                    <select name="isActive" defaultValue={p.isActive ? "on" : "off"} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                      <option value="on">Aktif</option>
                      <option value="off">Nonaktif</option>
                    </select>
                  </Field>
                  <fieldset className="rounded-xl bg-[#FAF7F1] p-3 ring-1 ring-inset ring-stone-200/70">
                    <legend className="px-1 text-xs font-medium text-stone-700">Menu dalam paket</legend>
                    <div className="grid gap-1">
                      {activeMenus.map((m) => (
                        <label key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm">
                          <input
                            type="checkbox"
                            name="menuIds"
                            value={m.id}
                            defaultChecked={p.items.some((it) => it.menuItemId === m.id)}
                            className="h-4 w-4 accent-orange-700"
                          />{" "}
                          {m.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="block text-xs font-medium text-stone-600">
                    <span className="mb-1 block">Ganti gambar (opsional)</span>
                    <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:font-semibold file:text-brand-800" />
                  </label>
                  {p.imageUrl && (
                    <label className="flex items-center gap-2 text-xs text-stone-600">
                      <input type="checkbox" name="removeImage" /> Hapus gambar saat disimpan
                    </label>
                  )}
                  <SubmitButton variant="secondary" className="!py-1.5 !text-xs">Simpan perubahan</SubmitButton>
                </form>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
