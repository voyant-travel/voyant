import { z } from "zod"

const emailSchema = z.email()

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success
}

export function isValidOptionalEmail(value: string | null | undefined): boolean {
  return !value || isValidEmail(value)
}
