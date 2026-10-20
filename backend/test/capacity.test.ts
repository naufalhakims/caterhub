import { describe, expect, it } from "vitest";
import { toDateLiteral } from "../src/domain/capacity";

describe("toDateLiteral (kapasitas harian)", () => {
  it("memakai tanggal kalender apa adanya, tanpa pergeseran zona waktu", () => {
    expect(toDateLiteral("2026-10-15")).toBe("2026-10-15");
    expect(toDateLiteral(new Date("2026-10-15T00:00:00.000Z"))).toBe("2026-10-15");
  });

  it("nilai date-only dari Prisma (UTC tengah malam) tidak bergeser", () => {
    // Bug lama: nilai tanggal di-set jam lokal (UTC+7) lalu dibaca sebagai UTC → mundur sehari.
    for (const day of [1, 15, 28, 31]) {
      const stored = new Date(Date.UTC(2026, 9, day));
      expect(toDateLiteral(stored)).toBe(`2026-10-${String(day).padStart(2, "0")}`);
    }
  });

  it("idempoten untuk input tanggal berulang", () => {
    const literal = toDateLiteral("2026-12-31");
    expect(toDateLiteral(literal)).toBe(literal);
  });
});
