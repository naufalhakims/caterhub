import { describe, expect, it } from "vitest";
import { aggregateProduction, ingredientCost, menuCostPerPortion, packageCosting, toPurchaseQty } from "../src/domain/costing";

const ayam = { name: "Ayam", unit: "kg", pricePerUnit: 40_000 };
const kecap = { name: "Kecap", unit: "liter", pricePerUnit: 30_000 };
const telur = { name: "Telur", unit: "pcs", pricePerUnit: 2_000 };

describe("konversi & biaya bahan", () => {
  it("gram → kg dan ml → liter, pcs tetap", () => {
    expect(toPurchaseQty("kg", 1500)).toBe(1.5);
    expect(toPurchaseQty("liter", 250)).toBe(0.25);
    expect(toPurchaseQty("pcs", 3)).toBe(3);
  });

  it("biaya 150 g ayam @Rp40.000/kg = Rp6.000", () => {
    expect(ingredientCost("kg", 40_000, 150)).toBe(6_000);
  });
});

describe("HPP menu & paket", () => {
  const ayamBakar = [
    { ingredientId: "a", quantity: 150, ingredient: ayam },
    { ingredientId: "k", quantity: 10, ingredient: kecap },
  ];

  it("HPP menu = jumlah biaya bahan per porsi", () => {
    expect(menuCostPerPortion(ayamBakar)).toBe(6_000 + 300);
  });

  it("HPP paket = HPP menu + biaya lain; margin & persen", () => {
    const c = packageCosting({ pricePerPax: 35_000, otherCostPerPax: 3_000, menuCosts: [6_300, 4_000, 1_200] });
    expect(c).toEqual({ materialCost: 11_500, otherCost: 3_000, hpp: 14_500, margin: 20_500, marginPct: 58.6 });
  });

  it("margin negatif terdeteksi (harga di bawah HPP)", () => {
    expect(packageCosting({ pricePerPax: 10_000, otherCostPerPax: 0, menuCosts: [12_000] }).margin).toBe(-2_000);
  });
});

describe("aggregateProduction", () => {
  const menus = [
    { id: "m1", name: "Ayam bakar", category: "Lauk", recipe: [{ ingredientId: "a", quantity: 150, ingredient: ayam }] },
    { id: "m2", name: "Telur balado", category: "Lauk", recipe: [{ ingredientId: "t", quantity: 1, ingredient: telur }] },
    { id: "m3", name: "Es teler", category: "Minuman", recipe: [] },
  ];

  it("porsi paket = tamu, menu tambahan = quantity baris; bahan dijumlahkan", () => {
    const s = aggregateProduction(
      [
        { guests: 100, packageMenuIds: ["m1", "m2"], linkedItems: [] },
        { guests: 50, packageMenuIds: ["m1"], linkedItems: [{ menuItemId: "m3", quantity: 50 }] },
      ],
      menus,
    );
    expect(s.menus.map((m) => [m.name, m.portions])).toEqual([
      ["Ayam bakar", 150],
      ["Telur balado", 100],
      ["Es teler", 50],
    ]);
    const ayamRow = s.ingredients.find((i) => i.id === "a")!;
    expect(ayamRow).toMatchObject({ recipeQty: 22_500, purchaseQty: 22.5, cost: 900_000, recipeUnit: "g" });
    expect(s.ingredients.find((i) => i.id === "t")).toMatchObject({ purchaseQty: 100, cost: 200_000 });
    expect(s.totalCost).toBe(1_100_000);
    expect(s.missingRecipes).toEqual(["Es teler"]);
  });

  it("menu asing (bukan milik vendor) diabaikan", () => {
    const s = aggregateProduction([{ guests: 10, packageMenuIds: ["x"], linkedItems: [] }], menus);
    expect(s.menus).toEqual([]);
    expect(s.totalCost).toBe(0);
  });
});
