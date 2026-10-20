import { getSessionUser } from "@/lib/session";

/**
 * Pengganti Auth.js: sesi diverifikasi dari cookie JWT yang diterbitkan API.
 * Bentuk hasil dipertahankan agar pemanggil lama (`auth()?.user`) tidak berubah.
 */
export async function auth() {
  const user = await getSessionUser();
  return user ? { user } : null;
}
