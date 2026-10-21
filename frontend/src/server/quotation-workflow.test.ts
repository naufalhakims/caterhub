import { describe, expect, it } from "vitest";
import {
  canPerformQuotationDecision,
  canTransitionQuotation,
  nextQuotationStatus,
  QUOTATION_TRANSITIONS,
} from "@/server/quotation-workflow";

describe("transisi status penawaran", () => {
  it("permintaan pelanggan dikonfirmasi atau ditolak vendor", () => {
    expect(canTransitionQuotation("REQUESTED", "ACCEPTED")).toBe(true);
    expect(canTransitionQuotation("REQUESTED", "DECLINED")).toBe(true);
  });

  it("penawaran vendor mengikuti alur kirim → terima/tolak/revisi", () => {
    expect(canTransitionQuotation("SENT", "ACCEPTED")).toBe(true);
    expect(canTransitionQuotation("SENT", "REJECTED")).toBe(true);
    expect(canTransitionQuotation("REVISION_REQUESTED", "SENT")).toBe(true);
    expect(canTransitionQuotation("REVISION_REQUESTED", "ACCEPTED")).toBe(true);
  });

  it("status terminal tidak bisa berpindah lagi", () => {
    for (const terminal of ["ACCEPTED", "REJECTED", "DECLINED", "EXPIRED"] as const) {
      expect(QUOTATION_TRANSITIONS[terminal]).toEqual([]);
    }
  });
});

describe("keputusan per peran & asal penawaran", () => {
  it("vendor hanya boleh menanggapi permintaan pelanggan yang masih REQUESTED", () => {
    const base = { decision: "send_offer" as const, actorRole: "VENDOR" as const, origin: "CUSTOMER_REQUEST" as const };
    expect(canPerformQuotationDecision({ ...base, status: "REQUESTED" })).toBe(true);
    expect(canPerformQuotationDecision({ ...base, status: "SENT" })).toBe(false);
    // Penawaran inisiatif vendor tidak punya status REQUESTED untuk dijawab.
    expect(
      canPerformQuotationDecision({ ...base, origin: "VENDOR_OFFER", status: "REQUESTED" }),
    ).toBe(false);
  });

  it("vendor mengonfirmasi permintaan pelanggan yang masih REQUESTED", () => {
    const base = {
      decision: "confirm_request" as const,
      actorRole: "VENDOR" as const,
      origin: "CUSTOMER_REQUEST" as const,
    };
    expect(canPerformQuotationDecision({ ...base, status: "REQUESTED" })).toBe(true);
    expect(canPerformQuotationDecision({ ...base, status: "ACCEPTED" })).toBe(false);
    expect(
      canPerformQuotationDecision({ ...base, actorRole: "CUSTOMER", status: "REQUESTED" }),
    ).toBe(false);
  });

  it("pelanggan tidak boleh menurunkan permintaan sendiri", () => {
    expect(
      canPerformQuotationDecision({
        decision: "decline_request",
        actorRole: "CUSTOMER",
        origin: "CUSTOMER_REQUEST",
        status: "REQUESTED",
      }),
    ).toBe(false);
  });

  it("pelanggan hanya memutuskan penawaran yang sudah dikirim", () => {
    const accept = { decision: "accept" as const, actorRole: "CUSTOMER" as const, origin: "VENDOR_OFFER" as const };
    expect(canPerformQuotationDecision({ ...accept, status: "SENT" })).toBe(true);
    expect(canPerformQuotationDecision({ ...accept, status: "REQUESTED" })).toBe(false);
    expect(canPerformQuotationDecision({ ...accept, status: "ACCEPTED" })).toBe(false);
  });

  it("vendor tidak boleh menerima penawaran milik pelanggan", () => {
    expect(
      canPerformQuotationDecision({
        decision: "accept",
        actorRole: "VENDOR",
        origin: "VENDOR_OFFER",
        status: "SENT",
      }),
    ).toBe(false);
  });
});

describe("nextQuotationStatus", () => {
  it("memetakan keputusan ke status tujuan", () => {
    expect(nextQuotationStatus("send_offer")).toBe("SENT");
    expect(nextQuotationStatus("confirm_request")).toBe("ACCEPTED");
    expect(nextQuotationStatus("decline_request")).toBe("DECLINED");
    expect(nextQuotationStatus("accept")).toBe("ACCEPTED");
    expect(nextQuotationStatus("reject")).toBe("REJECTED");
    expect(nextQuotationStatus("request_revision")).toBe("REVISION_REQUESTED");
  });
});

describe("chat tidak mengubah status", () => {
  it("tidak ada keputusan chat pada aturan transisi", () => {
    // Chat hanya menulis OfferMessage; modul workflow tidak mengenal aksi chat.
    expect(Object.keys(QUOTATION_TRANSITIONS)).not.toContain("MESSAGE");
    expect(canTransitionQuotation("SENT", "SENT")).toBe(false);
  });
});
