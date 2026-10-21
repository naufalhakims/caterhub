import { describe, expect, it } from "vitest";
import { calcTotals } from "../src/domain/quotation";
import { canTransitionBooking, canVendorSetBookingStatus } from "../src/domain/booking";
import {
  canPerformQuotationDecision,
  canTransitionQuotation,
  nextQuotationStatus,
} from "../src/domain/quotation-workflow";
import { scoreVendor } from "../src/vendors/scoring";
import {
  canViewBooking,
  canViewPayment,
  canViewQuotation,
  isOfferParty,
} from "../src/domain/access";

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

  it("vendor tidak boleh menandai PAID sendiri", () => {
    expect(canVendorSetBookingStatus("PAID")).toBe(false);
    expect(canVendorSetBookingStatus("PREPARING")).toBe(true);
    expect(canVendorSetBookingStatus("CANCELLED")).toBe(true);
  });
});

describe("alur konfirmasi pesanan", () => {
  it("vendor mengonfirmasi permintaan REQUESTED menjadi ACCEPTED", () => {
    expect(canTransitionQuotation("REQUESTED", "ACCEPTED")).toBe(true);
    expect(
      canPerformQuotationDecision({
        decision: "confirm_request",
        actorRole: "VENDOR",
        origin: "CUSTOMER_REQUEST",
        status: "REQUESTED",
      }),
    ).toBe(true);
    expect(nextQuotationStatus("confirm_request")).toBe("ACCEPTED");
  });

  it("pelanggan tidak bisa mengonfirmasi pesanannya sendiri", () => {
    expect(
      canPerformQuotationDecision({
        decision: "confirm_request",
        actorRole: "CUSTOMER",
        origin: "CUSTOMER_REQUEST",
        status: "REQUESTED",
      }),
    ).toBe(false);
  });
});

describe("scoreVendor", () => {
  it("vendor cocok skor lebih tinggi", () => {
    const good = scoreVendor({
      hasCapacity: true,
      capacityFit: true,
      budgetFit: true,
      cityMatch: true,
      rating: 4.8,
    });
    const bad = scoreVendor({
      hasCapacity: false,
      capacityFit: false,
      budgetFit: false,
      cityMatch: false,
      rating: 3.0,
    });
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.reasons.length).toBeGreaterThan(0);
  });
});

const customer = { id: "cust_1", role: "CUSTOMER" as const };
const vendorUser = { id: "vend_1", role: "VENDOR" as const };
const stranger = { id: "cust_2", role: "CUSTOMER" as const };
const admin = { id: "adm_1", role: "ADMIN" as const };

describe("akses penawaran/booking", () => {
  const quotation = { customerId: customer.id, vendorUserId: vendorUser.id };

  it("pelanggan pemilik & vendor terkait boleh melihat", () => {
    expect(canViewQuotation(customer, quotation)).toBe(true);
    expect(canViewQuotation(vendorUser, quotation)).toBe(true);
  });

  it("pelanggan lain tidak boleh (IDOR)", () => {
    expect(canViewQuotation(stranger, quotation)).toBe(false);
    expect(canViewBooking(stranger, quotation)).toBe(false);
  });

  it("admin boleh meninjau, tetapi BUKAN pihak chat", () => {
    expect(canViewQuotation(admin, quotation)).toBe(true);
    expect(isOfferParty(admin, quotation)).toBe(false);
    expect(isOfferParty(customer, quotation)).toBe(true);
    expect(isOfferParty(vendorUser, quotation)).toBe(true);
    expect(isOfferParty(stranger, quotation)).toBe(false);
  });
});

describe("akses pembayaran", () => {
  it("hanya pelanggan pemilik (dan admin) yang boleh melihat", () => {
    const payment = { customerId: customer.id };
    expect(canViewPayment(customer, payment)).toBe(true);
    expect(canViewPayment(admin, payment)).toBe(true);
    expect(canViewPayment(stranger, payment)).toBe(false);
    expect(canViewPayment(vendorUser, payment)).toBe(false);
  });
});
