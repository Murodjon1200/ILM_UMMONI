import { z } from "zod";

export const strongPasswordSchema = z
  .string()
  .min(12)
  .max(72)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/\d/)
  .regex(/[^A-Za-z0-9]/);

export const optionalStrongPasswordSchema = z
  .union([strongPasswordSchema, z.literal("")])
  .default("");

export function isStrongPassword(value: string) {
  return strongPasswordSchema.safeParse(value).success;
}
