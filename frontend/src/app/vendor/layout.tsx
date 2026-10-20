import { Navbar } from "@/components/Navbar";
import { SideNav } from "@/components/SideNav";
import { requireRole } from "@/lib/auth-helpers";

const NAV = [
  ["/vendor/dashboard", "Dashboard", "◈"],
  ["/vendor/orders", "Pesanan", "▣"],
  ["/vendor/quotations", "Penawaran", "✎"],
  ["/vendor/menu", "Menu", "☰"],
  ["/vendor/packages", "Paket", "▤"],
  ["/vendor/calendar", "Kalender", "◫"],
  ["/vendor/capacity", "Kapasitas", "◍"],
  ["/vendor/analytics", "Analitik", "↗"],
  ["/vendor/verification", "Verifikasi", "✓"],
  ["/vendor/profile", "Profil", "⚙"],
] as const;

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  await requireRole("VENDOR");
  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-6xl gap-6 px-4 py-6 md:flex">
        <aside className="shrink-0 md:w-52">
          <SideNav items={NAV} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
