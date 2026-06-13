import type { SmartbillNodeHttp } from "./types.js"

export function concat(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const combined = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined
}

export async function importNodeHttp(): Promise<SmartbillNodeHttp> {
  const specifier = "node:http"
  return import(specifier) as Promise<SmartbillNodeHttp>
}
