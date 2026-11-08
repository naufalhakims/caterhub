import Link from "next/link";
import { Card, Empty } from "@/components/ui/Card";
import { Flash } from "@/components/ui/Flash";
import { FormButton } from "@/components/ui/FormButton";
import { Field, Input, Select } from "@/components/ui/Field";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { RecipeEditor } from "@/components/RecipeEditor";
import { formatIDR } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import {
  deleteIngredientAction,
  savePackageCostAction,
  upsertIngredientAction,
} from "@/server/kitchen-actions";

type Ingredient = { id: string; name: string; unit: string; pricePerUnit: number };
type Costing = {
  ingredients: Ingredient[];
  menus: {
    id: string;
    name: string;
    category: string;
    price: number;
    isAvailable: boolean;
    recipe: { ingredientId: string; quantity: number; ingredient: { name: string; unit: string } }[];
    costPerPortion: number;
  }[];
  packages: {
    id: string;
    name: string;
    pricePerPax: number;
    otherCostPerPax: number;
    isActive: boolean;
    menus: { id: string; name: string; cost: number }[];
    missingRecipes: string[];
    costing: { materialCost: number; otherCost: number; hpp: number; margin: number; marginPct: number | null };
  }[];
};

const TABS = [
  ["paket", "Paket & margin"],
  ["resep", "Resep menu"],
  ["bahan", "Bahan baku"],
] as const;

const UNIT_LABEL: Record<string, string> = { kg: "kg", liter: "liter", pcs: "pcs" };

/**
 * Warna margin: merah rugi, kuning tipis (<20%), hijau sehat. Bila resep belum
 * lengkap, HPP masih terlalu rendah — jangan menyebutnya "sehat".
 */
function marginTone(pct: number | null, incomplete: boolean) {
  if (pct != null && pct < 0) return { bar: "bg-red-500", text: "text-red-700", label: "Rugi" };
  if (incomplete) return { bar: "bg-stone-400", text: "text-stone-500", label: "Belum lengkap" };
  if (pct == null) return { bar: "bg-stone-400", text: "text-stone-500", label: "—" };
  if (pct < 20) return { bar: "bg-amber-400", text: "text-amber-700", label: "Tipis" };
  return { bar: "bg-emerald-500", text: "text-emerald-700", label: "Sehat" };
}

