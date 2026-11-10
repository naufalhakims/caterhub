import { describe, expect, it } from "vitest";
import { publicUrlProblem } from "../src/env";

describe("validasi URL publik produksi", () => {
  it("menerima domain publik https (boleh beberapa, dipisah koma)", () => {
    expect(publicUrlProblem("APP_URL", "https://web-production-240c4.up.railway.app")).toBeNull();
    expect(publicUrlProblem("CORS_ORIGIN", "https://a.example, https://b.example")).toBeNull();
  });

  it("menolak kosong, http, localhost, dan host internal", () => {
    expect(publicUrlProblem("APP_URL", undefined)).toMatch(/wajib/);
    expect(publicUrlProblem("APP_URL", "")).toMatch(/wajib/);
    expect(publicUrlProblem("APP_URL", "http://caterhub.example")).toMatch(/https/);
    expect(publicUrlProblem("APP_URL", "https://localhost:3000")).toMatch(/lokal/);
    expect(publicUrlProblem("APP_URL", "https://127.0.0.1")).toMatch(/lokal/);
    expect(publicUrlProblem("CORS_ORIGIN", "https://ok.example,http://localhost:3000")).toMatch(/https/);
    expect(publicUrlProblem("APP_URL", "https://api.railway.internal")).toMatch(/internal/);
    expect(publicUrlProblem("APP_URL", "bukan url")).toMatch(/valid/);
  });
});
