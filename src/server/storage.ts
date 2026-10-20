import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Penyimpanan file lokal (demo).
 *
 * - Dokumen verifikasi bersifat PRIVAT: disimpan di luar `public/` dan hanya bisa
 *   dibaca lewat route yang memeriksa peran/pemilik.
 * - Gambar publik (foto vendor, menu, paket) disimpan di `public/uploads/` agar bisa
 *   ditampilkan langsung.
 *
 * Catatan deployment: filesystem Vercel/edge bersifat read-only & tidak persisten.
 * Untuk produksi gunakan object storage (S3/R2) dan ganti implementasi modul ini.
 */
const ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "storage");

export const PRIVATE_VERIFICATION_DIR = path.join(ROOT, "private", "verification");
export const PUBLIC_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
export const PUBLIC_UPLOAD_URL = "/uploads";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

type Signature = {
  mime: string;
  ext: string;
  matches: (b: Buffer) => boolean;
};

const SIGNATURES: Signature[] = [
  {
    mime: "image/jpeg",
    ext: "jpg",
    matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: "image/webp",
    ext: "webp",
    matches: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP",
  },
  {
    mime: "application/pdf",
    ext: "pdf",
    matches: (b) => b.subarray(0, 5).toString() === "%PDF-",
  },
];

export type ValidatedUpload = {
  buffer: Buffer;
  mimeType: string;
  ext: string;
  originalName: string;
  sizeBytes: number;
};

function isUploadFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number"
  );
}

function sanitizeName(name: string): string {
  return path.basename(name).replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file";
}

/**
 * Validasi ukuran + isi file (magic bytes, bukan hanya MIME dari klien).
 */
export async function validateUpload(
  value: unknown,
  opts: { imagesOnly?: boolean } = {},
): Promise<ValidatedUpload> {
  if (!isUploadFile(value) || value.size === 0) throw new Error("File wajib dipilih.");
  if (value.size > MAX_UPLOAD_BYTES) throw new Error("Ukuran file maksimal 5 MB.");

  const buffer = Buffer.from(await value.arrayBuffer());
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
    originalName: sanitizeName(value.name || "file"),
    sizeBytes: buffer.byteLength,
  };
}

function randomKey(ext: string): string {
  return `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;
}

/** Simpan dokumen verifikasi privat; mengembalikan storageKey relatif. */
export async function savePrivateDocument(vendorId: string, upload: ValidatedUpload): Promise<string> {
  const dir = path.join(PRIVATE_VERIFICATION_DIR, vendorId);
  await mkdir(dir, { recursive: true });
  const key = path.posix.join(vendorId, randomKey(upload.ext));
  await writeFile(path.join(PRIVATE_VERIFICATION_DIR, key), upload.buffer);
  return key;
}

/** Baca dokumen privat berdasarkan storageKey. Menolak path traversal. */
export async function readPrivateDocument(storageKey: string): Promise<Buffer> {
  const resolved = path.resolve(PRIVATE_VERIFICATION_DIR, storageKey);
  if (!resolved.startsWith(path.resolve(PRIVATE_VERIFICATION_DIR) + path.sep)) {
    throw new Error("Path dokumen tidak valid.");
  }
  return readFile(resolved);
}

export async function deletePrivateDocument(storageKey: string): Promise<void> {
  try {
    const resolved = path.resolve(PRIVATE_VERIFICATION_DIR, storageKey);
    if (!resolved.startsWith(path.resolve(PRIVATE_VERIFICATION_DIR) + path.sep)) return;
    await unlink(resolved);
  } catch {
    // File mungkin sudah hilang — abaikan agar data DB tetap bisa dibersihkan.
  }
}

/** Simpan gambar publik (vendor/menu/paket) dan kembalikan URL publiknya. */
export async function savePublicImage(folder: string, upload: ValidatedUpload): Promise<string> {
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "misc";
  const dir = path.join(PUBLIC_UPLOAD_DIR, safeFolder);
  await mkdir(dir, { recursive: true });
  const name = randomKey(upload.ext);
  await writeFile(path.join(dir, name), upload.buffer);
  return `${PUBLIC_UPLOAD_URL}/${safeFolder}/${name}`;
}

/** Hapus gambar publik bila URL-nya milik folder uploads. */
export async function deletePublicImage(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith(`${PUBLIC_UPLOAD_URL}/`)) return;
  try {
    const relative = url.slice(PUBLIC_UPLOAD_URL.length + 1);
    const resolved = path.resolve(PUBLIC_UPLOAD_DIR, relative);
    if (!resolved.startsWith(path.resolve(PUBLIC_UPLOAD_DIR) + path.sep)) return;
    await unlink(resolved);
  } catch {
    // abaikan
  }
}
