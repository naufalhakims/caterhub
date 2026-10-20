/** Aturan bisnis ulasan vendor. */

export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;

export type ReviewEligibility = {
  actorId: string;
  customerId: string;
  bookingStatus: string;
  hasReview: boolean;
};

/**
 * Ulasan hanya boleh dibuat sekali oleh pelanggan pemilik pesanan,
 * setelah pesanan benar-benar selesai.
 */
export function canReviewBooking({
  actorId,
  customerId,
  bookingStatus,
  hasReview,
}: ReviewEligibility): boolean {
  return actorId === customerId && bookingStatus === "COMPLETED" && !hasReview;
}

/** Bulatkan rata-rata rating ke satu desimal agar tampilan kartu konsisten. */
export function roundRating(average: number | null | undefined): number {
  if (average == null || !Number.isFinite(average)) return 0;
  return Math.round(average * 10) / 10;
}
