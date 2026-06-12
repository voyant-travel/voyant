import type { ServerResponse } from "node:http"
import type { ChunkBus, ChunkEvent } from "./dashboard-chunks.js"
import type { SnapshotRunStore } from "./snapshot-run-store.js"
import type { StoreEvent, StoreStream } from "./store-stream.js"

function unrefTimer(timer: ReturnType<typeof setInterval>): void {
  if (
    typeof timer === "object" &&
    timer !== null &&
    "unref" in timer &&
    typeof timer.unref === "function"
  ) {
    timer.unref()
  }
}

export function handleSseStream(
  res: ServerResponse,
  stream: StoreStream,
  chunkBus?: ChunkBus,
): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  })
  res.write("retry: 3000\n\n")

  const writeEvent = (event: StoreEvent): void => {
    try {
      res.write(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }

  const writeChunk = (event: ChunkEvent): void => {
    try {
      res.write(`event: stream.chunk\ndata: ${JSON.stringify(event)}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }

  const unsubscribeStore = stream.subscribe(writeEvent)
  const unsubscribeChunk = chunkBus ? chunkBus.subscribe(writeChunk) : () => {}
  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }, 25_000)
  unrefTimer(ping)

  res.on("close", () => {
    clearInterval(ping)
    unsubscribeStore()
    unsubscribeChunk()
  })
}

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "compensated",
  "compensation_failed",
])

export function handleRunSseStream(
  res: ServerResponse,
  runId: string,
  stream: StoreStream,
  chunkBus: ChunkBus | undefined,
  store: SnapshotRunStore,
): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  })
  res.write("retry: 3000\n\n")

  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    try {
      res.end()
    } catch {
      // Ignore close failures.
    }
  }

  const writeEvent = (kind: string, data: unknown): void => {
    if (closed) return
    try {
      res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }

  void store.get(runId).then((run) => {
    if (run) {
      writeEvent("hello", { run })
      if (TERMINAL_STATUSES.has(run.status)) close()
    } else {
      writeEvent("hello", { run: null })
    }
  })

  const unsubscribeStore = stream.subscribe((event) => {
    if (event.kind === "added" || event.kind === "updated") {
      if (event.run.id !== runId) return
      writeEvent(event.kind, event)
      if (TERMINAL_STATUSES.has(event.run.status)) close()
    } else if (event.kind === "removed") {
      if (event.runId !== runId) return
      writeEvent(event.kind, event)
      close()
    }
  })

  const unsubscribeChunk = chunkBus
    ? chunkBus.subscribe((event) => {
        if (event.runId !== runId) return
        writeEvent("stream.chunk", event)
      })
    : () => {}

  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }, 25_000)
  unrefTimer(ping)

  res.on("close", () => {
    closed = true
    clearInterval(ping)
    unsubscribeStore()
    unsubscribeChunk()
  })
}
