/** Aturan bisnis ulasan vendor. */

export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;

export type ReviewEligibility = {
  actorId: string;
  customerId: string;
  bookingStatus: string;
  hasReview: boolean;
  paidAmount: number;
  totalAmount: number;
};

/** Status pesanan yang berarti pelanggan sudah membayar lunas. */
export const REVIEWABLE_BOOKING_STATUSES = [
  "PAID",
  "PREPARING",
  "READY",
  "DELIVERED",
  "COMPLETED",
] as const;

/**
 * Ulasan hanya boleh dibuat sekali oleh pelanggan pemilik pesanan,
 * setelah pesanan dibayar lunas (tidak harus menunggu selesai).
 */
export function canReviewBooking({
  actorId,
  customerId,
  bookingStatus,
  hasReview,
  paidAmount,
  totalAmount,
}: ReviewEligibility): boolean {
  return (
    actorId === customerId &&
    (REVIEWABLE_BOOKING_STATUSES as readonly string[]).includes(bookingStatus) &&
    totalAmount > 0 &&
    paidAmount >= totalAmount &&
    !hasReview
  );
}

/** Bulatkan rata-rata rating ke satu desimal agar tampilan kartu konsisten. */
export function roundRating(average: number | null | undefined): number {
  if (average == null || !Number.isFinite(average)) return 0;
  return Math.round(average * 10) / 10;
}
