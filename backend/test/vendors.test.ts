import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import type { VendorCardDto, VendorDetailDto, VendorRepository } from "../src/vendors/dto";
import type { SearchFilters } from "../src/vendors/filters";

const card: VendorCardDto = {
  id: "v1",
  businessName: "Dapur Nusantara",
  city: "Surabaya",
  rating: 4.8,
  reviewCount: 12,
  startingPrice: 30000,
  remaining: 500,
  hasCapacity: true,
  score: 95,
  reasons: ["Tersedia pada tanggal acara"],
  description: null,
  logoUrl: null,
  coverUrl: null,
};

const detail: VendorDetailDto = {
  id: "v1",
  businessName: "Dapur Nusantara",
  description: "Katering rumahan",
  city: "Surabaya",
  address: "Jl. Contoh 1",
  phone: null,
  logoUrl: null,
  coverUrl: null,
  gallery: [],
  rating: 4.8,
  reviewCount: 12,
  minPax: 50,
  maxPax: 500,
  packages: [],
  menuItems: [],
  reviews: [],
};

function repoSpy(overrides: Partial<VendorRepository> = {}) {
  const search = vi.fn(async (_f: SearchFilters) => [card]);
  const getById = vi.fn(async (id: string) => (id === "v1" ? detail : null));
  const repo: VendorRepository = { search, getById, ...overrides };
  return { repo, search, getById };
}

const app = (repo: VendorRepository) => createApp({ vendors: repo, corsOrigins: ["http://localhost:3000"] });

describe("GET /health", () => {
  it("mengembalikan status ok", async () => {
    const { repo } = repoSpy();
    const res = await request(app(repo)).get("/health").expect(200);
    expect(res.body.data.status).toBe("ok");
  });
});

describe("GET /api/v1/vendors", () => {
  it("mengembalikan envelope data + meta", async () => {
    const { repo } = repoSpy();
    const res = await request(app(repo)).get("/api/v1/vendors").expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].businessName).toBe("Dapur Nusantara");
    expect(res.body.meta.count).toBe(1);
  });

  it("mem-parse filter dan membuang query kosong", async () => {
    const { repo, search } = repoSpy();
    await request(app(repo))
      .get("/api/v1/vendors?q=dapur&city=Surabaya&date=2026-10-26&time=10:00&guests=250&budgetMax=10000000&city=")
      .expect(200);
    expect(search).toHaveBeenCalledWith({
      q: "dapur",
      city: "Surabaya",
      date: "2026-10-26",
      time: "10:00",
      guests: 250,
      budgetMax: 10000000,
    });
  });

  it("menerima alias budget", async () => {
    const { repo, search } = repoSpy();
    await request(app(repo)).get("/api/v1/vendors?budget=7500000").expect(200);
    expect(search.mock.calls[0][0].budgetMax).toBe(7500000);
  });

  it("menolak tanggal yang tidak valid", async () => {
    const { repo } = repoSpy();
    const res = await request(app(repo)).get("/api/v1/vendors?date=2026-02-31").expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.date).toBeTruthy();
  });

  it("menolak jumlah tamu nol", async () => {
    const { repo } = repoSpy();
    const res = await request(app(repo)).get("/api/v1/vendors?guests=0").expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("tidak membocorkan detail internal saat repository gagal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { repo } = repoSpy({
      search: async () => {
        throw new Error("relation does not exist: secret_table");
      },
    });
    const res = await request(app(repo)).get("/api/v1/vendors").expect(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("secret_table");
  });
});

describe("GET /api/v1/vendors/:id", () => {
  it("mengembalikan detail vendor publik", async () => {
    const { repo, getById } = repoSpy();
    const res = await request(app(repo)).get("/api/v1/vendors/v1").expect(200);
    expect(res.body.data.id).toBe("v1");
    expect(getById).toHaveBeenCalledWith("v1");
    // Field internal tidak boleh ada di kontrak.
    expect(res.body.data).not.toHaveProperty("userId");
    expect(res.body.data).not.toHaveProperty("verificationNote");
  });

  it("404 untuk vendor tidak ada / belum terverifikasi", async () => {
    const { repo } = repoSpy();
    const res = await request(app(repo)).get("/api/v1/vendors/tidak-ada").expect(404);
    expect(res.body.error.code).toBe("VENDOR_NOT_FOUND");
  });
});

describe("perilaku HTTP umum", () => {
  it("404 envelope untuk rute tak dikenal", async () => {
    const { repo } = repoSpy();
    const res = await request(app(repo)).get("/api/v1/tidak-ada").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("CORS hanya mengizinkan origin terkonfigurasi", async () => {
    const { repo } = repoSpy();
    const allowed = await request(app(repo))
      .get("/api/v1/vendors")
      .set("Origin", "http://localhost:3000")
      .expect(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

    const denied = await request(app(repo))
      .get("/api/v1/vendors")
      .set("Origin", "https://jahat.example")
      .expect(200);
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
