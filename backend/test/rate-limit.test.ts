import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/lib/rate-limit";

describe("createRateLimiter", () => {
  it("menolak setelah melewati batas dalam jendela, lalu pulih", () => {
    const rl = createRateLimiter({ windowMs: 60_000, max: 3 });
    const t = 1_000_000;
    expect(rl.hit("a", t).allowed).toBe(true);
    expect(rl.hit("a", t + 1).allowed).toBe(true);
    expect(rl.hit("a", t + 2).allowed).toBe(true);
    const blocked = rl.hit("a", t + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
    expect(rl.hit("a", t + 60_001).allowed).toBe(true);
  });

  it("kunci terpisah, reset menghapus riwayat", () => {
    const rl = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(rl.hit("x").allowed).toBe(true);
    expect(rl.hit("y").allowed).toBe(true);
    expect(rl.peek("x").allowed).toBe(false);
    rl.reset("x");
    expect(rl.peek("x").allowed).toBe(true);
  });
});
