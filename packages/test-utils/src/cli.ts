/**
 * Helpers for testing CLI command handlers that implement the Voyant
 * `CommandContext` shape:
 *
 *   { argv: string[], cwd: string, stdout: (s) => void, stderr: (s) => void }
 *
 * We define the shape structurally here to avoid a dep on `@voyant-travel/cli`.
 */

export interface TestCommandContext {
  argv: ReadonlyArray<string>
  cwd: string
  stdout: (chunk: string) => void
  stderr: (chunk: string) => void
}

export interface CommandIo {
  ctx: TestCommandContext
  stdout: string[]
  stderr: string[]
  /** Joined stdout buffer — convenience for assertions. */
  out: () => string
  /** Joined stderr buffer — convenience for assertions. */
  err: () => string
}

export interface MakeCliCtxOptions {
  cwd?: string
}

/**
 * Builds a capture-style CommandContext for exercising CLI command handlers.
 *
 * @example
 * const { ctx, out } = makeCliCtx(["--help"])
 * const code = await helpCommand(ctx)
 * expect(code).toBe(0)
 * expect(out()).toContain("voyant — Voyant CLI")
 */
export function makeCliCtx(
  argv: ReadonlyArray<string> = [],
  options: MakeCliCtxOptions = {},
): CommandIo {
  const stdout: string[] = []
  const stderr: string[] = []
  const ctx: TestCommandContext = {
    argv,
    cwd: options.cwd ?? "/tmp",
    stdout: (chunk: string) => stdout.push(chunk),
    stderr: (chunk: string) => stderr.push(chunk),
  }
  return {
    ctx,
    stdout,
    stderr,
    out: () => stdout.join(""),
    err: () => stderr.join(""),
  }
}
