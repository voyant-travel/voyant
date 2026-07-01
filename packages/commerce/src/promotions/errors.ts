import { ApiHttpError } from "@voyant-travel/hono"

const UNIQUE_VIOLATION_SQLSTATE = "23505"

const PROMOTIONAL_OFFER_UNIQUE_CONSTRAINTS = {
  uidx_promotional_offers_slug_active: {
    code: "duplicate_promotional_offer_slug",
    field: "slug",
    message: "Active promotional offer slug already exists",
  },
  uidx_promotional_offers_code_active: {
    code: "duplicate_promotional_offer_code",
    field: "code",
    message: "Active promotional offer code already exists",
  },
} as const

type PromotionalOfferUniqueConstraint = keyof typeof PROMOTIONAL_OFFER_UNIQUE_CONSTRAINTS

interface ErrorSignals {
  hasUniqueViolation: boolean
  constraint?: PromotionalOfferUniqueConstraint
}

export function promotionalOfferUniqueConflictError(
  constraint: PromotionalOfferUniqueConstraint,
): ApiHttpError {
  const conflict = PROMOTIONAL_OFFER_UNIQUE_CONSTRAINTS[constraint]
  return new ApiHttpError(conflict.message, {
    status: 409,
    code: conflict.code,
    details: {
      resource: "promotional_offer",
      issues: [
        {
          code: conflict.code,
          path: [conflict.field],
          message: conflict.message,
        },
      ],
      fields: {
        [conflict.field]: [conflict.message],
      },
    },
  })
}

export function mapPromotionalOfferWriteError(error: unknown): never {
  const signals = collectErrorSignals(error, new Set(), 0)
  if (signals.hasUniqueViolation && signals.constraint) {
    throw promotionalOfferUniqueConflictError(signals.constraint)
  }

  throw error
}

function collectErrorSignals(error: unknown, seen: Set<object>, depth: number): ErrorSignals {
  if (!error || typeof error !== "object" || depth > 6 || seen.has(error)) {
    return { hasUniqueViolation: false }
  }
  seen.add(error)

  const record = error as Record<string, unknown>
  const strings = errorStrings(record)
  const signals: ErrorSignals = {
    hasUniqueViolation: strings.some((value) => value.includes(UNIQUE_VIOLATION_SQLSTATE)),
    constraint: findPromotionalOfferUniqueConstraint(strings),
  }

  for (const nested of nestedErrors(record)) {
    const nestedSignals = collectErrorSignals(nested, seen, depth + 1)
    signals.hasUniqueViolation ||= nestedSignals.hasUniqueViolation
    signals.constraint ??= nestedSignals.constraint
  }

  return signals
}

function findPromotionalOfferUniqueConstraint(
  values: string[],
): PromotionalOfferUniqueConstraint | undefined {
  return (
    Object.keys(PROMOTIONAL_OFFER_UNIQUE_CONSTRAINTS) as PromotionalOfferUniqueConstraint[]
  ).find((constraint) => values.some((value) => value.includes(constraint)))
}

function errorStrings(error: Record<string, unknown>) {
  return [
    error.code,
    error.sqlState,
    error.sqlstate,
    error.sql_state,
    error.constraint,
    error.constraintName,
    error.constraint_name,
    error.detail,
    error.message,
    error.stack,
  ].filter((value): value is string => typeof value === "string")
}

function nestedErrors(error: Record<string, unknown>) {
  const values = [
    error.cause,
    error.originalError,
    error.original,
    error.error,
    error.queryError,
    error.sourceError,
  ]
  if (Array.isArray(error.errors)) {
    values.push(...error.errors)
  }
  return values
}
