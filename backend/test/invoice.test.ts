import { describe, expect, it } from "vitest";
import { formatInvoiceNumber, vendorInvoicePrefix } from "../src/domain/invoice";
import { decideCancellation } from "../src/domain/booking";

describe("nomor invoice", () => {
  it("prefiks dari inisial nama usaha", () => {
    expect(vendorInvoicePrefix("Dapur Nusantara")).toBe("DN");
    expect(vendorInvoicePrefix("Rasa Prima Catering")).toBe("RPC");
    expect(vendorInvoicePrefix("Kitchen 88")).toBe("K8");
    expect(vendorInvoicePrefix("Bu Siti & Anak — Catering Rumahan")).toBe("BSAC");
  });

  it("satu kata → tiga huruf pertama", () => {
    expect(vendorInvoicePrefix("Sajianku")).toBe("SAJ");
  });

  it("format berurutan 4 digit", () => {
    expect(formatInvoiceNumber("DN", 2026, 7)).toBe("INV/DN/2026/0007");
    expect(formatInvoiceNumber("DN", 2026, 12345)).toBe("INV/DN/2026/12345");
  });
});

describe("pembatalan pesanan offline", () => {
  it("lunas offline dibatalkan → CANCELLED tanpa refund lewat admin", () => {
    expect(
      decideCancellation({ actor: "VENDOR", status: "PAID", paidAmount: 500_000, daysUntilEvent: 5, source: "OFFLINE" }),
    ).toEqual({ ok: true, refund: false, nextStatus: "CANCELLED" });
  });

  it("online tetap REFUND_PENDING", () => {
    expect(
      decideCancellation({ actor: "VENDOR", status: "PAID", paidAmount: 500_000, daysUntilEvent: 5, source: "ONLINE" }),
    ).toMatchObject({ refund: true, nextStatus: "REFUND_PENDING" });
  });
});
