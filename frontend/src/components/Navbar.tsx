import Link from "next/link";
import { auth } from "@/auth";
import { apiGet } from "@/lib/api";
import { logoutAction } from "@/server/auth-actions";
import { roleHome } from "@/lib/roles";
import { Logo } from "@/components/Logo";
import { ArrowRight, buttonLink } from "@/components/ui/Button";

const navLink =
  "pressable rounded-full px-3.5 py-2 font-medium text-ink transition-colors duration-200 ease-fluid hover:bg-stone-100";

async function unreadCount(): Promise<number> {
  try {
    const data = await apiGet<{ unread: number }>("/api/v1/me/notifications?limit=0");
    return data.unread;
  } catch {
    // Navbar tidak boleh gagal hanya karena hitungan notifikasi.
    return 0;
  }
}

function NotificationBell({ count }: { count: number }) {
  const label = count > 0 ? `Notifikasi, ${count} belum dibaca` : "Notifikasi";
  return (
    <Link href="/notifications" aria-label={label} title={label} className={`${navLink} relative !px-2.5`}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
        />
      </svg>
      {count > 0 && (
        <span className="absolute right-1 top-1 grid min-w-[1.05rem] place-items-center rounded-full bg-tangerine px-1 text-[10px] font-bold leading-[1.05rem] text-white ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export async function Navbar() {
  const session = await auth();
  const user = session?.user as { name?: string | null; role?: string } | undefined;
  const role = user?.role;
  // Marketplace hanya untuk tamu & pelanggan; vendor/admin punya antarmuka sendiri.
  const canBrowse = !user || role === "CUSTOMER";
  const homeLabel =
    role === "VENDOR" ? "Dasbor Vendor" : role === "ADMIN" ? "Dasbor Admin" : "Dasbor";
  const unread = user ? await unreadCount() : 0;

  return (
    <header className="material sticky top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/" className="pressable rounded-lg">
          <Logo className="text-[1.9rem]" />
        </Link>
        <nav className="flex items-center gap-0.5 text-[15px] sm:gap-1">
          {canBrowse && (
            <>
              <Link href="/catering" className={`${navLink} hidden md:block`}>
                Jelajahi Catering
              </Link>
              {!user && (
                <>
                  <Link href="/#cara-kerja" className={`${navLink} hidden lg:block`}>
                    Cara Kerja
                  </Link>
                  <Link href="/register" className={`${navLink} hidden lg:block`}>
                    Untuk Vendor
                  </Link>
                </>
              )}
            </>
          )}
          {user ? (
            <>
              <Link href={roleHome(role)} className={`${navLink} font-semibold`}>
                {homeLabel}
              </Link>
              {role === "CUSTOMER" && (
                <Link href="/profile" className={`${navLink} hidden sm:block`}>
                  Profil
                </Link>
              )}
              <NotificationBell count={unread} />
              <form action={logoutAction}>
                <button className={`${navLink} !text-stone-500`}>Keluar</button>
              </form>
              {role === "CUSTOMER" && (
                <Link href="/catering" className={buttonLink("primary", "ml-1 hidden !pr-4 sm:inline-flex")}>
                  Pesan Catering
                  <ArrowRight className="ml-2" />
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className={navLink}>
                Masuk
              </Link>
              <Link href="/register" className={buttonLink("primary", "ml-1 !pr-4")}>
                Daftar
                <ArrowRight className="ml-2" />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
