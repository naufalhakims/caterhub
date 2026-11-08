/**
 * Salinan `backend/src/domain/delivery.ts` untuk estimasi langsung di form.
 * Backend tetap sumber kebenaran — ubah keduanya bersamaan.
 */

export const ROAD_FACTOR = 1.3;
const EARTH_RADIUS_KM = 6371;

export type DeliveryRate = {
  deliveryBaseFee: number;
  deliveryBaseKm: number;
  deliveryPerKm: number;
  deliveryMaxKm: number;
};

/** Titik default peta: pusat Surabaya. */
export const DEFAULT_CENTER = { latitude: -7.2575, longitude: 112.7521 };

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

export function roadDistanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * ROAD_FACTOR * 10) / 10;
}

export type DeliveryQuote =
  | { inRange: true; distanceKm: number; fee: number }
  | { inRange: false; distanceKm: number; maxKm: number };

export function quoteDelivery(rate: DeliveryRate, distanceKm: number): DeliveryQuote {
  if (distanceKm > rate.deliveryMaxKm) return { inRange: false, distanceKm, maxKm: rate.deliveryMaxKm };
  const extraKm = Math.max(0, Math.ceil(distanceKm - rate.deliveryBaseKm - 1e-9));
  return { inRange: true, distanceKm, fee: rate.deliveryBaseFee + extraKm * rate.deliveryPerKm };
}

/** Ringkasan tarif untuk ditampilkan: "Rp15.000 s.d. 3 km, +Rp4.000/km, maks. 25 km". */
export function describeRate(rate: DeliveryRate, formatIDR: (n: number) => string) {
  return `${formatIDR(rate.deliveryBaseFee)} s.d. ${rate.deliveryBaseKm} km, +${formatIDR(rate.deliveryPerKm)}/km, maks. ${rate.deliveryMaxKm} km`;
}
