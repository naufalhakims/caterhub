"use client";

import { useState } from "react";

type Props = {
  name?: string;
  defaultValue?: number;
  required?: boolean;
};

const LABELS = ["Buruk", "Kurang", "Cukup", "Bagus", "Sangat bagus"];

/** Input rating bintang 1–5 yang tetap memakai radio native agar validasi form bekerja. */
export function StarRatingInput({ name = "rating", defaultValue = 0, required = true }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <fieldset>
      <legend className="sr-only">Rating bintang</legend>
      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <label
            key={star}
            className="cursor-pointer rounded-md p-0.5 transition hover:scale-105 focus-within:ring-2 focus-within:ring-brand-200"
            onMouseEnter={() => setHovered(star)}
            title={`${star} bintang — ${LABELS[star - 1]}`}
          >
            <input
              type="radio"
              name={name}
              value={star}
              required={required}
              checked={value === star}
              onChange={() => setValue(star)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`text-3xl leading-none ${star <= active ? "text-amber-500" : "text-stone-300"}`}
            >
              ★
            </span>
            <span className="sr-only">{star} bintang</span>
          </label>
        ))}
        <span className="ml-2 text-sm text-stone-500">
          {active ? `${active} dari 5 — ${LABELS[active - 1]}` : "Pilih rating"}
        </span>
      </div>
    </fieldset>
  );
}
