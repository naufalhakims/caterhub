import { describe, expect, it } from "vitest";
import { formatWhatsAppMessage, normalizeIndonesianPhone, resolveWhatsAppTarget } from "../src/domain/whatsapp";

describe("normalizeIndonesianPhone", () => {
  it("menerima format umum dan menormalkan ke 62…", () => {
    expect(normalizeIndonesianPhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeIndonesianPhone("+62 812 3456 789")).toBe("628123456789");
    expect(normalizeIndonesianPhone("6281234567890")).toBe("6281234567890");
    expect(normalizeIndonesianPhone("(0811) 1111-111")).toBe("628111111111");
  });

  it("menolak nomor tidak valid (rumah, terlalu pendek, kosong)", () => {
    expect(normalizeIndonesianPhone("031-5551234")).toBeNull();
    expect(normalizeIndonesianPhone("0812")).toBeNull();
    expect(normalizeIndonesianPhone("")).toBeNull();
    expect(normalizeIndonesianPhone(null)).toBeNull();
  });
});

describe("resolveWhatsAppTarget", () => {
  it("vendor memakai nomor usaha lebih dulu", () => {
    expect(resolveWhatsAppTarget({ role: "VENDOR", optIn: true, userPhone: "081200000001", vendorPhone: "081299999999" })).toEqual({
      send: true,
      phone: "6281299999999",
    });
  });

  it("pelanggan memakai nomor akun; fallback vendor ke nomor akun", () => {
    expect(resolveWhatsAppTarget({ role: "CUSTOMER", optIn: true, userPhone: "081200000001" })).toMatchObject({ send: true });
    expect(resolveWhatsAppTarget({ role: "VENDOR", optIn: true, userPhone: "081200000001", vendorPhone: "" })).toMatchObject({
      send: true,
      phone: "6281200000001",
    });
  });

  it("tidak mengirim bila opt-out, nomor kosong, atau tidak valid — dengan alasan", () => {
    expect(resolveWhatsAppTarget({ role: "CUSTOMER", optIn: false, userPhone: "081200000001" })).toMatchObject({ send: false, reason: expect.stringContaining("menonaktifkan") });
    expect(resolveWhatsAppTarget({ role: "CUSTOMER", optIn: true, userPhone: null })).toMatchObject({ send: false, reason: expect.stringContaining("belum diisi") });
    expect(resolveWhatsAppTarget({ role: "CUSTOMER", optIn: true, userPhone: "12345" })).toMatchObject({ send: false, reason: expect.stringContaining("tidak valid") });
  });
});

describe("formatWhatsAppMessage", () => {
  it("judul tebal, pesan, tautan absolut, tanda tangan", () => {
    expect(formatWhatsAppMessage({ title: "Pesanan dikonfirmasi", message: "Silakan bayar.", link: "/bookings/b1", appUrl: "https://caterhub.id/" })).toBe(
      "*Pesanan dikonfirmasi*\nSilakan bayar.\n\nBuka: https://caterhub.id/bookings/b1\n\n— CaterHub",
    );
  });
});
