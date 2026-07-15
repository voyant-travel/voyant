import type { FormState } from "./storefront-settings-form.js"

export const STOREFRONT_BRANDING_SETUP_STEP_ID = "@voyant-travel/storefront#setup.branding"

const fields = [
  "logoUrl",
  "faviconUrl",
  "brandMarkUrl",
  "primaryColor",
  "accentColor",
  "supportedLanguages",
  "defaultLocale",
] as const satisfies readonly (keyof FormState)[]

export type StorefrontSetupPrefill = Partial<Pick<FormState, (typeof fields)[number]>>

export function parseStorefrontSetupPrefill(value: unknown): StorefrontSetupPrefill {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    fields.flatMap((field) =>
      typeof value[field] === "string" ? [[field, value[field].trim()]] : [],
    ),
  )
}

export function mergeStorefrontSetupPrefill(form: FormState, value: unknown): FormState {
  const prefill = parseStorefrontSetupPrefill(value)
  const merged = { ...form }
  for (const field of fields) {
    if (!merged[field] && prefill[field]) merged[field] = prefill[field]
  }
  return merged
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
