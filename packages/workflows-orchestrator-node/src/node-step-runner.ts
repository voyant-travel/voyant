import type { StepRunner } from "@voyantjs/workflows/handler"

export const nodeStepRunner: StepRunner = async ({ attempt, fn, stepCtx }) => {
  const startedAt = Date.now()
  try {
    const output = await fn(stepCtx)
    return { attempt, status: "ok", output, startedAt, finishedAt: Date.now() }
  } catch (err) {
    const error = err as Error
    const code =
      typeof (err as { code?: unknown }).code === "string"
        ? (err as { code: string }).code
        : "UNKNOWN"
    return {
      attempt,
      status: "err",
      error: {
        category: "USER_ERROR",
        code,
        message: error?.message ?? String(err),
        name: error?.name,
        stack: error?.stack,
      },
      startedAt,
      finishedAt: Date.now(),
    }
  }
}
