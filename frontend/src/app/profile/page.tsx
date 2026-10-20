import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Card, StatusBadge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { requireCustomer } from "@/lib/auth-helpers";
import { apiGet } from "@/lib/api";
import { changePasswordAction, updateCustomerProfileAction } from "@/server/profile-actions";

type Profile = {
  name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  role: string;
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
  await requireCustomer();
  const user = await apiGet<Profile>("/api/v1/me");
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-8">
        <p className="text-sm text-stone-500">
          <Link href="/dashboard" className="hover:text-brand-700 hover:underline">← Dashboard</Link>
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Profil saya</h1>
        <p className="text-sm text-stone-500">Data ini dipakai vendor untuk menghubungi Anda soal acara.</p>

        {searchParams?.ok && <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{searchParams.ok}</p>}
        {searchParams?.error && <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>}

        <Card className="mt-4 !p-5">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-700 font-display text-2xl font-bold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold">{user.name}</p>
              <p className="truncate text-sm text-stone-500">{user.email}</p>
              <div className="mt-1"><StatusBadge status={user.role} /></div>
            </div>
          </div>

          <form action={updateCustomerProfileAction} className="mt-5 space-y-3">
            <Field label="Nama lengkap">
              <Input name="name" defaultValue={user.name ?? ""} required minLength={2} maxLength={80} />
            </Field>
            <Field label="Email">
              <Input value={user.email} readOnly disabled className="!bg-stone-100 !text-stone-500" />
            </Field>
            <Field label="Nomor telepon / WhatsApp">
              <Input name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="cth. 0812 3456 7890" maxLength={20} />
            </Field>
            <Field label="Alamat">
              <Input name="address" defaultValue={user.address ?? ""} placeholder="cth. Jl. Darmo Permai III No. 12" maxLength={200} />
            </Field>
            <Field label="Kota">
              <Input name="city" defaultValue={user.city ?? ""} placeholder="cth. Surabaya" maxLength={60} />
            </Field>
            <Button type="submit">Simpan profil</Button>
          </form>
        </Card>

        <Card className="mt-4 !p-5">
          <h2 className="font-display text-lg font-bold">Ubah kata sandi</h2>
          <p className="text-[13px] text-stone-500">Minimal 8 karakter. Gunakan kombinasi yang tidak dipakai di layanan lain.</p>
          <form action={changePasswordAction} className="mt-3 space-y-3">
            <Field label="Kata sandi saat ini">
              <Input name="currentPassword" type="password" autoComplete="current-password" required />
            </Field>
            <Field label="Kata sandi baru">
              <Input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="Ulangi kata sandi baru">
              <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <Button type="submit" variant="secondary">Ubah kata sandi</Button>
          </form>
        </Card>
      </main>
    </>
  );
}
