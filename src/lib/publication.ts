import voynich from "@/assets/voynich-manuscript.jpg";
import roanoke from "@/assets/roanoke-colony.jpg";
import ironMask from "@/assets/iron-mask.jpg";
import antikythera from "@/assets/antikythera.jpg";

export const articleImages: Record<string, string> = { voynich, roanoke, "iron-mask": ironMask, antikythera };
export const imageOptions = [
  { key: "voynich", label: "Voynich manuscript" },
  { key: "roanoke", label: "Roanoke colony" },
  { key: "iron-mask", label: "Iron mask" },
  { key: "antikythera", label: "Antikythera mechanism" },
];
export function imageFor(key: string) { return articleImages[key] ?? voynich; }
export function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)).toUpperCase(); }
export function compactNumber(value: number) { return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
