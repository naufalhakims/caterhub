/**
 * Pembatas laju sederhana di memori (satu proses API — sesuai deploy satu
 * instance). Jendela geser: simpan cap waktu percobaan per kunci.
 */
export type RateLimiter = {
  /** Catat satu percobaan; `allowed=false` bila sudah melewati batas. */
  hit(key: string, now?: number): { allowed: boolean; retryAfterSec: number };
  /** Cek tanpa mencatat. */
  peek(key: string, now?: number): { allowed: boolean; retryAfterSec: number };
  reset(key: string): void;
};

export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }): RateLimiter {
  const hits = new Map<string, number[]>();

  const recent = (key: string, now: number) => {
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };
  const verdict = (list: number[], now: number) => ({
    allowed: list.length < max,
    retryAfterSec: list.length < max ? 0 : Math.ceil((list[0]! + windowMs - now) / 1000),
  });

  // Bersihkan kunci kedaluwarsa sesekali agar memori tidak tumbuh.
  setInterval(() => {
    const now = Date.now();
    for (const key of hits.keys()) recent(key, now);
  }, windowMs).unref();

  return {
    hit(key, now = Date.now()) {
      const list = recent(key, now);
      const v = verdict(list, now);
      if (v.allowed) hits.set(key, [...list, now]);
      return v;
    },
    peek(key, now = Date.now()) {
      return verdict(recent(key, now), now);
    },
    reset(key) {
      hits.delete(key);
    },
  };
}
