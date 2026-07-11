#!/usr/bin/env node
import { startOperatorProject } from "./index.js"

const args = process.argv.slice(2).filter((value) => value !== "--")
const command = args[0] && !args[0].startsWith("--") ? args[0] : "start"
if (command !== "start") {
  console.error(`voyant-operator: unsupported command ${command}`)
  process.exit(2)
}

const portIndex = args.indexOf("--port")
const port = Number.parseInt(args[portIndex + 1] ?? process.env.PORT ?? "8080", 10)
const handle = await startOperatorProject({ port })
console.info(`[operator-runtime] Node host listening on :${handle.port}`)

if (args.includes("--probe")) {
  const response = await fetch(`http://127.0.0.1:${handle.port}/healthz`)
  if (!response.ok || (await response.text()) !== "ok") {
    await handle.close()
    throw new Error("Node host health probe failed.")
  }
  console.info("[operator-runtime] boot probe passed")
  await handle.close()
}
