import { describe, expect, it } from "vitest";
import { canConfirmReceipt, eventStartAt } from "../src/domain/progress";
import { canTransitionBooking, canVendorSetBookingStatus } from "../src/domain/booking";

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("eventStartAt", () => {
  it("jam acara WIB → instant UTC", () => {
    expect(eventStartAt(D("2026-11-10"), "10:00").toISOString()).toBe("2026-11-10T03:00:00.000Z");
  });

  it("menerima format rentang & titik", () => {
    expect(eventStartAt(D("2026-11-10"), "10.00–14.00").toISOString()).toBe("2026-11-10T03:00:00.000Z");
    expect(eventStartAt(D("2026-11-10"), "18:30").toISOString()).toBe("2026-11-10T11:30:00.000Z");
  });

  it("jam tidak terbaca → default 12:00 WIB", () => {
    expect(eventStartAt(D("2026-11-10"), "jam menyusul").toISOString()).toBe("2026-11-10T05:00:00.000Z");
    expect(eventStartAt(D("2026-11-10"), null).toISOString()).toBe("2026-11-10T05:00:00.000Z");
  });
});

describe("canConfirmReceipt", () => {
  const today = D("2026-11-10");

  it("sedang diantar → boleh kapan saja", () => {
    expect(canConfirmReceipt("DELIVERED", D("2026-11-12"), today)).toBe(true);
  });

  it("lunas/dimasak → boleh mulai hari acara (vendor lupa klik berangkat)", () => {
    expect(canConfirmReceipt("PREPARING", D("2026-11-10"), today)).toBe(true);
    expect(canConfirmReceipt("PAID", D("2026-11-11"), today)).toBe(false);
  });

  it("belum bayar / batal / selesai → tidak boleh", () => {
    for (const s of ["PAYMENT_PENDING", "CANCELLED", "COMPLETED", "REFUND_PENDING"]) {
      expect(canConfirmReceipt(s, D("2026-11-09"), today)).toBe(false);
    }
  });
});

describe("transisi berangkat antar", () => {
  it("dari Lunas atau Dimasak langsung ke Sedang diantar (Siap kirim dilewati)", () => {
    expect(canTransitionBooking("PAID", "DELIVERED")).toBe(true);
    expect(canTransitionBooking("PREPARING", "DELIVERED")).toBe(true);
    expect(canTransitionBooking("READY", "DELIVERED")).toBe(true);
    expect(canVendorSetBookingStatus("DELIVERED")).toBe(true);
  });

  it("belum lunas tidak bisa diantar", () => {
    expect(canTransitionBooking("PAYMENT_PENDING", "DELIVERED")).toBe(false);
  });
});
