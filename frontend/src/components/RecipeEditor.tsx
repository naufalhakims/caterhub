"use client";

import { useMemo, useRef, useState } from "react";
import { FormButton } from "@/components/ui/FormButton";
import { formatIDR } from "@/lib/format";
import { saveRecipeAction } from "@/server/kitchen-actions";

export type IngredientOption = { id: string; name: string; unit: string; pricePerUnit: number };
type Line = { key: number; ingredientId: string; quantity: string };

const RECIPE_UNIT: Record<string, string> = { kg: "g", liter: "ml", pcs: "pcs" };
const DIVISOR: Record<string, number> = { kg: 1000, liter: 1000, pcs: 1 };

const fieldClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-ink focus:ring-4 focus:ring-sun-200";

/** Biaya satu baris resep (rupiah, belum dibulatkan). */
function lineCost(ing: IngredientOption | undefined, qty: number) {
  if (!ing || !Number.isFinite(qty)) return 0;
  return (qty / (DIVISOR[ing.unit] ?? 1)) * ing.pricePerUnit;
}

/**
 * Editor resep per porsi. Satuan input mengikuti satuan beli bahan
 * (kg → gram, liter → ml, pcs → pcs) dan HPP per porsi dihitung langsung.
 */
export function RecipeEditor({
  menuId,
  ingredients,
  initial,
}: {
  menuId: string;
  ingredients: IngredientOption[];
  initial: { ingredientId: string; quantity: number }[];
}) {
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const nextKey = useRef(initial.length + 1);
  const [lines, setLines] = useState<Line[]>(() =>
    initial.length
      ? initial.map((l, key) => ({ key, ingredientId: l.ingredientId, quantity: String(l.quantity) }))
      : [{ key: 0, ingredientId: "", quantity: "" }],
  );

  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + lineCost(byId.get(l.ingredientId), Number(l.quantity.replace(",", "."))), 0);

  return (
    <form action={saveRecipeAction} className="space-y-2">
      <input type="hidden" name="menuId" value={menuId} />
      {lines.map((l) => {
        const ing = byId.get(l.ingredientId);
        const cost = lineCost(ing, Number(l.quantity.replace(",", ".")));
        return (
          <div key={l.key} className="grid grid-cols-[1fr_110px_auto] items-center gap-2 sm:grid-cols-[1fr_130px_90px_32px]">
            <select
              name="ingredientId"
              value={l.ingredientId}
              onChange={(e) => update(l.key, { ingredientId: e.target.value })}
              aria-label="Bahan"
              className={fieldClass}
            >
              <option value="">Pilih bahan…</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({formatIDR(i.pricePerUnit)}/{i.unit})
                </option>
              ))}
            </select>
            <div className="relative">
              <input
                name="quantity"
                inputMode="decimal"
                value={l.quantity}
                onChange={(e) => update(l.key, { quantity: e.target.value.replace(/[^\d.,]/g, "") })}
                placeholder="0"
                aria-label="Jumlah per porsi"
                className={`${fieldClass} pr-11 text-right`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-stone-500">
                {ing ? RECIPE_UNIT[ing.unit] ?? ing.unit : "—"}
              </span>
            </div>
            <span className="hidden text-right text-xs tabular-nums text-stone-500 sm:block">{cost ? formatIDR(Math.round(cost)) : "—"}</span>
            <button
              type="button"
              onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [{ key: nextKey.current++, ingredientId: "", quantity: "" }]))}
              aria-label="Hapus bahan"
              className="rounded-lg p-1.5 text-sm text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, { key: nextKey.current++, ingredientId: "", quantity: "" }])}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
        >
          + Tambah bahan
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-600">
            HPP bahan <span className="font-display text-lg text-ink">{formatIDR(Math.round(total))}</span>/porsi
          </span>
          <FormButton variant="dark" pendingLabel="Menyimpan…" className="!py-2">
            Simpan resep
          </FormButton>
        </div>
      </div>
    </form>
  );
}
