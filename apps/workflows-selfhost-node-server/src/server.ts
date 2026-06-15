import { startNodeSelfHostServer } from "@voyant-travel/workflows-orchestrator/node"

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const handle = await startNodeSelfHostServer(options)
  console.error(`voyant workflows selfhost: listening at ${handle.url}`)

  let shuttingDown = false
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    await handle.close()
  }

  process.on("SIGINT", () => {
    void shutdown().finally(() => process.exit(0))
  })
  process.on("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0))
  })
}

function parseArgs(argv: string[]): {
  entryFile: string
  host?: string
  port?: number
  staticDir?: string
  databaseUrl?: string
  cacheBustEntry?: boolean
} {
  const args = new Map<string, string | boolean>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith("--")) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith("--")) {
      args.set(key, true)
      continue
    }
    args.set(key, next)
    i += 1
  }

  const entryFile = getStringArg(args, "file") ?? process.env.VOYANT_ENTRY_FILE
  if (!entryFile) {
    throw new Error(
      "voyant workflows selfhost: missing required workflow entry. " +
        "Pass --file <path> or set VOYANT_ENTRY_FILE.",
    )
  }

  const portRaw = getStringArg(args, "port") ?? process.env.PORT
  const port = portRaw ? parsePort(portRaw) : undefined
  const host = getStringArg(args, "host") ?? process.env.HOST
  const staticDir = getStringArg(args, "static-dir") ?? process.env.VOYANT_STATIC_DIR
  const databaseUrl = getStringArg(args, "database-url") ?? process.env.DATABASE_URL
  const cacheBustEntry = Boolean(args.get("cache-bust-entry"))

  return {
    entryFile,
    host,
    port,
    staticDir,
    databaseUrl,
    cacheBustEntry,
  }
}

function getStringArg(args: Map<string, string | boolean>, key: string): string | undefined {
  const value = args.get(key)
  return typeof value === "string" ? value : undefined
}

function parsePort(raw: string): number {
  const value = Number.parseInt(raw, 10)
  if (Number.isNaN(value) || value < 1 || value > 65535) {
    throw new Error(`voyant workflows selfhost: --port must be 1-65535 (got "${raw}")`)
  }
  return value
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})
