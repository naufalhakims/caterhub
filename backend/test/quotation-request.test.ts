import { describe, expect, it } from "vitest";
import { buildRequestItems, calcTotals } from "../src/domain/quotation";

describe("buildRequestItems", () => {
  it("paket saja: satu baris paket × tamu", () => {
    const items = buildRequestItems({ name: "Hemat", pricePerPax: 30_000 }, [], 100);
    expect(items).toEqual([{ name: "Paket Hemat (100 pax)", quantity: 100, unitPrice: 30_000, subtotal: 3_000_000 }]);
  });

  it("menu tambahan dihitung per pax dan ikut ke total", () => {
    const items = buildRequestItems(
      { name: "Hemat", pricePerPax: 30_000 },
      [
        { name: "Es teler", price: 5_000 },
        { name: "Rendang", price: 9_000 },
      ],
      50,
    );
    expect(items.map((i) => i.name)).toEqual(["Paket Hemat (50 pax)", "Tambahan: Es teler", "Tambahan: Rendang"]);
    expect(items.every((i) => i.quantity === 50)).toBe(true);
    expect(calcTotals(items).subtotal).toBe(50 * (30_000 + 5_000 + 9_000));
  });
});
