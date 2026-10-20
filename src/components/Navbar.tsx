import Link from "next/link";
import { auth, signOut } from "@/auth";
import { roleHome } from "@/lib/roles";

export async function Navbar() {
  const session = await auth();
  const user = session?.user as { name?: string | null; role?: string } | undefined;
  const role = user?.role;
  // Marketplace hanya untuk tamu & pelanggan; vendor/admin punya antarmuka sendiri.
  const canBrowse = !user || role === "CUSTOMER";
  const homeLabel =
    role === "VENDOR" ? "Dasbor Vendor" : role === "ADMIN" ? "Dasbor Admin" : "Dasbor";

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200/80 bg-[#FAF7F1]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 font-display text-lg font-bold text-white shadow-sm">
            C
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Cater<span className="text-brand-700">Hub</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          {canBrowse && (
            <Link href="/catering" className="hidden rounded-lg px-3 py-2 hover:bg-stone-200/60 sm:block">
              Jelajahi Catering
            </Link>
          )}
          {user ? (
            <>
              <Link
                href={roleHome(role)}
                className="rounded-lg px-3 py-2 font-semibold hover:bg-stone-200/60"
              >
                {homeLabel}
              </Link>
              {role === "CUSTOMER" && (
                <Link href="/profile" className="hidden rounded-lg px-3 py-2 hover:bg-stone-200/60 sm:block">
                  Profil
                </Link>
              )}
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="rounded-lg px-3 py-2 text-stone-500 hover:bg-stone-200/60">
                  Keluar
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-stone-200/60">
                Masuk
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-brand-800"
              >
                Daftar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
