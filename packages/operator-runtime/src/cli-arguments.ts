export interface OperatorCliArguments {
  command: string
  port: number
  probe: boolean
}

export function parseOperatorCliArguments(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
): OperatorCliArguments {
  const args = argv.filter((value) => value !== "--")
  const command = args[0] && !args[0].startsWith("--") ? args[0] : "start"
  const portIndex = args.indexOf("--port")
  const explicitPort = portIndex >= 0 ? args[portIndex + 1] : undefined
  const port = Number.parseInt(explicitPort ?? env.PORT ?? "8080", 10)

  return { command, port, probe: args.includes("--probe") }
}
