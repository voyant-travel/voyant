// @voyant-travel/workflows/errors
//
// Typed error classes used across the Voyant Workflows SDK.
// Contract defined in docs/sdk-surface.md §7.

export type ErrorCategory = "USER_ERROR" | "RUNTIME_ERROR"

export abstract class VoyantError extends Error {
  readonly code: string
  readonly category: ErrorCategory

  constructor(
    message: string,
    opts: {
      code: string
      category: ErrorCategory
      cause?: unknown
    },
  ) {
    super(message, { cause: opts.cause })
    this.name = new.target.name
    this.code = opts.code
    this.category = opts.category
  }
}

export class FatalError extends VoyantError {
  constructor(message: string, opts?: { cause?: unknown; code?: string }) {
    super(message, {
      code: opts?.code ?? "FATAL",
      category: "USER_ERROR",
      cause: opts?.cause,
    })
  }
}

export type RetryAfter = string | number | Date

export class RetryableError extends VoyantError {
  readonly retryAfter?: RetryAfter

  constructor(message: string, opts?: { retryAfter?: RetryAfter; cause?: unknown; code?: string }) {
    super(message, {
      code: opts?.code ?? "RETRYABLE",
      category: "USER_ERROR",
      cause: opts?.cause,
    })
    this.retryAfter = opts?.retryAfter
  }
}

export class TimeoutError extends VoyantError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, { code: "TIMEOUT", category: "RUNTIME_ERROR", cause: opts?.cause })
  }
}

export class HookConflictError extends VoyantError {
  readonly tokenId: string

  constructor(tokenId: string, opts?: { cause?: unknown }) {
    super(`hook token already resolved: ${tokenId}`, {
      code: "HOOK_CONFLICT",
      category: "RUNTIME_ERROR",
      cause: opts?.cause,
    })
    this.tokenId = tokenId
  }
}

export class QuotaExceededError extends VoyantError {
  readonly meter: string
  readonly limit: number
  readonly environment: "production" | "preview" | "development"

  constructor(opts: {
    meter: string
    limit: number
    environment: "production" | "preview" | "development"
    cause?: unknown
  }) {
    super(`quota exceeded for ${opts.meter} (limit ${opts.limit}) in ${opts.environment}`, {
      code: "QUOTA_EXCEEDED",
      category: "RUNTIME_ERROR",
      cause: opts.cause,
    })
    this.meter = opts.meter
    this.limit = opts.limit
    this.environment = opts.environment
  }
}

export interface ValidationIssue {
  path: string[]
  message: string
}

export class ValidationError extends VoyantError {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[], opts?: { cause?: unknown }) {
    super(`validation failed with ${issues.length} issue${issues.length === 1 ? "" : "s"}`, {
      code: "VALIDATION",
      category: "USER_ERROR",
      cause: opts?.cause,
    })
    this.issues = issues
  }
}
