import { describe, expect, it } from "vitest";
import { canViewBooking, canViewPayment, canViewQuotation, canManageVendor, isOfferParty } from "@/server/access";
import { roleHome } from "@/lib/roles";

const customer = { id: "cust_1", role: "CUSTOMER" as const };
const vendorUser = { id: "vend_1", role: "VENDOR" as const };
const stranger = { id: "cust_2", role: "CUSTOMER" as const };
const admin = { id: "adm_1", role: "ADMIN" as const };

describe("roleHome", () => {
  it("setiap peran punya beranda sendiri", () => {
    expect(roleHome("CUSTOMER")).toBe("/dashboard");
    expect(roleHome("VENDOR")).toBe("/vendor/dashboard");
    expect(roleHome("ADMIN")).toBe("/admin/dashboard");
  });
  it("peran tidak dikenal dianggap pelanggan", () => {
    expect(roleHome(undefined)).toBe("/dashboard");
    expect(roleHome("HACKER")).toBe("/dashboard");
  });
});

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

describe("kelola profil vendor", () => {
  it("hanya vendor pemilik", () => {
    const vendor = { userId: vendorUser.id };
    expect(canManageVendor(vendorUser, vendor)).toBe(true);
    expect(canManageVendor(customer, vendor)).toBe(false);
    expect(canManageVendor(admin, vendor)).toBe(false);
  });
});
