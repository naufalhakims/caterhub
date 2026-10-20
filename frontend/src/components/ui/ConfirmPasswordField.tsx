"use client";

import { useEffect, useRef } from "react";
import { Field, Input } from "./Field";

type Props = {
  label: string;
  name?: string;
  passwordName?: string;
  minLength?: number;
};

/** Field konfirmasi kata sandi yang memvalidasi kecocokan sebelum form dikirim. */
export function ConfirmPasswordField({
  label,
  name = "confirmPassword",
  passwordName = "newPassword",
  minLength = 8,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    const form = input?.form;
    if (!input || !form) return;
    const password = form.elements.namedItem(passwordName);
    if (!(password instanceof HTMLInputElement)) return;

    const validate = () => {
      input.setCustomValidity(
        input.value && input.value !== password.value
          ? "Konfirmasi kata sandi tidak cocok."
          : "",
      );
    };

    validate();
    input.addEventListener("input", validate);
    password.addEventListener("input", validate);
    return () => {
      input.removeEventListener("input", validate);
      password.removeEventListener("input", validate);
    };
  }, [passwordName]);

  return (
    <Field label={label}>
      <Input
        ref={ref}
        name={name}
        type="password"
        autoComplete="new-password"
        minLength={minLength}
        required
      />
    </Field>
  );
}
