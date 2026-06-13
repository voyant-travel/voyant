export class AllocationServiceError extends Error {
  readonly status: number
  readonly detail?: unknown

  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.name = "AllocationServiceError"
    this.status = status
    this.detail = detail
  }
}
