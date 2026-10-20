"use client";

import { useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "./Button";

type Props = Omit<ButtonProps, "type" | "disabled"> & {
  /** Tombol hanya aktif bila isi form berubah. Matikan untuk aksi keputusan. */
  requireDirty?: boolean;
  /** Nama field yang wajib berisi nilai meskipun tidak memakai atribut required. */
  requiredFields?: string[];
  /** Nonaktifkan tombol karena aksi sudah tidak relevan (mis. status sudah sama). */
  forceDisabled?: boolean;
};

function snapshot(form: HTMLFormElement): string {
  const parts: string[] = [];
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string") {
      parts.push(`${key}=${value}`);
    } else {
      // File tidak bisa dibandingkan langsung; metadata cukup untuk mendeteksi perubahan.
      parts.push(`${key}=file:${value.name}:${value.size}:${value.lastModified}`);
    }
  }
  return parts.join("\u0000");
}

function hasRequiredValues(form: HTMLFormElement, fields: string[]): boolean {
  if (fields.length === 0) return true;
  const data = new FormData(form);
  return fields.every((name) =>
    data.getAll(name).some((value) =>
      typeof value === "string" ? value.trim().length > 0 : value.size > 0,
    ),
  );
}

/**
 * Tombol submit yang sadar-isi form:
 * - nonaktif saat form belum diubah,
 * - nonaktif saat ada field wajib yang belum valid.
 *
 * Validasi memakai constraint HTML (`required`, `min`, `max`, `minLength`, dst.)
 * sehingga aturan tetap dekat dengan field yang bersangkutan.
 */
export function SubmitButton({
  requireDirty = true,
  requiredFields,
  forceDisabled = false,
  children,
  ...rest
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  const requiredKey = requiredFields?.join("\u0000") ?? "";

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;

    const initial = snapshot(form);
    const fields = requiredKey ? requiredKey.split("\u0000") : [];
    let frame = 0;

    const evaluate = () => {
      cancelAnimationFrame(frame);
      // Tunggu React menyelesaikan render nilai input terkontrol (mis. RupiahInput).
      frame = requestAnimationFrame(() => {
        const dirty = snapshot(form) !== initial;
        const valuesOk = hasRequiredValues(form, fields);
        setReady((!requireDirty || dirty) && valuesOk && form.checkValidity());
      });
    };

    evaluate();
    form.addEventListener("input", evaluate);
    form.addEventListener("change", evaluate);
    form.addEventListener("reset", evaluate);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("input", evaluate);
      form.removeEventListener("change", evaluate);
      form.removeEventListener("reset", evaluate);
    };
  }, [requireDirty, requiredKey]);

  return (
    <Button
      ref={ref}
      type="submit"
      disabled={forceDisabled || !ready}
      {...rest}
    >
      {children}
    </Button>
  );
}
