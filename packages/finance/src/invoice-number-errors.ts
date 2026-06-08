const INVOICE_NUMBER_UNIQUE_TARGETS = [
  "invoices_invoice_number_type_active_idx",
  "invoices_invoice_number_type_unique",
  "invoices_invoice_number_unique",
  "invoices_invoice_number_key",
  "invoice_number",
]

const UNIQUE_VIOLATION_SQLSTATE = "23505"

interface ErrorSignals {
  hasInvoiceNumberTarget: boolean
  hasUniqueViolation: boolean
}

export function isInvoiceNumberUniqueConstraintError(error: unknown) {
  const signals = collectErrorSignals(error, new Set(), 0)
  return signals.hasUniqueViolation && signals.hasInvoiceNumberTarget
}

function collectErrorSignals(error: unknown, seen: Set<object>, depth: number): ErrorSignals {
  if (!error || typeof error !== "object" || depth > 6 || seen.has(error)) {
    return { hasInvoiceNumberTarget: false, hasUniqueViolation: false }
  }
  seen.add(error)

  const record = error as Record<string, unknown>
  const strings = errorStrings(record)
  const signals = {
    hasInvoiceNumberTarget: strings.some((value) =>
      INVOICE_NUMBER_UNIQUE_TARGETS.some((target) => value.includes(target)),
    ),
    hasUniqueViolation: strings.some((value) => value.includes(UNIQUE_VIOLATION_SQLSTATE)),
  }

  for (const nested of nestedErrors(record)) {
    const nestedSignals = collectErrorSignals(nested, seen, depth + 1)
    signals.hasInvoiceNumberTarget ||= nestedSignals.hasInvoiceNumberTarget
    signals.hasUniqueViolation ||= nestedSignals.hasUniqueViolation
  }

  return signals
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
