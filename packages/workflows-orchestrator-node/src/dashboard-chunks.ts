export interface ChunkEvent {
  runId: string
  chunk: {
    streamId: string
    seq: number
    encoding: "text" | "json" | "base64"
    chunk: unknown
    final: boolean
    at: number
  }
}

export interface ChunkBus {
  publish(event: ChunkEvent): void
  subscribe(fn: (event: ChunkEvent) => void): () => void
}

export function createChunkBus(): ChunkBus {
  const subs = new Set<(event: ChunkEvent) => void>()
  return {
    publish(event) {
      for (const fn of subs) {
        try {
          fn(event)
        } catch {
          // Ignore subscriber errors so streaming keeps going.
        }
      }
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}
