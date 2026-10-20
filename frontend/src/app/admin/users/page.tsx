import { Card, Empty, StatusBadge } from "@/components/ui/Card";
import { apiGet } from "@/lib/api";

type AdminUser = { id: string; name: string | null; email: string; role: string };

export default async function AdminUsersPage() {
  const users = await apiGet<AdminUser[]>("/api/v1/admin/users");
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Pengguna</h1>
      <p className="text-sm text-stone-500">{users.length} akun terdaftar.</p>
      {users.length === 0 ? (
        <div className="mt-4"><Empty title="Belum ada pengguna." /></div>
      ) : (
        <div className="mt-4 space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="!p-3.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 font-bold text-stone-600">
                    {(u.name ?? u.email).trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{u.name}</p>
                    <p className="truncate text-[13px] text-stone-400">{u.email}</p>
                  </div>
                </div>
                <StatusBadge status={u.role} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
