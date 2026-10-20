import Link from "next/link";
import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { db } from "@/lib/db";

const AWAITING = new Set(["PENDING", "UNDER_REVIEW", "NEEDS_INFO"]);

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  const vendors = await db.vendorProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      // Hanya field yang ditampilkan — jangan pernah menarik passwordHash ke memori.
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { packages: true, bookings: true, documents: true } },
    },
  });
  const awaiting = vendors.filter((v) => AWAITING.has(v.verificationStatus));

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Vendor</h1>
      <p className="text-sm text-stone-500">
        {awaiting.length > 0 ? (
          <span className="font-semibold text-amber-700">{awaiting.length} vendor menunggu tinjauan</span>
        ) : (
          "Semua vendor sudah ditinjau."
        )}
      </p>
      {searchParams?.ok && <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
      {searchParams?.error && <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

      {vendors.length === 0 ? (
        <div className="mt-4"><Empty title="Belum ada vendor." hint="Vendor muncul setelah mendaftar lewat halaman register." /></div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {vendors.map((v) => (
            <Link key={v.id} href={`/admin/vendors/${v.id}`} className="block">
              <Card className="!p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 font-display text-xl font-bold text-brand-800 ring-1 ring-brand-100">
                      {v.businessName.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{v.businessName} <span className="font-normal text-stone-400">· {v.city}</span></p>
                      <p className="text-[13px] text-stone-500">
                        {v.user.email} · ★ {v.rating.toFixed(1)} · {v._count.packages} paket · {v._count.documents} dokumen · {v._count.bookings} pesanan
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={v.verificationStatus} />
                    <span className="text-xs font-semibold text-brand-700">Tinjau →</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
