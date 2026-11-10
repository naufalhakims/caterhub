import { Navbar } from "@/components/Navbar";
import { SideNav } from "@/components/SideNav";
import { requireRole } from "@/lib/auth-helpers";

const NAV = [
  ["/vendor/dashboard", "Dashboard"],
  ["/vendor/orders", "Pesanan"],
  ["/vendor/quotations", "Permintaan masuk"],
  ["/vendor/menu", "Menu"],
  ["/vendor/packages", "Paket"],
  ["/vendor/production", "Produksi"],
  ["/vendor/costing", "Bahan & HPP"],
  ["/vendor/calendar", "Jadwal acara"],
  ["/vendor/capacity", "Kapasitas harian"],
  ["/vendor/analytics", "Analitik"],
  ["/vendor/verification", "Verifikasi"],
  ["/vendor/profile", "Profil"],
] as const;

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  await requireRole("VENDOR");
  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-7xl gap-10 px-4 py-8 sm:px-6 md:flex">
        <aside className="shrink-0 md:w-56 print:hidden">
          <SideNav items={NAV} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
