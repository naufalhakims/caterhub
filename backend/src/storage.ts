import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

/**
 * Penyimpanan file lokal (demo).
 * - Dokumen verifikasi PRIVAT: di luar public, hanya lewat route ber-otorisasi.
 * - Gambar publik: disajikan API di /uploads (frontend mem-proxy lewat rewrite).
 * Untuk produksi gunakan object storage (S3/R2) dan ganti implementasi ini.
 */
export const PRIVATE_VERIFICATION_DIR = path.join(env.privateUploadDir, "verification");
export const PUBLIC_UPLOAD_DIR = env.publicUploadDir;
export const PUBLIC_UPLOAD_URL = "/uploads";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type Signature = { mime: string; ext: string; matches: (b: Buffer) => boolean };

const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", ext: "jpg", matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    ext: "png",
    matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: "image/webp",
    ext: "webp",
    matches: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP",
  },
  { mime: "application/pdf", ext: "pdf", matches: (b) => b.subarray(0, 5).toString() === "%PDF-" },
];

export type ValidatedUpload = {
  buffer: Buffer;
  mimeType: string;
  ext: string;
  originalName: string;
  sizeBytes: number;
};

function sanitizeName(name: string): string {
  return path.basename(name).replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file";
}

/** Validasi ukuran + isi (magic bytes), bukan hanya MIME dari klien. */
export function validateUpload(
  buffer: Buffer,
  originalName: string,
  opts: { imagesOnly?: boolean } = {},
): ValidatedUpload {
  if (!buffer || buffer.length === 0) throw new Error("File wajib dipilih.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error("Ukuran file maksimal 5 MB.");
  const signature = SIGNATURES.find(
    (s) => s.matches(buffer) && (!opts.imagesOnly || s.mime.startsWith("image/")),
  );
  if (!signature) {
    throw new Error(
      opts.imagesOnly ? "Format gambar harus JPG, PNG, atau WEBP." : "Format file harus JPG, PNG, WEBP, atau PDF.",
    );
  }
  return {
    buffer,
    mimeType: signature.mime,
    ext: signature.ext,
    originalName: sanitizeName(originalName || "file"),
    sizeBytes: buffer.byteLength,
  };
}

function randomKey(ext: string): string {
  return `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;
}

export async function savePrivateDocument(vendorId: string, upload: ValidatedUpload): Promise<string> {
  const dir = path.join(PRIVATE_VERIFICATION_DIR, vendorId);
  await mkdir(dir, { recursive: true });
  const key = path.posix.join(vendorId, randomKey(upload.ext));
  await writeFile(path.join(PRIVATE_VERIFICATION_DIR, key), upload.buffer);
  return key;
}

export async function readPrivateDocument(storageKey: string): Promise<Buffer> {
  const root = path.resolve(PRIVATE_VERIFICATION_DIR);
  const resolved = path.resolve(PRIVATE_VERIFICATION_DIR, storageKey);
  if (!resolved.startsWith(root + path.sep)) throw new Error("Path dokumen tidak valid.");
  return readFile(resolved);
}

export async function deletePrivateDocument(storageKey: string): Promise<void> {
  try {
    const root = path.resolve(PRIVATE_VERIFICATION_DIR);
    const resolved = path.resolve(PRIVATE_VERIFICATION_DIR, storageKey);
    if (!resolved.startsWith(root + path.sep)) return;
    await unlink(resolved);
  } catch {
    // File mungkin sudah hilang.
  }
}

export async function savePublicImage(folder: string, upload: ValidatedUpload): Promise<string> {
  // Folder boleh bertingkat ("vendors/<id>") tetapi setiap segmen dibersihkan
  // agar tidak bisa keluar dari direktori unggahan.
  const safeFolder =
    folder
      .split(/[\\/]+/)
      .map((segment) => segment.replace(/[^a-z0-9_-]/gi, "").slice(0, 64))
      .filter(Boolean)
      .slice(0, 3)
      .join("/") || "misc";
  const dir = path.join(PUBLIC_UPLOAD_DIR, ...safeFolder.split("/"));
  await mkdir(dir, { recursive: true });
  const name = randomKey(upload.ext);
  await writeFile(path.join(dir, name), upload.buffer);
  return `${PUBLIC_UPLOAD_URL}/${safeFolder}/${name}`;
}

export async function deletePublicImage(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith(`${PUBLIC_UPLOAD_URL}/`)) return;
  try {
    const relative = url.slice(PUBLIC_UPLOAD_URL.length + 1);
    const root = path.resolve(PUBLIC_UPLOAD_DIR);
    const resolved = path.resolve(PUBLIC_UPLOAD_DIR, relative);
    if (!resolved.startsWith(root + path.sep)) return;
    await unlink(resolved);
  } catch {
    // abaikan
  }
}
