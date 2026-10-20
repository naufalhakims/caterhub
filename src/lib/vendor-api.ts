/**
 * Klien tipis untuk CaterHub API (POC Express).
 *
 * Aktif hanya bila `API_BASE_URL` diisi. Bila API mati/timeout/tidak valid,
 * fungsi mengembalikan null dan pemanggil memakai jalur Prisma lama — sehingga
 * POC tidak pernah membuat halaman ikut mati. Kegagalan tetap dicatat di log.
 */

export type VendorSearchResult = {
  id: string;
  businessName: string;
  city: string;
  rating: number;
  reviewCount: number;
  startingPrice: number | null;
  remaining: number;
  hasCapacity: boolean;
  score: number;
  reasons: string[];
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
};

const TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS ?? 1500);

export function vendorApiBase(): string | null {
  const base = process.env.API_BASE_URL?.trim();
  return base ? base.replace(/\/+$/, "") : null;
}

function isVendorCard(value: unknown): value is VendorSearchResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.businessName === "string" &&
    typeof v.city === "string" &&
    typeof v.rating === "number" &&
    typeof v.reviewCount === "number" &&
    (v.startingPrice === null || typeof v.startingPrice === "number") &&
    typeof v.remaining === "number" &&
    typeof v.hasCapacity === "boolean" &&
    typeof v.score === "number" &&
    Array.isArray(v.reasons)
  );
}

export async function fetchVendorSearch(
  filters: Record<string, string | number | undefined>,
): Promise<VendorSearchResult[] | null> {
  const base = vendorApiBase();
  if (!base) return null;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }

  try {
    const res = await fetch(`${base}/api/v1/vendors?${qs.toString()}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[vendor-api] GET /vendors -> HTTP ${res.status}; memakai Prisma.`);
      return null;
    }
    const body = (await res.json()) as { data?: unknown };
    if (!Array.isArray(body.data) || !body.data.every(isVendorCard)) {
      console.warn("[vendor-api] bentuk respons tidak valid; memakai Prisma.");
      return null;
    }
    return body.data;
  } catch (error) {
    console.warn(`[vendor-api] gagal memanggil API (${(error as Error).message}); memakai Prisma.`);
    return null;
  }
}
