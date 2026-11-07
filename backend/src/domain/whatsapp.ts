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
  lines.push("", "— CaterHub");
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

export function getWhatsAppProvider(): WhatsAppProvider {
  // Hanya mock untuk saat ini; tambahkan cabang provider asli di sini.
  return new MockWhatsAppProvider();
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
