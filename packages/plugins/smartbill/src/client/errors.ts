export interface SmartbillApiErrorOptions {
  operation: string
  status?: number
  body?: string
  response?: unknown
}

export class SmartbillApiError extends Error {
  readonly operation: string
  readonly status?: number
  readonly body?: string
  readonly response?: unknown

  constructor(message: string, options: SmartbillApiErrorOptions) {
    super(message)
    this.name = "SmartbillApiError"
    this.operation = options.operation
    this.status = options.status
    this.body = options.body
    this.response = options.response
  }
}

export interface SmartbillRateLimitErrorOptions extends SmartbillApiErrorOptions {
  retryAfterMs?: number
  retryAfterAt?: Date
  blockedAt?: Date
}

export class SmartbillRateLimitError extends SmartbillApiError {
  readonly retryAfterMs?: number
  readonly retryAfterAt?: Date
  readonly blockedAt?: Date

  constructor(message: string, options: SmartbillRateLimitErrorOptions) {
    super(message, options)
    this.name = "SmartbillRateLimitError"
    this.retryAfterMs = options.retryAfterMs
    this.retryAfterAt = options.retryAfterAt
    this.blockedAt = options.blockedAt
  }
}

export class SmartbillRateLimitCircuitOpenError extends SmartbillRateLimitError {
  constructor(options: SmartbillRateLimitErrorOptions) {
    super(
      `SmartBill rate-limit circuit is open${
        options.retryAfterMs !== undefined ? `; retry after ${options.retryAfterMs}ms` : ""
      }`,
      options,
    )
    this.name = "SmartbillRateLimitCircuitOpenError"
  }
}
