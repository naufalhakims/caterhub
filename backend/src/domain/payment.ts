import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../env";

export type CreatePaymentInput = {
  bookingId: string;
  amount: number;
  customerEmail?: string | null;
  /** Masa berlaku tagihan di sisi provider; harus sama dengan Payment.expiresAt. */
  expiresInMinutes: number;
};
export type PaymentResult = { providerReference: string; qrPayload: string };
export type WebhookResult = {
  providerReference: string;
  status: "settlement" | "pending" | "failed" | "expired";
  /** Nominal yang dilaporkan provider (Rupiah). Bila ada, wajib sama dengan Payment.amount. */
  amount?: number;
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  handleWebhook(input: unknown): Promise<WebhookResult>;
}

function ref(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    return {
      providerReference: ref("MOCK"),
      qrPayload: `MOCK-QRIS:${input.bookingId}:${input.amount}`,
    };
  }

  async handleWebhook(input: unknown): Promise<WebhookResult> {
    // Webhook mock tidak terautentikasi: default ditolak.
    // Dibaca saat panggilan (bukan saat import) agar bisa diuji & diubah tanpa restart.
    if (process.env.ALLOW_MOCK_WEBHOOK !== "true") {
      throw new Error(
        "Webhook mock dinonaktifkan. Gunakan PAYMENT_PROVIDER=midtrans atau set ALLOW_MOCK_WEBHOOK=true untuk uji lokal.",
      );
    }
    const body = input as { providerReference?: string; status?: string };
    if (!body?.providerReference) throw new Error("Payload webhook tidak valid.");
    const s = body.status ?? "pending";
    return {
      providerReference: body.providerReference,
      status: s === "settlement" ? "settlement" : s === "failed" ? "failed" : s === "expired" ? "expired" : "pending",
    };
  }

  async simulateSettlement(providerReference: string): Promise<WebhookResult> {
    return { providerReference, status: "settlement" };
  }
}

/**
 * Nominal settlement wajib sama dengan tagihan. Signature membuktikan pesan dari
 * Midtrans, tetapi bukan bahwa nominalnya sesuai yang kita minta.
 */
export function settlementAmountMismatch(r: WebhookResult, expected: number): boolean {
  return r.status === "settlement" && r.amount !== undefined && r.amount !== expected;
}

/** Kanal Snap yang ditampilkan. Default hanya QRIS (`other_qris`); bisa diganti lewat env. */
export function midtransEnabledPayments(): string[] {
  const list = (process.env.MIDTRANS_ENABLED_PAYMENTS ?? "other_qris")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : ["other_qris"];
}

/** URL publik aplikasi (tanpa garis miring akhir), dipakai untuk webhook & redirect Snap. */
function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export class MidtransPaymentProvider implements PaymentProvider {
  readonly name = "midtrans";

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
    if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi.");
    const base =
      process.env.MIDTRANS_IS_PRODUCTION === "true"
        ? "https://app.midtrans.com/snap/v1/transactions"
        : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const orderId = ref("CH");
    const app = appUrl();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
    };
    // Midtrans hanya bisa memanggil URL publik HTTPS. Override per transaksi agar
    // tidak perlu mengatur "Payment Notification URL" di dashboard Midtrans.
    if (app.startsWith("https://")) headers["X-Override-Notification"] = `${app}/api/payments/webhook`;

    const res = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({
        // Snap hanya menerima nominal bulat Rupiah.
        transaction_details: { order_id: orderId, gross_amount: Math.round(input.amount) },
        enabled_payments: midtransEnabledPayments(),
        customer_details: { email: input.customerEmail ?? undefined },
        // Setelah bayar/menutup Snap, pelanggan kembali ke halaman pesanan.
        callbacks: { finish: `${app}/bookings/${input.bookingId}` },
        // QR lama tidak boleh tetap bisa dibayar setelah tagihan baru dibuat.
        expiry: { unit: "minutes", duration: Math.max(1, Math.floor(input.expiresInMinutes)) },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[api] Midtrans Snap ${res.status}: ${detail.slice(0, 500)}`);
      throw new Error("Gagal membuat pembayaran Midtrans.");
    }
    const data = (await res.json()) as { redirect_url?: string };
    if (!data.redirect_url) throw new Error("Respons Midtrans tidak valid.");
    return { providerReference: orderId, qrPayload: data.redirect_url };
  }

  async handleWebhook(input: unknown): Promise<WebhookResult> {
    const body = input as {
      order_id?: string;
      transaction_status?: string;
      signature_key?: string;
      status_code?: string;
      gross_amount?: string;
    };
    if (!body?.order_id || !body.transaction_status) throw new Error("Payload webhook tidak valid.");
    const secret = process.env.MIDTRANS_SERVER_KEY?.trim();
    if (!secret) throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi.");
    const expected = createHash("sha512")
      .update(`${body.order_id}${body.status_code}${body.gross_amount}${secret}`)
      .digest("hex");
    const given = body.signature_key ?? "";
    const a = Buffer.from(given, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return toWebhookResult(body.order_id, body.transaction_status, body.gross_amount);
    }

    // Signature tidak cocok. Akun Midtrans dengan beberapa server key dapat
    // menandatangani notifikasi memakai key lain; jangan percaya isi payload,
    // tanyakan status langsung ke Midtrans (dianjurkan Midtrans). Payload palsu
    // hanya memicu pengecekan yang mengembalikan status asli.
    const verified = await fetchMidtransStatus(body.order_id, secret);
    if (!verified) throw new Error("Signature webhook tidak valid.");
    return toWebhookResult(body.order_id, verified.transaction_status, verified.gross_amount);
  }
}

function toWebhookResult(orderId: string, st: string, grossAmount: string | undefined): WebhookResult {
  const amount = Number(grossAmount);
  if (!Number.isFinite(amount)) throw new Error("gross_amount webhook tidak valid.");
  return {
    providerReference: orderId,
    amount: Math.round(amount),
    status:
      st === "settlement" || st === "capture"
        ? "settlement"
        : st === "deny" || st === "cancel"
          ? "failed"
          : st === "expire"
            ? "expired"
            : "pending",
  };
}

/**
 * Status transaksi dari Midtrans (GET /v2/{order_id}/status). Butuh izin
 * "Core API: Read" pada server key. `null` bila gagal/ditolak/tidak ditemukan.
 */
async function fetchMidtransStatus(
  orderId: string,
  serverKey: string,
): Promise<{ transaction_status: string; gross_amount?: string } | null> {
  const base =
    process.env.MIDTRANS_IS_PRODUCTION === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  try {
    const res = await fetch(`${base}/v2/${encodeURIComponent(orderId)}/status`, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
      },
    });
    if (!res.ok) {
      console.warn(`[api] cek status Midtrans ${orderId} gagal: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      order_id?: string;
      status_code?: string;
      transaction_status?: string;
      gross_amount?: string;
    };
    if (data.order_id !== orderId || !data.transaction_status || data.status_code === "404") return null;
    return { transaction_status: data.transaction_status, gross_amount: data.gross_amount };
  } catch (error) {
    console.warn(`[api] cek status Midtrans ${orderId} error: ${(error as Error).message}`);
    return null;
  }
}

export function getPaymentProvider(): PaymentProvider {
  return env.paymentProvider === "midtrans" ? new MidtransPaymentProvider() : new MockPaymentProvider();
}
