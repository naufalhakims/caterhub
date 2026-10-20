import { afterEach, describe, expect, it, vi } from "vitest";
import { searchVendors } from "@/server/marketplace";
import type { VendorSearchResult } from "@/lib/vendor-api";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { vendorProfile: { findMany } },
}));

const remoteCard: VendorSearchResult = {
  id: "remote",
  businessName: "Vendor dari API",
  city: "Surabaya",
  rating: 4.9,
  reviewCount: 3,
  startingPrice: 25000,
  remaining: 300,
  hasCapacity: true,
  score: 99,
  reasons: ["Sesuai budget"],
};

function dbRow() {
  return {
    id: "db-1",
    businessName: "Vendor Prisma",
    description: null,
    city: "Surabaya",
    logoUrl: null,
    coverUrl: null,
    rating: 4.2,
    reviewCount: 5,
    minPax: 50,
    maxPax: 500,
    packages: [{ pricePerPax: 30000 }],
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  findMany.mockReset();
});

describe("searchVendors (POC pemisahan)", () => {
  it("memakai API bila API_BASE_URL diisi", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:4000");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [remoteCard] }), { status: 200 })),
    );
    const result = await searchVendors({});
    expect(result.map((v) => v.id)).toEqual(["remote"]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("memakai Prisma bila API_BASE_URL tidak diisi", async () => {
    vi.stubEnv("API_BASE_URL", "");
    findMany.mockResolvedValue([dbRow()]);
    const result = await searchVendors({ city: "Surabaya" });
    expect(result[0].id).toBe("db-1");
    expect(result[0].score).toBeGreaterThan(0);
    expect(findMany).toHaveBeenCalledOnce();
  });

  it("fallback ke Prisma saat API gagal", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:4000");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    findMany.mockResolvedValue([dbRow()]);
    const result = await searchVendors({});
    expect(result[0].id).toBe("db-1");
    expect(findMany).toHaveBeenCalledOnce();
  });
});
