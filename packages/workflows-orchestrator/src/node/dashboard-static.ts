import { readFile, stat } from "node:fs/promises"
import { extname, join, resolve as resolvePath } from "node:path"

export function createStaticReader(rootDir: string): (path: string) => Promise<Uint8Array | null> {
  const root = resolvePath(rootDir)
  return async (path: string) => {
    const absolute = resolvePath(root, path)
    if (!absolute.startsWith(`${root}/`) && absolute !== root) return null
    try {
      return await readFile(absolute)
    } catch {
      return null
    }
  }
}

export async function findDashboardDir(startFrom: string): Promise<string | undefined> {
  // Convenience fallback for callers that don't pass an explicit `staticDir`:
  // look for a sibling `local-dashboard/dist` (a workflow dashboard SPA built
  // from `@voyant-travel/workflows-react/ui`). Production self-host should pass
  // `staticDir` explicitly.
  const candidates = [
    join(startFrom, "local-dashboard/dist"),
    join(startFrom, "../local-dashboard/dist"),
    join(startFrom, "../../local-dashboard/dist"),
  ]
  for (const candidate of candidates) {
    try {
      const entry = await stat(join(candidate, "index.html"))
      if (entry.isFile()) return candidate
    } catch {
      // Continue scanning candidate locations.
    }
  }
  return undefined
}

export async function assertReadableFile(path: string, label: string): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(path)
  } catch (err) {
    throw new Error(`voyant workflows selfhost: ${label} not found at "${path}"`, { cause: err })
  }
  if (!info.isFile()) {
    throw new Error(`voyant workflows selfhost: ${label} must be a file (got "${path}")`)
  }
}

export async function assertReadableDirectory(path: string, label: string): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(path)
  } catch (err) {
    throw new Error(`voyant workflows selfhost: ${label} not found at "${path}"`, { cause: err })
  }
  if (!info.isDirectory()) {
    throw new Error(`voyant workflows selfhost: ${label} must be a directory (got "${path}")`)
  }
}

export function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase()
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8"
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8"
    case ".css":
      return "text/css; charset=utf-8"
    case ".json":
      return "application/json; charset=utf-8"
    case ".svg":
      return "image/svg+xml"
    case ".png":
      return "image/png"
    case ".map":
      return "application/json"
    default:
      return "application/octet-stream"
  }
}

export function urlPath(raw: string): string {
  try {
    return new URL(raw, "http://local").pathname
  } catch {
    return raw
  }
}
