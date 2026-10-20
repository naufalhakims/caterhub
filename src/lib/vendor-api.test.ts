import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchVendorSearch, vendorApiBase, type VendorSearchResult } from "@/lib/vendor-api";

const card: VendorSearchResult = {
  id: "v1",
  businessName: "Dapur Nusantara",
  city: "Surabaya",
  rating: 4.8,
  reviewCount: 10,
  startingPrice: 30000,
  remaining: 500,
  hasCapacity: true,
  score: 90,
  reasons: ["Sesuai budget"],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("klien CaterHub API", () => {
  it("nonaktif bila API_BASE_URL kosong", async () => {
    vi.stubEnv("API_BASE_URL", "");
    expect(vendorApiBase()).toBeNull();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchVendorSearch({ city: "Surabaya" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("mengirim filter sebagai query string dan mengembalikan data", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:4000/");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ data: [card] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchVendorSearch({ city: "Surabaya", guests: 250, q: undefined, budgetMax: 0 });
    expect(result).toEqual([card]);
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(url).toBe("http://127.0.0.1:4000/api/v1/vendors?city=Surabaya&guests=250&budgetMax=0");
  });

  it("mengembalikan null saat API error (agar pemanggil fallback ke Prisma)", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:4000");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    expect(await fetchVendorSearch({})).toBeNull();
  });

  it("menolak bentuk respons yang tidak valid", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:4000");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 1 }] }), { status: 200 })),
    );
    expect(await fetchVendorSearch({})).toBeNull();
  });

  it("mengembalikan null saat jaringan gagal", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:4000");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))));
    expect(await fetchVendorSearch({})).toBeNull();
  });
});
