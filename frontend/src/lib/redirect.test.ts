import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSafeInternalPath, redirectTo, withQuery } from "./redirect";

describe("redirectTo", () => {
  it("memakai Location relatif (tidak pernah host internal seperti localhost)", () => {
    const res = redirectTo("/quotations/abc");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/quotations/abc");
  });

  it("menolak tujuan di luar aplikasi (open redirect)", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "quotations/abc"]) {
      expect(isSafeInternalPath(bad)).toBe(false);
      expect(() => redirectTo(bad)).toThrow();
    }
  });

  it("withQuery melewati nilai kosong dan meng-encode", () => {
    expect(withQuery("/catering/v1", { error: "Kapasitas penuh & lainnya", date: "", lat: -7.2, eventId: undefined })).toBe(
      "/catering/v1?error=Kapasitas+penuh+%26+lainnya&lat=-7.2",
    );
    expect(withQuery("/login", {})).toBe("/login");
  });
});

/** Semua file .ts/.tsx di frontend/src (tanpa test). */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe("penjaga: tidak ada redirect dari host request", () => {
  const root = path.resolve(__dirname, "..");
  const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);

  it("tidak ada req.url / request.url dan NextResponse.redirect di luar lib/redirect.ts", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      if (file.endsWith(path.join("lib", "redirect.ts"))) continue;
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (isComment(line)) return;
          if (/\b(req|request)\.url\b|NextResponse\.redirect\(/.test(line)) {
            offenders.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    // Pakai redirectTo()/withQuery() dari "@/lib/redirect" (Location relatif).
    expect(offenders).toEqual([]);
  });
});
