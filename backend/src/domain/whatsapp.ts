import { randomBytes } from "node:crypto";
import { db } from "../db";

/**
 * Notifikasi WhatsApp dengan pola outbox:
 *  1. `notify(..., { whatsapp: true })` menulis baris `WhatsAppMessage` (QUEUED/SKIPPED)
 *     di transaksi yang sama dengan notifikasi aplikasi.
 *  2. `dispatchWhatsApp()` mengirim antrean lewat provider dan menandai SENT/FAILED.
 * Mengganti mock dengan provider asli (Fonnte, WhatsApp Cloud API) cukup dengan
 * menambah kelas yang mengimplementasikan `WhatsAppProvider`.
 */

// ---------------------------------------------------------------------------
// Fungsi murni
// ---------------------------------------------------------------------------

/** Normalisasi nomor Indonesia ke format 62xxxxxxxxxx; null bila tidak valid. */
export function normalizeIndonesianPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  // Nomor seluler Indonesia: diawali 8, total 9–12 digit setelah kode negara.
  if (!/^8\d{8,11}$/.test(digits)) return null;
  return `62${digits}`;
}

export type WhatsAppTarget =
  | { send: true; phone: string }
  | { send: false; phone: string | null; reason: string };

/** Pilih nomor tujuan: vendor memakai nomor usaha, lalu nomor akun; hormati opt-in. */
export function resolveWhatsAppTarget(input: {
  role: string;
  optIn: boolean;
  userPhone: string | null;
  vendorPhone?: string | null;
}): WhatsAppTarget {
  const raw = input.role === "VENDOR" ? input.vendorPhone || input.userPhone : input.userPhone;
  const phone = normalizeIndonesianPhone(raw);
  if (!input.optIn) return { send: false, phone, reason: "Penerima menonaktifkan notifikasi WhatsApp." };
  if (!raw) return { send: false, phone: null, reason: "Nomor WhatsApp belum diisi di profil." };
  if (!phone) return { send: false, phone: null, reason: "Nomor WhatsApp tidak valid." };
  return { send: true, phone };
}

/** Format pesan WhatsApp (teks polos dengan penekanan *tebal* WA). */
export function formatWhatsAppMessage(input: { title: string; message: string; link?: string | null; appUrl: string }): string {
  const lines = [`*${input.title}*`, input.message];
  if (input.link) lines.push("", `Buka: ${input.appUrl.replace(/\/+$/, "")}${input.link}`);
  lines.push("", "Salam, CaterHub");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export type SendResult = { ok: true; providerMessageId: string } | { ok: false; error: string };

export interface WhatsAppProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SendResult>;
}

/** Mock: tidak menghubungi layanan apa pun; pesan terlihat di "Kotak keluar WA" admin. */
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock";
  async send(): Promise<SendResult> {
    return { ok: true, providerMessageId: `MOCK-${randomBytes(6).toString("hex").toUpperCase()}` };
  }
}

/**
 * Fonnte (https://fonnte.com): WhatsApp lewat device yang disambungkan ke akun Fonnte.
 * Token device di `FONNTE_TOKEN`. Respons sukses `{ status: true, id: [...] }`,
 * gagal `{ status: false, reason }`.
 */
export class FonnteWhatsAppProvider implements WhatsAppProvider {
  readonly name = "fonnte";

  async send(to: string, body: string): Promise<SendResult> {
    const token = process.env.FONNTE_TOKEN?.trim();
    if (!token) return { ok: false, error: "FONNTE_TOKEN belum dikonfigurasi." };
    let res: Response;
    try {
      res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { Authorization: token },
        body: new URLSearchParams({ target: to, message: body, countryCode: "62" }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      return { ok: false, error: `Fonnte tidak dapat dihubungi: ${(error as Error).message}` };
    }
    let data: { status?: boolean; reason?: string; detail?: string; id?: Array<string | number> } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      // Biarkan kosong; ditangani di bawah.
    }
    if (!res.ok || data.status !== true) {
      return { ok: false, error: `Fonnte: ${data.reason || data.detail || `HTTP ${res.status}`}` };
    }
    const id = Array.isArray(data.id) && data.id.length ? String(data.id[0]) : `FONNTE-${Date.now()}`;
    return { ok: true, providerMessageId: id };
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  // Dibaca saat dipanggil agar saklar env bisa diuji tanpa restart modul.
  return process.env.WHATSAPP_PROVIDER === "fonnte" ? new FonnteWhatsAppProvider() : new MockWhatsAppProvider();
}

/**
 * Pengaman provider asli: data demo berisi nomor karangan yang bisa saja milik orang
 * sungguhan. Hanya nomor di `WHATSAPP_ALLOWED_NUMBERS` (fallback `DEMO_VENDOR_WHATSAPP`)
 * yang dikirimi WA sungguhan; `*` = semua nomor. Kosong = tidak ada (aman secara default).
 */
export function isRealSendAllowed(phone: string): boolean {
  const raw = process.env.WHATSAPP_ALLOWED_NUMBERS?.trim() || process.env.DEMO_VENDOR_WHATSAPP?.trim() || "";
  if (raw === "*") return true;
  const allowed = raw
    .split(",")
    .map((n) => normalizeIndonesianPhone(n))
    .filter((n): n is string => !!n);
  return allowed.includes(phone);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 3;
let dispatching: Promise<number> | null = null;

/** Kirim pesan QUEUED. Aman dipanggil berulang/bersamaan (satu proses). */
export function dispatchWhatsApp(limit = 50): Promise<number> {
  if (dispatching) return dispatching;
  dispatching = (async () => {
    const provider = getWhatsAppProvider();
    const queued = await db.whatsAppMessage.findMany({
      where: { status: "QUEUED", attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    let sent = 0;
    for (const m of queued) {
      if (provider.name !== "mock" && m.toPhone && !isRealSendAllowed(m.toPhone)) {
        await db.whatsAppMessage.updateMany({
          where: { id: m.id, status: "QUEUED" },
          data: {
            status: "SKIPPED",
            provider: provider.name,
            error: "Bukan nomor demo yang diizinkan (WHATSAPP_ALLOWED_NUMBERS); tidak dikirim.",
          },
        });
        continue;
      }
      // Klaim baris agar dispatcher lain (proses lain) tidak mengirim ganda.
      const claimed = await db.whatsAppMessage.updateMany({
        where: { id: m.id, status: "QUEUED", attempts: m.attempts },
        data: { attempts: { increment: 1 } },
      });
      if (claimed.count === 0 || !m.toPhone) continue;
      let result: SendResult;
      try {
        result = await provider.send(m.toPhone, m.body);
      } catch (error) {
        result = { ok: false, error: (error as Error).message };
      }
      if (result.ok) {
        sent++;
        await db.whatsAppMessage.update({
          where: { id: m.id },
          data: { status: "SENT", provider: provider.name, providerMessageId: result.providerMessageId, sentAt: new Date(), error: null },
        });
      } else {
        await db.whatsAppMessage.update({
          where: { id: m.id },
          data: {
            provider: provider.name,
            error: result.error,
            status: m.attempts + 1 >= MAX_ATTEMPTS ? "FAILED" : "QUEUED",
          },
        });
      }
    }
    return sent;
  })().finally(() => {
    dispatching = null;
  });
  return dispatching;
}

/** Jalankan dispatcher berkala (pesan muncul di kotak keluar dalam hitungan detik). */
export function startWhatsAppDispatcher(intervalMs = 5_000) {
  const tick = () => void dispatchWhatsApp().catch((e) => console.error("[api] dispatch WA gagal:", e));
  return setInterval(tick, intervalMs).unref();
}
