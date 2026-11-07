import { Navbar } from "@/components/Navbar";
import { Empty } from "@/components/ui/Card";
import { Flash } from "@/components/ui/Flash";
import { FormButton } from "@/components/ui/FormButton";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth-helpers";
import { formatDateTimeID } from "@/lib/format";
import { markAllNotificationsReadAction, openNotificationAction } from "@/server/notification-actions";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_MARK: Record<string, string> = {
  ORDER_REQUEST: "✎",
  BOOKING: "▣",
  QUOTATION: "✉",
  MESSAGE: "💬",
  REVIEW: "★",
  VERIFICATION: "✓",
  REFUND: "↺",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  await requireUser();
  const { items, unread } = await apiGet<{ items: NotificationItem[]; unread: number }>(
    "/api/v1/me/notifications?limit=50",
  );

  return (
    <>
      <Navbar />
      <Flash ok={searchParams?.ok} error={searchParams?.error} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl text-ink sm:text-5xl">Notifikasi</h1>
            <p className="mt-1 text-sm text-stone-500">
              {unread > 0 ? `${unread} belum dibaca` : "Semua sudah dibaca"}
            </p>
          </div>
          {unread > 0 && (
            <form action={markAllNotificationsReadAction}>
              <FormButton variant="ghost" pendingLabel="Menandai…">
                Tandai semua dibaca
              </FormButton>
            </form>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-6">
            <Empty
              title="Belum ada notifikasi."
              hint="Pesanan baru, konfirmasi, pesan, dan pembayaran akan muncul di sini."
            />
          </div>
        ) : (
          <ul className="mt-6 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft">
            {items.map((n) => {
              const unreadItem = !n.readAt;
              return (
                <li key={n.id} className="border-b border-stone-100 last:border-b-0">
                  <form action={openNotificationAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="link" value={n.link ?? ""} />
                    <button
                      type="submit"
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-200 ease-fluid hover:bg-stone-50 active:bg-stone-100 ${
                        unreadItem ? "bg-brand-50/40" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-stone-100 text-sm text-stone-600"
                      >
                        {TYPE_MARK[n.type] ?? "•"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`text-sm ${unreadItem ? "font-bold text-stone-900" : "font-semibold text-stone-700"}`}>
                            {n.title}
                          </span>
                          {unreadItem && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="belum dibaca" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-stone-600">{n.message}</span>
                        <span className="mt-1 block text-xs text-stone-400">{formatDateTimeID(n.createdAt)}</span>
                      </span>
                      {n.link && (
                        <span aria-hidden className="mt-2 text-stone-300">
                          ›
                        </span>
                      )}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
