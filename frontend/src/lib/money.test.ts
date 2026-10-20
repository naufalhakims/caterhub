import { describe, expect, it } from "vitest";
import { formatIDRInput, parseIDR, zIdr, zIdrOptional } from "@/lib/money";
import { formatIDR } from "@/lib/format";

describe("parseIDR", () => {
  it("menerima angka murni", () => {
    expect(parseIDR(35000)).toBe(35000);
  });

  it("menerima string berformat Indonesia", () => {
    expect(parseIDR("Rp10.000")).toBe(10000);
    expect(parseIDR("10.000")).toBe(10000);
    expect(parseIDR(" 1.250.000 ")).toBe(1250000);
    expect(parseIDR("Rp 35.000/pax")).toBe(35000);
  });

  it("menolak input kosong / bukan angka", () => {
    expect(parseIDR("")).toBeNull();
    expect(parseIDR("abc")).toBeNull();
    expect(parseIDR(null)).toBeNull();
    expect(parseIDR(Number.NaN)).toBeNull();
  });

  it("tidak salah menafsirkan pemisah desimal sebagai ribuan", () => {
    // Input tidak pernah mengandung desimal untuk IDR; semua digit digabung.
    expect(parseIDR("10.000")).toBe(10000);
    expect(parseIDR("10000.50")).toBe(1000050);
  });
});

describe("formatIDRInput", () => {
  it("memberi pemisah ribuan tanpa prefix", () => {
    expect(formatIDRInput(10000)).toBe("10.000");
    expect(formatIDRInput("1250000")).toBe("1.250.000");
    expect(formatIDRInput("")).toBe("");
  });
});

describe("formatIDR", () => {
  it("menampilkan Rp tanpa spasi", () => {
    expect(formatIDR(10000)).toBe("Rp10.000");
    expect(formatIDR(0)).toBe("Rp0");
  });
});

describe("zIdr", () => {
  it("mengubah format tampilan menjadi integer", () => {
    expect(zIdr.parse("Rp10.000")).toBe(10000);
    expect(zIdr.parse("10000")).toBe(10000);
    expect(zIdr.parse(2500)).toBe(2500);
  });

  it("menolak negatif dan kosong", () => {
    expect(zIdr.safeParse("-5").success).toBe(false);
    expect(zIdr.safeParse("").success).toBe(false);
  });

  it("opsional tetap boleh kosong", () => {
    expect(zIdrOptional.safeParse(undefined).success).toBe(true);
    expect(zIdrOptional.safeParse("").success).toBe(true);
    expect(zIdrOptional.safeParse(null).success).toBe(true);
    expect(zIdrOptional.parse("Rp7.000")).toBe(7000);
  });
});
