/**
 * Jarak & ongkir otomatis. Fungsi murni — salinannya ada di
 * `frontend/src/lib/delivery.ts` untuk estimasi langsung di form; ubah keduanya bersamaan.
 *
 * Jarak = garis lurus (haversine) × faktor jalan 1,3 — perkiraan tanpa API peta.
 * Ongkir = tarif dasar (menanggung N km pertama) + sisa km (dibulatkan ke atas) × tarif per km.
 */

export const ROAD_FACTOR = 1.3;
const EARTH_RADIUS_KM = 6371;

export type LatLng = { latitude: number; longitude: number };

export type DeliveryRate = {
  deliveryBaseFee: number;
  deliveryBaseKm: number;
  deliveryPerKm: number;
  deliveryMaxKm: number;
};

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Perkiraan jarak jalan (km, 1 desimal). */
export function roadDistanceKm(from: LatLng, to: LatLng): number {
  return Math.round(haversineKm(from, to) * ROAD_FACTOR * 10) / 10;
}

export type DeliveryQuote =
  | { inRange: true; distanceKm: number; fee: number }
  | { inRange: false; distanceKm: number; maxKm: number };

export function quoteDelivery(rate: DeliveryRate, distanceKm: number): DeliveryQuote {
  if (distanceKm > rate.deliveryMaxKm) return { inRange: false, distanceKm, maxKm: rate.deliveryMaxKm };
  const extraKm = Math.max(0, Math.ceil(distanceKm - rate.deliveryBaseKm - 1e-9));
  return { inRange: true, distanceKm, fee: rate.deliveryBaseFee + extraKm * rate.deliveryPerKm };
}

/** Jarak + ongkir dari dapur vendor ke lokasi acara; null bila salah satu titik belum ada. */
type MaybeLatLng = { latitude?: number | null; longitude?: number | null };

export function quoteDeliveryBetween(vendor: MaybeLatLng & DeliveryRate, event: MaybeLatLng): DeliveryQuote | null {
  if (!isValidLatLng(vendor.latitude, vendor.longitude) || !isValidLatLng(event.latitude, event.longitude)) return null;
  const km = roadDistanceKm(
    { latitude: vendor.latitude!, longitude: vendor.longitude! },
    { latitude: event.latitude!, longitude: event.longitude! },
  );
  return quoteDelivery(vendor, km);
}
