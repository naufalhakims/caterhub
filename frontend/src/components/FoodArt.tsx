/**
 * Pengganti foto produk bila vendor belum mengunggah gambar: latar gradien
 * buah pastel + susunan ilustrasi makanan. Deterministik per `seed` agar
 * kartu yang sama selalu tampil sama.
 */
const BACKDROPS = [
  "from-mint via-[#EEF6C8] to-sun-200",
  "from-peach via-[#FDE3D3] to-blush",
  "from-sun-200 via-[#FFE7B0] to-peach",
  "from-blush via-[#F6E3F6] to-[#E3E1FF]",
  "from-[#D8EEF6] via-[#E5F3E2] to-mint",
] as const;

const DISHES = [
  ["🍱", "🍗", "🥗"],
  ["🍛", "🍤", "🥒"],
  ["🍲", "🍢", "🌶️"],
  ["🥘", "🍚", "🍋"],
  ["🍜", "🥟", "🍵"],
  ["🍰", "🍮", "🍓"],
] as const;

export function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function backdropFor(seed: string) {
  return BACKDROPS[hashSeed(seed) % BACKDROPS.length];
}

export function FoodArt({
  seed,
  className = "",
  size = "md",
}: {
  seed: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const h = hashSeed(seed);
  const [main, left, right] = DISHES[h % DISHES.length];
  const scale = size === "lg" ? "text-[7rem]" : size === "sm" ? "text-5xl" : "text-7xl";
  const side = size === "lg" ? "text-6xl" : size === "sm" ? "text-3xl" : "text-4xl";
  return (
    <div
      aria-hidden
      className={`relative grid place-items-center overflow-hidden bg-gradient-to-br ${backdropFor(seed)} ${className}`}
    >
      <span className={`absolute left-[14%] top-[22%] -rotate-12 ${side} drop-shadow-sm`}>{left}</span>
      <span className={`absolute right-[14%] top-[30%] rotate-12 ${side} drop-shadow-sm`}>{right}</span>
      <span className={`relative ${scale} drop-shadow-md`}>{main}</span>
    </div>
  );
}
