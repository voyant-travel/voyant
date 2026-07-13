#!/usr/bin/env node
import { once } from "node:events"

import { parseOperatorCliArguments } from "./cli-arguments.js"
import { startOperatorProject } from "./index.js"

const { command, port, probe } = parseOperatorCliArguments(process.argv.slice(2))
if (command !== "start") {
  console.error(`voyant-operator: unsupported command ${command}`)
  process.exit(2)
}

const handle = await startOperatorProject({ port, preferBuiltArtifacts: true })
console.info(`[operator-runtime] Node host listening on :${handle.port}`)

if (probe) {
  if (!handle.server.listening) await once(handle.server, "listening")
  const response = await fetch(`http://127.0.0.1:${handle.port}/healthz`)
  if (!response.ok || (await response.text()) !== "ok") {
    await handle.close()
    throw new Error("Node host health probe failed.")
  }
  console.info("[operator-runtime] boot probe passed")
  await handle.close()
}
