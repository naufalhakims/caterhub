import { describe, expect, it } from "vitest";
import { canReviewBooking, roundRating } from "../src/domain/review";

describe("canReviewBooking", () => {
  const base = {
    actorId: "cust_1",
    customerId: "cust_1",
    bookingStatus: "PAID",
    hasReview: false,
    paidAmount: 1_000_000,
    totalAmount: 1_000_000,
  };

  it("mengizinkan pelanggan pemilik mengulas pesanan yang sudah lunas", () => {
    expect(canReviewBooking(base)).toBe(true);
    expect(canReviewBooking({ ...base, bookingStatus: "PREPARING" })).toBe(true);
    expect(canReviewBooking({ ...base, bookingStatus: "COMPLETED" })).toBe(true);
  });

  it("menolak pelanggan lain (IDOR)", () => {
    expect(canReviewBooking({ ...base, actorId: "cust_2" })).toBe(false);
  });

  it("menolak pesanan yang belum dibayar", () => {
    expect(canReviewBooking({ ...base, bookingStatus: "PAYMENT_PENDING", paidAmount: 0 })).toBe(false);
  });

  it("menolak pesanan yang baru dibayar sebagian", () => {
    expect(canReviewBooking({ ...base, paidAmount: 500_000 })).toBe(false);
  });

  it("menolak ulasan ganda", () => {
    expect(canReviewBooking({ ...base, hasReview: true })).toBe(false);
  });
});

describe("roundRating", () => {
  it("membulatkan ke satu desimal", () => {
    expect(roundRating(4.666)).toBe(4.7);
    expect(roundRating(4.2)).toBe(4.2);
  });

  it("mengembalikan 0 untuk vendor tanpa ulasan", () => {
    expect(roundRating(null)).toBe(0);
    expect(roundRating(undefined)).toBe(0);
  });
});
