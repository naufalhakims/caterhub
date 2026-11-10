import { NextResponse, type NextRequest } from "next/server";

/**
 * Path internal yang aman untuk redirect: diawali "/" tunggal (bukan "//host" atau
 * "/\host" yang ditafsirkan browser sebagai domain lain).
 */
export function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

/** Gabungkan path + query string; nilai kosong dilewati. */
export function withQuery(path: string, params: Record<string, string | number | null | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * Redirect dengan header Location RELATIF.
 *
 * Jangan membangun URL redirect dari `req.url`: di balik proxy (Railway) nilainya
 * adalah alamat internal container (mis. http://localhost:8080), sehingga browser
 * pengguna diarahkan ke localhost. Location relatif selalu tetap di domain yang
 * sedang dibuka pengguna (RFC 9110 §10.2.2).
 */
export function redirectTo(path: string, status: 302 | 303 | 307 = 303): NextResponse {
  if (!isSafeInternalPath(path)) throw new Error(`Redirect hanya boleh ke path internal: ${path}`);
  return new NextResponse(null, { status, headers: { Location: path } });
}

/**
 * Redirect dari MIDDLEWARE. Berbeda dengan route handler, runtime middleware Next
 * mengurai Location sebagai URL absolut (Location relatif → "Invalid URL" 500).
 * Klon `req.nextUrl` (origin request yang sama) lalu ganti path & query; Next
 * menjadikan redirect origin-sama ini relatif di respons (terbukti di produksi:
 * `Location: /login?next=%2Fvendor`).
 */
export function middlewareRedirect(
  req: NextRequest,
  path: string,
  params: Record<string, string | undefined> = {},
): NextResponse {
  if (!isSafeInternalPath(path)) throw new Error(`Redirect hanya boleh ke path internal: ${path}`);
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}
