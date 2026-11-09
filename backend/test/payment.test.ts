import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MidtransPaymentProvider,
  MockPaymentProvider,
  midtransEnabledPayments,
  settlementAmountMismatch,
} from "../src/domain/payment";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
    ).resolves.toEqual({ providerReference: "CH-123", status: "settlement", amount: 8_900_000 });
  });

  it("menolak gross_amount yang bukan angka meski signature valid", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", secret);
    const bad = { ...body, gross_amount: "abc" };
    await expect(
      new MidtransPaymentProvider().handleWebhook({ ...bad, signature_key: sign(bad) }),
    ).rejects.toThrow(/gross_amount/);
  });

  it("menolak bila server key belum dikonfigurasi", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", "");
    await expect(
      new MidtransPaymentProvider().handleWebhook({ ...body, signature_key: "x" }),
    ).rejects.toThrow(/MIDTRANS_SERVER_KEY/);
  });
});

describe("cek nominal settlement", () => {
  it("menandai settlement dengan nominal berbeda", () => {
    expect(settlementAmountMismatch({ providerReference: "CH-1", status: "settlement", amount: 1_000 }, 8_900_000)).toBe(true);
  });
  it("lolos bila nominal sama", () => {
    expect(settlementAmountMismatch({ providerReference: "CH-1", status: "settlement", amount: 8_900_000 }, 8_900_000)).toBe(false);
  });
  it("tidak mengecek status non-settlement atau tanpa nominal (mock)", () => {
    expect(settlementAmountMismatch({ providerReference: "CH-1", status: "expired", amount: 1 }, 5)).toBe(false);
    expect(settlementAmountMismatch({ providerReference: "MOCK-1", status: "settlement" }, 5)).toBe(false);
  });
});

describe("pembuatan transaksi Snap Midtrans", () => {
  const input = { bookingId: "bk_1", amount: 1_250_000.4, customerEmail: "a@b.id", expiresInMinutes: 29.7 };
  function stubFetch(response: { ok: boolean; status?: number; json?: unknown }) {
    const fetchMock = vi.fn(async () => ({
      ok: response.ok,
      status: response.status ?? 200,
      json: async () => response.json,
      text: async () => JSON.stringify(response.json ?? {}),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const sent = (fetchMock: ReturnType<typeof stubFetch>) => {
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
  };

  it("memakai enabled_payments QRIS (bukan payment_type Core API), nominal bulat, redirect & webhook ke APP_URL", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", "SB-Mid-server-x");
    vi.stubEnv("APP_URL", "https://caterhub.example/");
    const fetchMock = stubFetch({ ok: true, json: { token: "t", redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/t" } });

    const result = await new MidtransPaymentProvider().createPayment(input);
    const { url, headers, body } = sent(fetchMock);

    expect(url).toBe("https://app.sandbox.midtrans.com/snap/v1/transactions");
    expect(body.enabled_payments).toEqual(["other_qris"]);
    expect(body).not.toHaveProperty("payment_type");
    expect(body.transaction_details.gross_amount).toBe(1_250_000);
    expect(body.transaction_details.order_id).toBe(result.providerReference);
    expect(body.callbacks.finish).toBe("https://caterhub.example/bookings/bk_1");
    expect(body.expiry).toEqual({ unit: "minutes", duration: 29 });
    expect(headers["X-Override-Notification"]).toBe("https://caterhub.example/api/payments/webhook");
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("SB-Mid-server-x:").toString("base64")}`);
    expect(result.qrPayload).toContain("snap/v4/redirection");
  });

  it("tidak mengirim override webhook bila APP_URL bukan HTTPS (lokal)", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", "k");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const fetchMock = stubFetch({ ok: true, json: { redirect_url: "https://x" } });
    await new MidtransPaymentProvider().createPayment(input);
    expect(sent(fetchMock).headers).not.toHaveProperty("X-Override-Notification");
  });

  it("kanal Snap bisa diganti lewat MIDTRANS_ENABLED_PAYMENTS", () => {
    vi.stubEnv("MIDTRANS_ENABLED_PAYMENTS", "other_qris, gopay ,");
    expect(midtransEnabledPayments()).toEqual(["other_qris", "gopay"]);
    vi.stubEnv("MIDTRANS_ENABLED_PAYMENTS", " ");
    expect(midtransEnabledPayments()).toEqual(["other_qris"]);
  });

  it("melempar error yang jelas bila Snap menolak", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", "k");
    stubFetch({ ok: false, status: 401, json: { error_messages: ["Access denied"] } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(new MidtransPaymentProvider().createPayment(input)).rejects.toThrow(/Gagal membuat pembayaran Midtrans/);
  });
});
