import type { Context } from "hono"

import type { CruiseAdapter, SourceRef } from "./adapters/index.js"
import { resolveCruiseAdapter } from "./adapters/registry.js"
import {
  encodeSourceRef,
  makeExternalSourceKey,
  type ParsedKey,
  sourceRefFromExternalKeyRef,
} from "./lib/key.js"
import type { CruiseContentScope } from "./service-content.js"

export const adapterNotRegistered = (provider: string) => ({
  error: "adapter_not_registered",
  detail:
    "No CruiseAdapter registered for source provider '" +
    provider +
    "'. Register one at app startup via registerCruiseAdapter() - see docs/architecture/cruises-module.md section 10.",
})

export const invalidKey = (raw: string) => ({
  error: "invalid_key",
  detail: `Unrecognized cruise key: ${raw}`,
})

export function resolveExternal(parsed: Extract<ParsedKey, { kind: "external" }>): {
  adapter: CruiseAdapter
  sourceRef: SourceRef
} | null {
  const adapter = resolveCruiseAdapter(parsed.provider)
  if (!adapter) return null
  return { adapter, sourceRef: sourceRefFromExternalKeyRef(parsed.ref) }
}

export function makeExternalKey(adapter: CruiseAdapter, ref: SourceRef): string {
  return makeExternalSourceKey(adapter.name, ref)
}

export const registryNotConfigured = () => ({
  error: "registry_not_configured",
  detail:
    "Cruise external detail/refresh dispatches through the catalog SourceAdapterRegistry. Inject one via Hono middleware: c.set('sourceAdapterRegistry', registry). See cruiseAdapterToSourceAdapter() in @voyantjs/cruises/adapters.",
})

export function entityIdFromExternal(parsed: Extract<ParsedKey, { kind: "external" }>): string {
  return `crus_${encodeSourceRef(sourceRefFromExternalKeyRef(parsed.ref))}`
}

export function readContentScope(c: Context): CruiseContentScope {
  const localeParams = c.req.queries("locale") ?? c.req.queries("locales") ?? []
  const headerLocale = c.req.header("accept-language")
  const acceptLanguageList = headerLocale ? parseAcceptLanguageHeader(headerLocale) : []
  const preferredLocales =
    localeParams.length > 0
      ? localeParams
      : acceptLanguageList.length > 0
        ? acceptLanguageList
        : ["en-GB"]
  const acceptMt = c.req.query("accept_mt")
  return {
    preferredLocales,
    market: c.req.query("market") ?? undefined,
    currency: c.req.query("currency") ?? undefined,
    acceptMachineTranslated: acceptMt != null ? acceptMt !== "false" && acceptMt !== "0" : true,
  }
}

function parseAcceptLanguageHeader(header: string): string[] {
  const parts = header.split(",")
  const ranked: Array<{ tag: string; q: number; idx: number }> = []
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!.trim()
    if (!part) continue
    const [tagRaw, ...params] = part.split(";")
    const tag = tagRaw!.trim()
    if (!tag || tag === "*") continue
    let q = 1
    for (const p of params) {
      const [k, v] = p.split("=").map((s) => s.trim())
      if (k === "q" && v) {
        const parsed = Number.parseFloat(v)
        if (Number.isFinite(parsed)) q = parsed
      }
    }
    ranked.push({ tag, q, idx: i })
  }
  ranked.sort((a, b) => b.q - a.q || a.idx - b.idx)
  return ranked.map((r) => r.tag)
}
