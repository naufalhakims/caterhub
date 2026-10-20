import { describe, expect, it } from "vitest";
import { decideRouteAccess } from "@/lib/route-access";

describe("matriks akses rute", () => {
  it("tamu: marketplace publik boleh, area privat minta login", () => {
    expect(decideRouteAccess("/", undefined)).toBe("allow");
    expect(decideRouteAccess("/catering", undefined)).toBe("allow");
    expect(decideRouteAccess("/catering/v1", undefined)).toBe("allow");
    expect(decideRouteAccess("/dashboard", undefined)).toBe("require-login");
    expect(decideRouteAccess("/vendor/dashboard", undefined)).toBe("require-login");
    expect(decideRouteAccess("/admin/dashboard", undefined)).toBe("require-login");
    expect(decideRouteAccess("/quotations/q1", undefined)).toBe("require-login");
  });

  it("vendor: hanya area vendor; marketplace & admin dialihkan", () => {
    expect(decideRouteAccess("/vendor/dashboard", "VENDOR")).toBe("allow");
    expect(decideRouteAccess("/vendor/verification", "VENDOR")).toBe("allow");
    expect(decideRouteAccess("/admin/vendors", "VENDOR")).toBe("redirect-home");
    expect(decideRouteAccess("/catering", "VENDOR")).toBe("redirect-home");
    expect(decideRouteAccess("/dashboard", "VENDOR")).toBe("redirect-home");
    // Detail bersama boleh, otorisasi per-resource di halaman.
    expect(decideRouteAccess("/quotations/q1", "VENDOR")).toBe("allow");
  });

  it("admin: tidak pernah masuk /vendor (bug navigasi lama)", () => {
    expect(decideRouteAccess("/admin/orders", "ADMIN")).toBe("allow");
    expect(decideRouteAccess("/admin/vendors/v1", "ADMIN")).toBe("allow");
    expect(decideRouteAccess("/vendor/orders", "ADMIN")).toBe("redirect-home");
    expect(decideRouteAccess("/vendor", "ADMIN")).toBe("redirect-home");
    expect(decideRouteAccess("/catering", "ADMIN")).toBe("redirect-home");
    expect(decideRouteAccess("/quotations/q1", "ADMIN")).toBe("allow");
  });

  it("pelanggan: dashboard/events/profile & marketplace boleh, vendor/admin tidak", () => {
    expect(decideRouteAccess("/dashboard", "CUSTOMER")).toBe("allow");
    expect(decideRouteAccess("/events/new", "CUSTOMER")).toBe("allow");
    expect(decideRouteAccess("/profile", "CUSTOMER")).toBe("allow");
    expect(decideRouteAccess("/catering", "CUSTOMER")).toBe("allow");
    expect(decideRouteAccess("/vendor/menu", "CUSTOMER")).toBe("redirect-home");
    expect(decideRouteAccess("/admin/users", "CUSTOMER")).toBe("redirect-home");
  });

  it("tidak tertipu prefix mirip", () => {
    expect(decideRouteAccess("/vendors", "CUSTOMER")).toBe("allow");
    expect(decideRouteAccess("/dashboardx", "VENDOR")).toBe("allow");
  });
});
