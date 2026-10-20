/**
 * Skor rekomendasi deterministik — SEMENTARA diduplikasi dari
 * `src/server/marketplace.ts` selama POC. Setelah endpoint ini menjadi sumber
 * tunggal, hapus salinan di Next agar aturan tidak menyimpang.
 *
 * Bobot: ketersediaan 30, kapasitas 25, budget 20, lokasi 15, rating 10.
 */
export function scoreVendor(v: {
  hasCapacity: boolean;
  capacityFit: boolean;
  budgetFit: boolean | null;
  cityMatch: boolean | null;
  rating: number;
}): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (v.hasCapacity) {
    score += 30;
    reasons.push("Tersedia pada tanggal acara");
  }
  if (v.capacityFit) {
    score += 25;
    reasons.push("Kapasitas sesuai jumlah tamu");
  }
  if (v.budgetFit === true) {
    score += 20;
    reasons.push("Sesuai budget");
  } else if (v.budgetFit === null) {
    score += 10;
  }
  if (v.cityMatch === true) {
    score += 15;
    reasons.push("Lokasi dekat");
  } else if (v.cityMatch === null) {
    score += 7;
  }
  score += Math.min(10, Math.round(v.rating * 2));
  if (v.rating >= 4.5) reasons.push("Rating tinggi");
  return { score, reasons };
}
