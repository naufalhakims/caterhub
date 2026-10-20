import { createHash } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MidtransPaymentProvider, MockPaymentProvider } from "@/server/payment";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("keamanan webhook mock", () => {
  it("menolak webhook tanpa opt-in (siapa pun bisa melunasi payment)", async () => {
    vi.stubEnv("ALLOW_MOCK_WEBHOOK", "");
    await expect(
      new MockPaymentProvider().handleWebhook({ providerReference: "MOCK-1", status: "settlement" }),
    ).rejects.toThrow(/dinonaktifkan/);
  });

  it("hanya memproses bila ALLOW_MOCK_WEBHOOK=true", async () => {
    vi.stubEnv("ALLOW_MOCK_WEBHOOK", "true");
    await expect(
      new MockPaymentProvider().handleWebhook({ providerReference: "MOCK-1", status: "settlement" }),
    ).resolves.toEqual({ providerReference: "MOCK-1", status: "settlement" });
  });
});

describe("verifikasi signature webhook Midtrans", () => {
  const secret = "server-key-test";
  const body = {
    order_id: "CH-123",
    status_code: "200",
    gross_amount: "8900000.00",
    transaction_status: "settlement",
  };
  const sign = (payload: typeof body) =>
    createHash("sha512")
      .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${secret}`)
      .digest("hex");

  it("menolak payload tanpa signature", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", secret);
    await expect(new MidtransPaymentProvider().handleWebhook(body)).rejects.toThrow(/Signature/);
  });

  it("menolak signature yang salah", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", secret);
    await expect(
      new MidtransPaymentProvider().handleWebhook({ ...body, signature_key: "deadbeef" }),
    ).rejects.toThrow(/Signature/);
  });

  it("menerima signature valid dan memetakan status", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", secret);
    await expect(
      new MidtransPaymentProvider().handleWebhook({ ...body, signature_key: sign(body) }),
    ).resolves.toEqual({ providerReference: "CH-123", status: "settlement" });
  });

  it("menolak bila server key belum dikonfigurasi", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", "");
    await expect(
      new MidtransPaymentProvider().handleWebhook({ ...body, signature_key: "x" }),
    ).rejects.toThrow(/MIDTRANS_SERVER_KEY/);
  });
});
