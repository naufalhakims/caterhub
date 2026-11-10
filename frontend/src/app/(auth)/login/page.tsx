import Link from "next/link";
import { loginAction } from "@/server/auth-actions";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input } from "@/components/ui/Field";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <Card className="animate-rise w-full !border-0 !p-0 sm:!p-2">
      <h1 className="font-display text-5xl text-ink">Selamat <em>datang</em> kembali</h1>
      <p className="mt-3 text-[15px] text-stone-500">
        Belum punya akun?{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          Daftar gratis
        </Link>
      </p>
      {searchParams?.error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {searchParams.error}
        </p>
      )}
      <form action={loginAction} className="mt-6 space-y-4">
        <Field label="Email">
          <Input name="email" type="email" required placeholder="nama@email.com" autoComplete="email" />
        </Field>
        <Field label="Kata Sandi">
          <Input name="password" type="password" required placeholder="••••••••" autoComplete="current-password" />
        </Field>
        <SubmitButton arrow className="w-full !py-3 !text-base">
          Masuk
        </SubmitButton>
      </form>
    </Card>
  );
}