export default async function CostingPage({
  searchParams,
}: {
  searchParams?: { tab?: string; ok?: string; error?: string };
}) {
  await requireVendor();
  const data = await apiGet<Costing>("/api/v1/vendor/costing");
  const tab = TABS.some(([k]) => k === searchParams?.tab) ? searchParams!.tab! : "paket";
  const menusWithoutRecipe = data.menus.filter((m) => m.recipe.length === 0).length;

  return (
    <div>
      <h1 className="font-display text-4xl text-ink sm:text-5xl">
        Bahan & <em>HPP</em>
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-500">
        Catat harga bahan baku dan resep per porsi. Harga pokok (HPP) dan margin setiap paket dihitung otomatis — dasar
        untuk menetapkan harga yang sehat dan menyusun daftar belanja produksi.
      </p>
      <Flash ok={searchParams?.ok} error={searchParams?.error} />

      <div className="mt-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-stone-100 p-1 [scrollbar-width:none]" role="tablist">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/vendor/costing?tab=${key}`}
            role="tab"
            aria-selected={tab === key}
            className={`pressable shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ease-fluid ${
              tab === key ? "bg-white text-ink shadow-soft" : "text-stone-500 hover:text-ink"
            }`}
          >
            {label}
            {key === "resep" && menusWithoutRecipe > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">{menusWithoutRecipe}</span>
            )}
          </Link>
        ))}
      </div>

      {tab === "paket" && (
        <section className="mt-6 space-y-4">
          {data.ingredients.length === 0 && (
            <p className="rounded-2xl bg-sun-100 px-4 py-3 text-sm text-stone-800 ring-1 ring-inset ring-sun-300">
              Mulai dari tab <Link href="/vendor/costing?tab=bahan" className="font-semibold underline">Bahan baku</Link>, lalu
              isi <Link href="/vendor/costing?tab=resep" className="font-semibold underline">resep menu</Link> — HPP paket akan
              terisi otomatis.
            </p>
          )}
          {data.packages.map((p) => {
            const incomplete = p.missingRecipes.length > 0 || p.menus.length === 0;
            const tone = marginTone(p.costing.marginPct, incomplete);
            const hppShare = p.pricePerPax > 0 ? Math.min(100, Math.max(0, (p.costing.hpp / p.pricePerPax) * 100)) : 0;
            return (
              <Card key={p.id} className="!p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-ink">
                      {p.name} {!p.isActive && <span className="ml-1 text-xs font-normal text-stone-400">(nonaktif)</span>}
                    </p>
                    <p className="text-sm text-stone-500">Harga jual {formatIDR(p.pricePerPax)}/pax</p>
                  </div>
                  <div className="sm:text-right">
                    <p className={`font-display text-3xl ${tone.text}`}>
                      {p.costing.marginPct == null ? "—" : `${incomplete ? "≤ " : ""}${p.costing.marginPct}%`}
                    </p>
                    <p className="text-xs text-stone-500">
                      Margin {formatIDR(p.costing.margin)}/pax · {tone.label}
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
                  <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${hppShare}%` }} />
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <div className="flex justify-between sm:block">
                    <dt className="text-stone-500">Bahan baku</dt>
                    <dd className="font-semibold tabular-nums">{formatIDR(p.costing.materialCost)}</dd>
                  </div>
                  <div className="flex justify-between sm:block">
                    <dt className="text-stone-500">Biaya lain</dt>
                    <dd className="font-semibold tabular-nums">{formatIDR(p.costing.otherCost)}</dd>
                  </div>
                  <div className="flex justify-between sm:block">
                    <dt className="text-stone-500">HPP per pax</dt>
                    <dd className="font-semibold tabular-nums">{formatIDR(p.costing.hpp)}</dd>
                  </div>
                </dl>

                {p.missingRecipes.length > 0 && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                    Belum ada resep: {p.missingRecipes.join(", ")} — HPP masih di bawah angka sebenarnya.{" "}
                    <Link href="/vendor/costing?tab=resep" className="font-semibold underline">Isi resep →</Link>
                  </p>
                )}

                <div className="mt-4 grid gap-4 border-t border-stone-100 pt-4 sm:grid-cols-[1fr_auto]">
                  <ul className="space-y-1 text-sm">
                    {p.menus.map((m) => (
                      <li key={m.id} className="flex justify-between gap-3 text-stone-600">
                        <span>{m.name}</span>
                        <span className="tabular-nums">{m.cost ? formatIDR(m.cost) : "—"}</span>
                      </li>
                    ))}
                    {p.menus.length === 0 && <li className="text-stone-400">Paket belum berisi menu.</li>}
                  </ul>
                  <form action={savePackageCostAction} className="flex items-end gap-2 sm:w-72">
                    <input type="hidden" name="id" value={p.id} />
                    <label className="block flex-1">
                      <span className="mb-1.5 block text-xs font-semibold text-ink">Biaya lain / porsi</span>
                      <RupiahInput name="otherCostPerPax" defaultValue={p.otherCostPerPax} />
                    </label>
                    <FormButton variant="secondary" pendingLabel="…" className="!px-4">
                      Simpan
                    </FormButton>
                  </form>
                </div>
                <p className="mt-2 text-[11px] text-stone-400">Biaya lain: kemasan, gas, tenaga masak & pramusaji per porsi.</p>
              </Card>
            );
          })}
          {data.packages.length === 0 && <Empty title="Belum ada paket." hint="Buat paket di menu Paket terlebih dahulu." />}
        </section>
      )}

      {tab === "resep" && (
        <section className="mt-6 space-y-3">
          {data.ingredients.length === 0 ? (
            <Empty
              title="Tambahkan bahan baku dulu."
              hint="Resep disusun dari daftar bahan beserta harganya."
              action={<Link href="/vendor/costing?tab=bahan" className="font-semibold text-brand-700 underline">Ke tab Bahan baku →</Link>}
            />
          ) : (
            data.menus.map((m) => (
              <details
                key={m.id}
                id={`menu-${m.id}`}
                className="group scroll-mt-24 rounded-3xl border border-stone-200 bg-white p-4 open:pb-5"
                open={m.recipe.length === 0}
              >
                <summary className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{m.name}</span>
                    <span className="ml-2 text-xs text-stone-400">{m.category}</span>
                    {m.recipe.length === 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Belum ada resep</span>
                    )}
                  </span>
                  <span className="flex items-center gap-3 text-sm">
                    <span className="text-stone-500">
                      HPP <span className="font-semibold tabular-nums text-ink">{formatIDR(m.costPerPortion)}</span>/porsi
                    </span>
                    <span aria-hidden className="text-stone-400 transition-transform duration-300 ease-fluid group-open:rotate-180">⌄</span>
                  </span>
                </summary>
                <div className="disclose-panel mt-4">
                  <RecipeEditor
                    menuId={m.id}
                    ingredients={data.ingredients}
                    initial={m.recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity }))}
                  />
                </div>
              </details>
            ))
          )}
          {data.menus.length === 0 && <Empty title="Belum ada menu." hint="Tambahkan menu di halaman Menu." />}
        </section>
      )}

      {tab === "bahan" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="h-fit !p-5">
            <h2 className="font-display text-2xl text-ink">Tambah bahan</h2>
            <form action={upsertIngredientAction} className="mt-3 space-y-3">
              <Field label="Nama bahan">
                <Input name="name" required minLength={2} maxLength={80} placeholder="cth. Daging ayam" />
              </Field>
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <Field label="Harga (Rp)">
                  <RupiahInput name="pricePerUnit" required placeholder="38.000" />
                </Field>
                <Field label="Per">
                  <Select name="unit" defaultValue="kg">
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                    <option value="pcs">pcs</option>
                  </Select>
                </Field>
              </div>
              <p className="text-xs text-stone-500">Resep memakai gram (kg), ml (liter), atau pcs.</p>
              <FormButton className="w-full" pendingLabel="Menyimpan…">
                Tambah bahan
              </FormButton>
            </form>
          </Card>

          <div className="space-y-2">
            {data.ingredients.map((i) => (
              <details key={i.id} className="group rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <summary className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{i.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-stone-600">
                      {formatIDR(i.pricePerUnit)}/{UNIT_LABEL[i.unit] ?? i.unit}
                    </span>
                    <span className="text-xs font-semibold text-brand-700">Ubah</span>
                  </span>
                </summary>
                <div className="disclose-panel mt-3 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
                  <form action={upsertIngredientAction} className="flex flex-1 flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={i.id} />
                    <label className="block min-w-[10rem] flex-1">
                      <span className="mb-1 block text-xs font-semibold">Nama</span>
                      <Input name="name" defaultValue={i.name} required minLength={2} />
                    </label>
                    <label className="block w-36">
                      <span className="mb-1 block text-xs font-semibold">Harga</span>
                      <RupiahInput name="pricePerUnit" defaultValue={i.pricePerUnit} required />
                    </label>
                    <label className="block w-24">
                      <span className="mb-1 block text-xs font-semibold">Per</span>
                      <Select name="unit" defaultValue={i.unit}>
                        <option value="kg">kg</option>
                        <option value="liter">liter</option>
                        <option value="pcs">pcs</option>
                      </Select>
                    </label>
                    <FormButton variant="dark" pendingLabel="…">Simpan</FormButton>
                  </form>
                  <form action={deleteIngredientAction}>
                    <input type="hidden" name="id" value={i.id} />
                    <FormButton variant="ghost" pendingLabel="…" className="!text-red-600 hover:!bg-red-50">
                      Hapus
                    </FormButton>
                  </form>
                </div>
              </details>
            ))}
            {data.ingredients.length === 0 && (
              <Empty title="Belum ada bahan." hint="Tambahkan bahan yang biasa Anda beli: beras, ayam, minyak, telur, dll." />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
