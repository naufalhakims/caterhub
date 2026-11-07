import { describe, expect, it } from "vitest";
import {
  CUSTOMER_CANCEL_MIN_DAYS,
  canTransitionBooking,
  computePaymentDueAt,
  decideCancellation,
} from "../src/domain/booking";

const HOUR = 60 * 60 * 1000;

describe("computePaymentDueAt", () => {
  const now = new Date("2026-11-07T03:00:00.000Z"); // 10:00 WIB

  it("memakai jendela 24 jam bila acara masih jauh", () => {
    const due = computePaymentDueAt(now, new Date("2026-11-20T00:00:00.000Z"), 24);
    expect(due.getTime()).toBe(now.getTime() + 24 * HOUR);
  });

  it("tidak melewati awal hari acara (00:00 WIB)", () => {
    // Acara besok: 00:00 WIB 8 Nov = 17:00 UTC 7 Nov.
    const due = computePaymentDueAt(now, new Date("2026-11-08T00:00:00.000Z"), 24);
    expect(due.toISOString()).toBe("2026-11-07T17:00:00.000Z");
  });

  it("minimal satu jam untuk pesanan yang dikonfirmasi pada hari acara", () => {
    const due = computePaymentDueAt(now, new Date("2026-11-07T00:00:00.000Z"), 24);
    expect(due.getTime()).toBe(now.getTime() + HOUR);
  });
});

describe("decideCancellation", () => {
  it("belum lunas: pelanggan dan vendor boleh batal tanpa refund", () => {
    for (const actor of ["CUSTOMER", "VENDOR"] as const) {
      expect(decideCancellation({ actor, status: "PAYMENT_PENDING", paidAmount: 0, daysUntilEvent: 0 })).toEqual({
        ok: true,
        refund: false,
        nextStatus: "CANCELLED",
      });
    }
  });

  it("vendor membatalkan pesanan lunas → refund wajib", () => {
    expect(
      decideCancellation({ actor: "VENDOR", status: "PAID", paidAmount: 500_000, daysUntilEvent: 1 }),
    ).toEqual({ ok: true, refund: true, nextStatus: "REFUND_PENDING" });
  });

  it(`pelanggan membatalkan pesanan lunas hanya sampai H-${CUSTOMER_CANCEL_MIN_DAYS}`, () => {
    expect(
      decideCancellation({
        actor: "CUSTOMER",
        status: "PAID",
        paidAmount: 500_000,
        daysUntilEvent: CUSTOMER_CANCEL_MIN_DAYS,
      }),
    ).toMatchObject({ ok: true, refund: true });
    expect(
      decideCancellation({
        actor: "CUSTOMER",
        status: "PREPARING",
        paidAmount: 500_000,
        daysUntilEvent: CUSTOMER_CANCEL_MIN_DAYS - 1,
      }).ok,
    ).toBe(false);
  });

  it("makanan sudah siap/terkirim tidak bisa dibatalkan lewat sistem", () => {
    for (const status of ["READY", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"]) {
      expect(decideCancellation({ actor: "VENDOR", status, paidAmount: 0, daysUntilEvent: 10 }).ok).toBe(false);
    }
  });
});

describe("transisi refund", () => {
  it("pesanan lunas tidak bisa langsung CANCELLED, harus lewat REFUND_PENDING", () => {
    expect(canTransitionBooking("PAID", "CANCELLED")).toBe(false);
    expect(canTransitionBooking("PAID", "REFUND_PENDING")).toBe(true);
    expect(canTransitionBooking("REFUND_PENDING", "REFUNDED")).toBe(true);
  });

  it("pembayaran telat untuk pesanan batal memicu refund", () => {
    expect(canTransitionBooking("CANCELLED", "REFUND_PENDING")).toBe(true);
    expect(canTransitionBooking("CANCELLED", "PAID")).toBe(false);
  });
});
