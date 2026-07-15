export const OPERATOR_PROFILE_SETUP_STEP_ID =
  "@voyant-travel/operator-settings#setup.business-profile"

const fields = [
  "name",
  "legalName",
  "vatId",
  "registrationNumber",
  "address",
  "phone",
  "email",
  "website",
] as const

type OperatorProfileSetupField = (typeof fields)[number]

export type OperatorProfileSetupPrefill = Partial<Record<OperatorProfileSetupField, string>>

export function parseOperatorProfileSetupPrefill(value: unknown): OperatorProfileSetupPrefill {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    fields.flatMap((field) =>
      typeof value[field] === "string" ? [[field, value[field].trim()]] : [],
    ),
  )
}

export function mergeOperatorProfileSetupPrefill<T extends Record<string, unknown>>(
  profile: T,
  value: unknown,
): T & OperatorProfileSetupPrefill {
  const prefill = parseOperatorProfileSetupPrefill(value)
  const defaults = Object.fromEntries(
    fields.flatMap((field) => {
      const defaultValue = prefill[field]
      return !profile[field] && defaultValue ? [[field, defaultValue]] : []
    }),
  ) as OperatorProfileSetupPrefill
  return { ...profile, ...defaults }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
