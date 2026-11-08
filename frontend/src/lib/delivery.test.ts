import { describe, expect, it } from "vitest";
import { quoteDelivery, roadDistanceKm } from "./delivery";

const rate = { deliveryBaseFee: 15000, deliveryBaseKm: 3, deliveryPerKm: 4000, deliveryMaxKm: 25 };

// Harus identik dengan backend/test/delivery.test.ts — estimasi di form = angka di nota.
describe("delivery (salinan frontend)", () => {
  it("tarif dasar, per km dibulatkan ke atas, radius maks.", () => {
    expect(quoteDelivery(rate, 3)).toEqual({ inRange: true, distanceKm: 3, fee: 15000 });
    expect(quoteDelivery(rate, 3.1)).toMatchObject({ fee: 19000 });
    expect(quoteDelivery(rate, 8)).toMatchObject({ fee: 35000 });
    expect(quoteDelivery(rate, 30)).toEqual({ inRange: false, distanceKm: 30, maxKm: 25 });
  });

  it("jarak jalan = haversine × 1,3", () => {
    const km = roadDistanceKm({ latitude: -7.2458, longitude: 112.7378 }, { latitude: -7.3797, longitude: 112.7869 });
    expect(km).toBeGreaterThan(19);
    expect(km).toBeLessThan(22);
  });
});
