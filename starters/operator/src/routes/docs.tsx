import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { getApiUrl } from "../lib/env"

// Scalar is a browser-only widget — lazy-load it (+ its CSS) so the module is
// never evaluated during SSR, and so each visit code-splits it out of the main
// bundle.
const ApiReference = lazy(async () => {
  await import("@scalar/api-reference-react/style.css")
  const mod = await import("@scalar/api-reference-react")
  return { default: mod.ApiReferenceReact }
})

/**
 * Built-in API reference explorer for the operator deployment (voyant#2733).
 *
 * Renders Scalar over the committed per-module OpenAPI specs with a surface +
 * module selector — the "Admin: Bookings / Public: Catalog" UX the issue asked
 * for. Specs are lazy-loaded per selection via `import.meta.glob`, so Vite
 * code-splits each module's document into its own chunk: nothing but the picked
 * module's spec is fetched, and the multi-megabyte aggregate never ships in the
 * bundle. The doc generator itself stays build-time-only — this route only reads
 * the already-generated JSON artifacts.
 *
 * Note: this is a reference/demo surface in the starter and is intentionally
 * ungated. A real deployment that exposes its admin API contract publicly should
 * put this route behind its admin auth (or drop the admin surface from it).
 */

// Lazy loaders for every committed per-module spec, keyed by module + surface.
// `import.meta.glob` keeps each JSON in its own chunk, loaded only when picked.
const specLoaders = import.meta.glob<{ default: Record<string, unknown> }>(
  "../../openapi/{admin,storefront}/*.json",
)

interface SpecEntry {
  key: string
  surface: "admin" | "storefront"
  module: string
  load: () => Promise<{ default: Record<string, unknown> }>
}

export function withOperatorApiServer(
  spec: Record<string, unknown>,
  apiUrl = getApiUrl(),
): Record<string, unknown> {
  return {
    ...spec,
    servers: [
      {
        url: apiUrl.replace(/\/+$/, ""),
        description: "Operator API via this starter's /api mount",
      },
    ],
  }
}

function buildEntries(): SpecEntry[] {
  const entries: SpecEntry[] = []
  for (const [path, load] of Object.entries(specLoaders)) {
    // ".../openapi/<surface>/<module>.json"
    const match = /\/openapi\/(admin|storefront)\/([^/]+)\.json$/.exec(path)
    if (!match) continue
    entries.push({
      key: `${match[1]}/${match[2]}`,
      surface: match[1] as SpecEntry["surface"],
      module: match[2],
      load,
    })
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key))
}

export const routeOptions = {
  component: ApiDocsPage,
}

function ApiDocsPage(): React.ReactElement {
  const entries = useMemo(buildEntries, [])
  // Default to admin/bookings when present, else the first available spec.
  const [selectedKey, setSelectedKey] = useState(
    () => entries.find((e) => e.key === "admin/bookings")?.key ?? entries[0]?.key ?? "",
  )
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null)
  // Scalar is a browser-only widget; render it after mount to skip SSR.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const entry = entries.find((e) => e.key === selectedKey)
    if (!entry) return
    let cancelled = false
    entry.load().then((mod) => {
      if (!cancelled) setSpec(withOperatorApiServer(mod.default))
    })
    return () => {
      cancelled = true
    }
  }, [entries, selectedKey])

  if (entries.length === 0) {
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        No OpenAPI specs found. Run <code>pnpm --filter operator generate:openapi</code>.
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <strong style={{ fontFamily: "sans-serif", fontSize: 14 }}>Voyant API</strong>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <span style={{ color: "#6b7280" }}>Module</span>
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            style={{ padding: "4px 8px", fontSize: 13 }}
          >
            <optgroup label="Admin">
              {entries
                .filter((e) => e.surface === "admin")
                .map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.module}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Public / Storefront">
              {entries
                .filter((e) => e.surface === "storefront")
                .map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.module}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {mounted && spec ? (
          <Suspense
            fallback={
              <div style={{ padding: 24, fontFamily: "sans-serif", color: "#6b7280" }}>
                Loading…
              </div>
            }
          >
            <ApiReference configuration={{ content: spec }} />
          </Suspense>
        ) : (
          <div style={{ padding: 24, fontFamily: "sans-serif", color: "#6b7280" }}>Loading…</div>
        )}
      </div>
    </div>
  )
}
