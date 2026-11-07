/**
 * Perhitungan HPP (harga pokok produksi) dan lembar produksi dapur.
 * Fungsi murni — tanpa akses database — agar mudah diuji.
 *
 * Konvensi satuan: bahan dibeli per `kg` / `liter` / `pcs`; resep mencatat
 * kebutuhan per porsi dalam satuan kecil: gram (kg), ml (liter), pcs (pcs).
 */

export const INGREDIENT_UNITS = ["kg", "liter", "pcs"] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

/** Satuan kecil yang dipakai di resep untuk tiap satuan beli. */
export const RECIPE_UNIT: Record<IngredientUnit, string> = { kg: "g", liter: "ml", pcs: "pcs" };

function perPurchaseUnit(unit: string): number {
  return unit === "kg" || unit === "liter" ? 1000 : 1;
}

/** Konversi kebutuhan satuan kecil → satuan beli (gram → kg, ml → liter). */
export function toPurchaseQty(unit: string, recipeQty: number): number {
  return recipeQty / perPurchaseUnit(unit);
}

/** Biaya bahan untuk sejumlah satuan kecil, dalam rupiah (pecahan dipertahankan). */
export function ingredientCost(unit: string, pricePerUnit: number, recipeQty: number): number {
  return toPurchaseQty(unit, recipeQty) * pricePerUnit;
}

export type RecipeLine = {
  ingredientId: string;
  quantity: number; // per porsi, satuan kecil
  ingredient: { name: string; unit: string; pricePerUnit: number };
};

/** HPP bahan per porsi sebuah menu. */
export function menuCostPerPortion(recipe: RecipeLine[]): number {
  return recipe.reduce((sum, r) => sum + ingredientCost(r.ingredient.unit, r.ingredient.pricePerUnit, r.quantity), 0);
}

export type PackageCosting = {
  materialCost: number;
  otherCost: number;
  hpp: number;
  margin: number;
  marginPct: number | null;
};

/** HPP paket per pax = jumlah HPP menu di dalamnya + biaya lain per porsi. */
export function packageCosting(input: {
  pricePerPax: number;
  otherCostPerPax: number;
  menuCosts: number[];
}): PackageCosting {
  const materialCost = input.menuCosts.reduce((s, c) => s + c, 0);
  const hpp = materialCost + input.otherCostPerPax;
  const margin = input.pricePerPax - hpp;
  return {
    materialCost: Math.round(materialCost),
    otherCost: input.otherCostPerPax,
    hpp: Math.round(hpp),
    margin: Math.round(margin),
    marginPct: input.pricePerPax > 0 ? Math.round((margin / input.pricePerPax) * 1000) / 10 : null,
  };
}

// ---------------------------------------------------------------------------
// Lembar produksi
// ---------------------------------------------------------------------------

export type ProductionMenu = {
  id: string;
  name: string;
  category: string;
  recipe: RecipeLine[];
};

export type ProductionOrder = {
  guests: number;
  /** Menu di dalam paket — masing-masing satu porsi per tamu. */
  packageMenuIds: string[];
  /** Baris nota yang tertaut ke menu (menu tambahan): quantity = jumlah porsi. */
  linkedItems: { menuItemId: string; quantity: number }[];
};

export type ProductionSummary = {
  menus: { id: string; name: string; category: string; portions: number }[];
  ingredients: {
    id: string;
    name: string;
    unit: string;
    recipeUnit: string;
    recipeQty: number;
    purchaseQty: number;
    cost: number;
  }[];
  totalCost: number;
  /** Menu yang dipesan tetapi belum punya resep (tidak masuk daftar belanja). */
  missingRecipes: string[];
};

/** Rekap porsi per menu dan total bahan untuk sekumpulan pesanan. */
export function aggregateProduction(orders: ProductionOrder[], menus: ProductionMenu[]): ProductionSummary {
  const menuById = new Map(menus.map((m) => [m.id, m]));
  const portions = new Map<string, number>();
  const add = (id: string, n: number) => {
    if (!menuById.has(id) || n <= 0) return;
    portions.set(id, (portions.get(id) ?? 0) + n);
  };
  for (const o of orders) {
    for (const id of o.packageMenuIds) add(id, o.guests);
    for (const li of o.linkedItems) add(li.menuItemId, li.quantity);
  }

  const totals = new Map<string, { name: string; unit: string; qty: number; price: number }>();
  const missing: string[] = [];
  for (const [id, n] of portions) {
    const menu = menuById.get(id)!;
    if (menu.recipe.length === 0) missing.push(menu.name);
    for (const r of menu.recipe) {
      const t = totals.get(r.ingredientId) ?? {
        name: r.ingredient.name,
        unit: r.ingredient.unit,
        qty: 0,
        price: r.ingredient.pricePerUnit,
      };
      t.qty += r.quantity * n;
      totals.set(r.ingredientId, t);
    }
  }

  const ingredients = [...totals.entries()]
    .map(([id, t]) => ({
      id,
      name: t.name,
      unit: t.unit,
      recipeUnit: RECIPE_UNIT[t.unit as IngredientUnit] ?? t.unit,
      recipeQty: Math.round(t.qty * 100) / 100,
      purchaseQty: Math.round(toPurchaseQty(t.unit, t.qty) * 100) / 100,
      cost: Math.round(ingredientCost(t.unit, t.price, t.qty)),
    }))
    .sort((a, b) => b.cost - a.cost);

  return {
    menus: [...portions.entries()]
      .map(([id, n]) => ({ id, name: menuById.get(id)!.name, category: menuById.get(id)!.category, portions: n }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    ingredients,
    totalCost: ingredients.reduce((s, i) => s + i.cost, 0),
    missingRecipes: missing.sort(),
  };
}
