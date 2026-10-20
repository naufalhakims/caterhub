import { describe, expect, it } from "vitest";
import { canReviewBooking, roundRating } from "../src/domain/review";

describe("canReviewBooking", () => {
  const base = {
    actorId: "cust_1",
    customerId: "cust_1",
    bookingStatus: "COMPLETED",
    hasReview: false,
  };

  it("mengizinkan pelanggan pemilik mengulas pesanan selesai", () => {
    expect(canReviewBooking(base)).toBe(true);
  });

  it("menolak pelanggan lain (IDOR)", () => {
    expect(canReviewBooking({ ...base, actorId: "cust_2" })).toBe(false);
  });

  it("menolak pesanan yang belum selesai", () => {
    expect(canReviewBooking({ ...base, bookingStatus: "DELIVERED" })).toBe(false);
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
