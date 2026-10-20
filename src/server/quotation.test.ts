import { describe, expect, it } from "vitest";
import { calcTotals } from "@/server/quotation";
import { canTransitionBooking } from "@/server/booking";
import { scoreVendor } from "@/server/marketplace";

describe("calcTotals", () => {
  it("hitung subtotal + fee − diskon", () => {
    expect(calcTotals([{ quantity: 250, unitPrice: 35000 }], 100000, 50000, 0)).toEqual({
      subtotal: 8750000,
      total: 8900000,
    });
  });
  it("total tidak negatif", () => {
    expect(calcTotals([{ quantity: 1, unitPrice: 1000 }], 0, 0, 5000).total).toBe(0);
  });
});

describe("canTransitionBooking", () => {
  it("PAID → PREPARING valid, PAID → COMPLETED tidak", () => {
    expect(canTransitionBooking("PAID", "PREPARING")).toBe(true);
    expect(canTransitionBooking("PAID", "COMPLETED")).toBe(false);
  });
  it("CANCELLED terminal", () => {
    expect(canTransitionBooking("CANCELLED", "PAID")).toBe(false);
  });
});

describe("scoreVendor", () => {
  it("vendor cocok skor lebih tinggi", () => {
    const good = scoreVendor({ hasCapacity: true, capacityFit: true, budgetFit: true, cityMatch: true, rating: 4.8 });
    const bad = scoreVendor({ hasCapacity: false, capacityFit: false, budgetFit: false, cityMatch: false, rating: 3.0 });
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.reasons.length).toBeGreaterThan(0);
  });
});
