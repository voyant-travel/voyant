/**
 * A single, agent-recoverable problem. The shape is deliberately verbose so an
 * LLM tool runtime can fix the spec and retry without a human: `field` says
 * what to change, `message` says why, `fix` says how.
 */
export interface AuthoringIssue {
  code: string
  field?: string
  message: string
  fix?: string
}

/**
 * Thrown by the validator (and the builder, for structural problems it can only
 * detect mid-build, e.g. an unresolved catalog). Routes translate this to a 422
 * with `{ errors }` so the caller can self-correct.
 */
export class AuthoringValidationError extends Error {
  readonly issues: AuthoringIssue[]

  constructor(issues: AuthoringIssue[]) {
    super(issues.map((i) => i.message).join("; ") || "Invalid product graph")
    this.name = "AuthoringValidationError"
    this.issues = issues
  }
}
