import { describe, expect, it } from "vitest";
import { haversineKm, quoteDelivery, quoteDeliveryBetween, roadDistanceKm } from "../src/domain/delivery";

const rate = { deliveryBaseFee: 15000, deliveryBaseKm: 3, deliveryPerKm: 4000, deliveryMaxKm: 25 };

describe("jarak", () => {
  it("haversine Tugu Pahlawan → Bandara Juanda ±16 km garis lurus", () => {
    const km = haversineKm({ latitude: -7.2458, longitude: 112.7378 }, { latitude: -7.3797, longitude: 112.7869 });
    expect(km).toBeGreaterThan(15);
    expect(km).toBeLessThan(17);
  });

  it("perkiraan jalan = garis lurus × 1,3 (1 desimal)", () => {
    const a = { latitude: -7.2458, longitude: 112.7378 };
    const b = { latitude: -7.3797, longitude: 112.7869 };
    expect(roadDistanceKm(a, b)).toBeCloseTo(Math.round(haversineKm(a, b) * 1.3 * 10) / 10, 5);
  });
});

describe("tarif ongkir dasar + per km", () => {
  it("dalam jarak dasar → tarif dasar", () => {
    expect(quoteDelivery(rate, 2)).toEqual({ inRange: true, distanceKm: 2, fee: 15000 });
    expect(quoteDelivery(rate, 3)).toEqual({ inRange: true, distanceKm: 3, fee: 15000 });
  });

  it("sisa km dibulatkan ke atas", () => {
    expect(quoteDelivery(rate, 8).inRange && quoteDelivery(rate, 8)).toMatchObject({ fee: 35000 });
    expect(quoteDelivery(rate, 3.1)).toMatchObject({ fee: 19000 });
  });

  it("di luar radius ditolak", () => {
    expect(quoteDelivery(rate, 30)).toEqual({ inRange: false, distanceKm: 30, maxKm: 25 });
  });

  it("tanpa koordinat → null (ongkir diisi manual)", () => {
    expect(quoteDeliveryBetween({ ...rate, latitude: -7.3, longitude: 112.7 }, {})).toBeNull();
    expect(quoteDeliveryBetween({ ...rate }, { latitude: -7.3, longitude: 112.7 })).toBeNull();
  });
});
