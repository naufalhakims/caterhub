import Link from "next/link";
import { Fragment } from "react";
import { Empty } from "@/components/ui/Card";
import { AutoRefresh } from "@/components/AutoRefresh";
import { apiGet } from "@/lib/api";
import { formatDateTimeID } from "@/lib/format";

type Message = {
  id: string;
  toPhone: string | null;
  body: string;
  event: string;
  status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  createdAt: string;
  sentAt: string | null;
  user: { id: string; name: string | null; role: string } | null;
};
type Outbox = { provider: string; messages: Message[]; counts: Record<string, number> };

const STATUS = {
  SENT: { label: "Terkirim", tone: "bg-emerald-50 text-emerald-700" },
  QUEUED: { label: "Antre", tone: "bg-amber-50 text-amber-700" },
  SKIPPED: { label: "Dilewati", tone: "bg-stone-100 text-stone-600" },
  FAILED: { label: "Gagal", tone: "bg-red-50 text-red-700" },
} as const;
const ROLE = { CUSTOMER: "Pelanggan", VENDOR: "Vendor", ADMIN: "Admin" } as Record<string, string>;

/** Render teks WhatsApp: *tebal* dan tautan yang bisa diklik. */
function WaText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*[^*]+\*|https?:\/\/\S+)/g).map((part, j) =>
            part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
              <strong key={j}>{part.slice(1, -1)}</strong>
            ) : /^https?:\/\//.test(part) ? (
              <a key={j} href={part} className="break-all text-sky-700 underline" target="_blank" rel="noreferrer">
                {part}
              </a>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

function prettyPhone(p: string | null) {
  if (!p) return "Tanpa nomor";
  return `+${p.slice(0, 2)} ${p.slice(2, 5)}-${p.slice(5, 9)}-${p.slice(9)}`;
}

export default async function WhatsAppOutboxPage({ searchParams }: { searchParams?: { to?: string } }) {
  const data = await apiGet<Outbox>("/api/v1/admin/whatsapp");

  // Kelompokkan per penerima (nomor; pesan tanpa nomor per pengguna).
  const threads = new Map<string, { key: string; name: string; role: string; phone: string | null; messages: Message[] }>();
  for (const m of data.messages) {
    const key = m.toPhone ?? `user:${m.user?.id ?? "?"}`;
    const t = threads.get(key) ?? { key, name: m.user?.name ?? "Pengguna", role: m.user?.role ?? "", phone: m.toPhone, messages: [] };
    t.messages.push(m);
    threads.set(key, t);
  }
  const list = [...threads.values()];
  const active = list.find((t) => t.key === searchParams?.to) ?? list[0];
  const conversation = active ? [...active.messages].reverse() : [];

  return (
    <div>
      <AutoRefresh intervalMs={5000} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">
            Kotak keluar <em>WhatsApp</em>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            Pesan WhatsApp yang dikirim sistem untuk event penting. Saat ini memakai{" "}
            <span className="font-semibold text-ink">provider {data.provider}</span>
            {data.provider === "mock"
              ? " — pesan tidak benar-benar terkirim ke ponsel, tetapi alur, nomor tujuan, dan isinya sama persis dengan pengiriman asli."
              : " — pesan terkirim sungguhan hanya ke nomor demo yang diizinkan; nomor lain tercatat sebagai Dilewati."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => (
            <span key={s} className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[s].tone}`}>
              {STATUS[s].label} {data.counts[s] ?? 0}
            </span>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-6">
          <Empty title="Belum ada pesan WhatsApp." hint="Pesan muncul saat ada permintaan pesanan, konfirmasi, pembayaran, atau pembatalan." />
        </div>
      ) : (
        <div className="mt-6 grid overflow-hidden rounded-3xl border border-stone-200 lg:grid-cols-[300px_1fr]">
          <nav aria-label="Penerima" className="max-h-[38rem] overflow-y-auto border-b border-stone-200 bg-white lg:border-b-0 lg:border-r">
            {list.map((t) => {
              const last = t.messages[0];
              const selected = t.key === active?.key;
              return (
                <Link
                  key={t.key}
                  href={`/admin/whatsapp?to=${encodeURIComponent(t.key)}`}
                  aria-current={selected ? "true" : undefined}
                  className={`flex gap-3 border-b border-stone-100 px-4 py-3 transition-colors ${selected ? "bg-[#F0F2F5]" : "hover:bg-stone-50"}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25D366] font-semibold text-white">
                    {t.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{t.name}</span>
                      <span className="shrink-0 text-[11px] text-stone-400">{formatDateTimeID(last.createdAt).split(",").pop()}</span>
                    </span>
                    <span className="block truncate text-xs text-stone-500">
                      {ROLE[t.role] ?? t.role} · {prettyPhone(t.phone)}
                    </span>
                    <span className="block truncate text-xs text-stone-600">{last.body.split("\n")[0].replace(/\*/g, "")}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <section aria-label="Percakapan" className="flex min-h-[28rem] flex-col bg-[#EFEAE2]">
            {active && (
              <header className="flex items-center gap-3 bg-[#F0F2F5] px-4 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#25D366] font-semibold text-white">
                  {active.name.charAt(0).toUpperCase()}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{active.name}</span>
                  <span className="block text-xs text-stone-500">
                    {ROLE[active.role] ?? active.role} · {prettyPhone(active.phone)}
                  </span>
                </span>
              </header>
            )}
            <div className="flex-1 space-y-2 overflow-y-auto p-4 sm:px-8">
              {conversation.map((m) => (
                <div key={m.id} className="flex justify-end">
                  <div
                    className={`max-w-[85%] rounded-xl rounded-tr-sm px-3 py-2 text-[14px] leading-snug text-[#111B21] shadow-sm sm:max-w-[70%] ${
                      m.status === "SKIPPED" || m.status === "FAILED" ? "bg-white/70 opacity-80" : "bg-[#D9FDD3]"
                    }`}
                  >
                    <WaText text={m.body} />
                    <p className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-stone-500">
                      <span className="rounded bg-black/5 px-1.5 py-px">{m.event}</span>
                      {formatDateTimeID(m.sentAt ?? m.createdAt).split(",").pop()}
                      {m.status === "SENT" && <span className="text-sky-600" aria-label="terkirim">✓✓</span>}
                      {m.status === "QUEUED" && <span aria-label="antre">🕓</span>}
                    </p>
                    {(m.status === "SKIPPED" || m.status === "FAILED") && (
                      <p className={`mt-1 rounded-lg px-2 py-1 text-[11px] font-medium ${STATUS[m.status].tone}`}>
                        {STATUS[m.status].label}: {m.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
