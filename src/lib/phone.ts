import { z } from "zod";

export function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "");
}

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((phone) => /^998\d{9}$/.test(phone), {
    message: "Telefon raqami 998 va 9 ta raqamdan iborat bo'lishi kerak.",
  });
