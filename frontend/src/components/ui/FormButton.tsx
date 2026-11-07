/// <reference types="react-dom/canary" />
"use client";

import { useFormStatus } from "react-dom";
import { Button, Spinner, type ButtonProps } from "./Button";

/**
 * Tombol submit untuk Server Action yang langsung menunjukkan status proses.
 * Server Action + redirect butuh waktu; tanpa umpan balik instan pengguna
 * cenderung mengklik ulang.
 */
export function FormButton({
  children,
  pendingLabel = "Memproses…",
  disabled,
  ...rest
}: Omit<ButtonProps, "type"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...rest}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
