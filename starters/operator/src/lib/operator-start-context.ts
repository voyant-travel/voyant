export function getOperatorStartEnv(context: unknown): AppBindings | undefined {
  if (typeof context !== "object" || context === null || !("env" in context)) {
    return undefined
  }
  return (context as { env?: AppBindings }).env
}
