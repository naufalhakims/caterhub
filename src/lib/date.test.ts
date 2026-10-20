import { describe, expect, it } from "vitest";
import { parseDateOnly, toDateOnly, todayDateOnly, jakartaDateString } from "@/lib/date";

describe("parseDateOnly", () => {
  it("menghasilkan UTC tengah malam untuk tanggal yang dipilih", () => {
    const d = parseDateOnly("2026-10-15");
    expect(d.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(9);
    expect(d.getUTCDate()).toBe(15);
  });

  it("menolak tanggal tidak valid", () => {
    expect(() => parseDateOnly("2026-02-31")).toThrow();
    expect(() => parseDateOnly("15/10/2026")).toThrow();
    expect(() => parseDateOnly("")).toThrow();
  });

  it("tidak bergeser satu hari di zona waktu mana pun (server lokal UTC+7)", () => {
    // Inti bug kapasitas: nilai yang disimpan harus komponen UTC, bukan tengah malam lokal.
    const d = parseDateOnly("2026-10-15");
    expect(toDateOnly(d).toISOString().slice(0, 10)).toBe("2026-10-15");
  });
});

describe("toDateOnly", () => {
  it("string YYYY-MM-DD dianggap tanggal literal", () => {
    expect(toDateOnly("2026-01-01").toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("timestamp memakai komponen UTC-nya", () => {
    expect(toDateOnly("2026-10-15T13:45:00.000Z").toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });

  it("idempoten", () => {
    const a = toDateOnly("2026-12-31");
    expect(toDateOnly(a).getTime()).toBe(a.getTime());
  });
});

describe("hari ini menurut Asia/Jakarta", () => {
  it("format tanggal Jakarta mengikuti tanggal lokal, bukan UTC", () => {
    // 31 Des 2026 18:30 UTC = 1 Jan 2027 01:30 WIB → tahun baru di Jakarta.
    expect(jakartaDateString(new Date("2026-12-31T18:30:00.000Z"))).toBe("2027-01-01");
  });

  it("todayDateOnly mengembalikan UTC tengah malam dari tanggal Jakarta", () => {
    const d = todayDateOnly(new Date("2026-12-31T18:30:00.000Z"));
    expect(d.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
