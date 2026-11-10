import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FonnteWhatsAppProvider,
  MockWhatsAppProvider,
  getWhatsAppProvider,
  isRealSendAllowed,
} from "../src/domain/whatsapp";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubFetch(status: number, json: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => json }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("pemilihan provider WhatsApp", () => {
  it("default mock; fonnte hanya bila WHATSAPP_PROVIDER=fonnte", () => {
    vi.stubEnv("WHATSAPP_PROVIDER", "");
    expect(getWhatsAppProvider()).toBeInstanceOf(MockWhatsAppProvider);
    vi.stubEnv("WHATSAPP_PROVIDER", "fonnte");
    expect(getWhatsAppProvider()).toBeInstanceOf(FonnteWhatsAppProvider);
  });
});

describe("pengaman nomor demo", () => {
  it("kosong = tidak ada nomor yang boleh dikirimi WA sungguhan", () => {
    vi.stubEnv("WHATSAPP_ALLOWED_NUMBERS", "");
    vi.stubEnv("DEMO_VENDOR_WHATSAPP", "");
    expect(isRealSendAllowed("6281234567890")).toBe(false);
  });

  it("mencocokkan setelah normalisasi, banyak nomor dipisah koma", () => {
    vi.stubEnv("WHATSAPP_ALLOWED_NUMBERS", "0812-3456-7890, +62 857 1111 2222");
    expect(isRealSendAllowed("6281234567890")).toBe(true);
    expect(isRealSendAllowed("6285711112222")).toBe(true);
    expect(isRealSendAllowed("6281111111111")).toBe(false);
  });

  it("fallback ke DEMO_VENDOR_WHATSAPP; `*` mengizinkan semua", () => {
    vi.stubEnv("WHATSAPP_ALLOWED_NUMBERS", "");
    vi.stubEnv("DEMO_VENDOR_WHATSAPP", "081234567890");
    expect(isRealSendAllowed("6281234567890")).toBe(true);
    vi.stubEnv("WHATSAPP_ALLOWED_NUMBERS", "*");
    expect(isRealSendAllowed("6289999999999")).toBe(true);
  });
});

describe("FonnteWhatsAppProvider", () => {
  it("mengirim target, pesan, kode negara dengan header Authorization token", async () => {
    vi.stubEnv("FONNTE_TOKEN", "tok-123");
    const fetchMock = stubFetch(200, { status: true, id: [80367170], detail: "success! message in queue" });
    const result = await new FonnteWhatsAppProvider().send("6281234567890", "*Halo*\nPesan");
    expect(result).toEqual({ ok: true, providerMessageId: "80367170" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.fonnte.com/send");
    expect((init.headers as Record<string, string>).Authorization).toBe("tok-123");
    const form = init.body as URLSearchParams;
    expect(form.get("target")).toBe("6281234567890");
    expect(form.get("message")).toBe("*Halo*\nPesan");
    expect(form.get("countryCode")).toBe("62");
  });

  it("meneruskan alasan gagal dari Fonnte (mis. device terputus)", async () => {
    vi.stubEnv("FONNTE_TOKEN", "tok");
    stubFetch(200, { status: false, reason: "device disconnected" });
    await expect(new FonnteWhatsAppProvider().send("62812", "x")).resolves.toEqual({
      ok: false,
      error: "Fonnte: device disconnected",
    });
  });

  it("gagal tanpa memanggil jaringan bila token kosong", async () => {
    vi.stubEnv("FONNTE_TOKEN", "");
    const fetchMock = stubFetch(200, {});
    await expect(new FonnteWhatsAppProvider().send("62812", "x")).resolves.toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("jaringan error → hasil gagal, bukan exception", async () => {
    vi.stubEnv("FONNTE_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    await expect(new FonnteWhatsAppProvider().send("62812", "x")).resolves.toEqual({
      ok: false,
      error: "Fonnte tidak dapat dihubungi: ECONNRESET",
    });
  });
});
