import { cookies } from "next/headers";

/**
 * Klien REST untuk server components & server actions.
 * - Meneruskan cookie sesi ke API.
 * - Tidak pernah menyentuh database.
 * - Melempar ApiError agar pemanggil bisa menampilkan pesan yang tepat.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiBaseUrl(): string {
  return (process.env.API_BASE_URL?.trim() || "http://127.0.0.1:4000").replace(/\/+$/, "");
}

function cookieHeader(): string {
  try {
    return cookies().toString();
  } catch {
    return "";
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as
    | { data?: T; error?: { code?: string; message?: string; fields?: Record<string, string[]> } }
    | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? "API_ERROR",
      body?.error?.message ?? `Permintaan gagal (HTTP ${res.status}).`,
      body?.error?.fields,
    );
  }
  return (body?.data ?? (body as T)) as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("content-type", "application/json");
  headers.set("accept", "application/json");
  const cookie = cookieHeader();
  if (cookie) headers.set("cookie", cookie);

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  return parseResponse<T>(res);
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "DELETE",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Kirim FormData (unggahan file) — jangan set content-type manual. */
export function apiForm<T>(path: string, form: FormData, method: "POST" | "PATCH" = "POST"): Promise<T> {
  return request<T>(path, { method, body: form });
}
