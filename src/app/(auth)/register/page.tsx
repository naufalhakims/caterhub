import Link from "next/link";
import { registerAction } from "@/server/auth-actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <Card className="animate-rise w-full !p-7">
      <h1 className="font-display text-2xl font-bold tracking-tight">Buat akun CaterHub</h1>
      <p className="mt-1 text-sm text-stone-500">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Masuk
        </Link>
      </p>
      {searchParams?.error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {searchParams.error}
        </p>
      )}
      <form action={registerAction} className="mt-6 space-y-4">
        <Field label="Nama / Nama Usaha">
          <Input name="name" required placeholder="cth. Budi Santoso" autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required placeholder="nama@email.com" autoComplete="email" />
        </Field>
        <Field label="Kata Sandi">
          <Input name="password" type="password" required minLength={6} placeholder="Minimal 6 karakter" autoComplete="new-password" />
        </Field>
        <Field label="Daftar sebagai">
          <Select name="role" defaultValue="CUSTOMER">
            <option value="CUSTOMER">Pelanggan — cari & pesan catering</option>
            <option value="VENDOR">Vendor — kelola usaha catering</option>
          </Select>
        </Field>
        <Button type="submit" className="w-full !py-2.5">
          Buat Akun
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-stone-400">
        Vendor baru diverifikasi admin sebelum bisa menerima pesanan.
      </p>
    </Card>
  );
}
