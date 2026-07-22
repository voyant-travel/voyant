import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { Visibility } from "@voyant-travel/catalog/contract"
import {
  OVERLAY_DEFAULT_SCOPE,
  OVERLAY_ROOT_NODE_KEY,
  OVERLAY_ROOT_NODE_KIND,
  type OverlayOrigin,
  type SelectCatalogOverlay,
  type SelectCatalogOverlayHistory,
} from "@voyant-travel/catalog/overlay/schema"
import {
  clearOverlayByTarget,
  fetchOverlaysForEntity,
  listOverlayHistoryForTarget,
  OverlayVersionConflictError,
  writeOverlay,
} from "@voyant-travel/catalog/services/overlay"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import {
  mergeOverlaysIntoProductContent,
  normalizeProductContentOverlay,
  type ProductContent,
  productContentFieldToPointer,
  validateProductContent,
} from "./content-shape.js"
import { getProductContent, type ProductContentScope } from "./service-content.js"

export type ProductEditorialNodeKind = typeof OVERLAY_ROOT_NODE_KIND | "itinerary-day"

export interface ProductEditorialOverlayTarget {
  node_kind?: ProductEditorialNodeKind
  node_key?: string
  field_path: string
}

export interface ProductEditorialOverlayScope {
  locale: string
  audience: Visibility | typeof OVERLAY_DEFAULT_SCOPE
  market: string
}

export interface ProductEditorialOverlayWriteInput extends ProductEditorialOverlayTarget {
  scope: ProductEditorialOverlayScope
  value: unknown
  expected_version?: number | null
  origin: OverlayOrigin
  editorial_note?: string
}

export interface ProductEditorialOverlayClearInput extends ProductEditorialOverlayTarget {
  scope: ProductEditorialOverlayScope
  expected_version?: number | null
}

export interface ProductEditorialOverlayServiceOptions {
  registry: SourceAdapterRegistry
}

const ROOT_FIELDS = new Set([
  "/product/name",
  "/product/description",
  "/product/inclusions_html",
  "/product/exclusions_html",
  "/product/terms_html",
  "/product/highlights",
  "/product/hero_image_url",
  "/media",
])

const DAY_FIELDS = new Set(["title", "description", "hero_image_url", "services"])

export async function readProductEditorialOverlayState(
  db: AnyDrizzleDb,
  productId: string,
  scope: ProductContentScope,
  options: ProductEditorialOverlayServiceOptions,
  overlayScope?: Partial<Pick<ProductEditorialOverlayScope, "audience">>,
) {
  const source = await getProductContent(db, productId, scope, {
    registry: options.registry,
    applyOverlays: false,
  })
  if (!source) return null

  const effective = await getProductContent(db, productId, scope, {
    registry: options.registry,
    applyOverlays: true,
  })
  if (!effective) return null

  const overlays = await fetchOverlaysForEntity(db, "products", productId)
  const active = overlays.filter((overlay) => overlayMatchesReadScope(overlay, scope, overlayScope))
  const fields: Record<string, unknown> = {}
  for (const overlay of active) {
    const target = targetKey(overlay.node_kind, overlay.node_key, overlay.field_path)
    const sourceValue = readProductTargetValue(source.content, overlay)
    const effectiveValue = readProductTargetValue(effective.content, overlay)
    fields[target] = {
      state: overlayState(sourceValue, overlay.value, effectiveValue),
      sourceValue,
      overlayValue: overlay.value,
      effectiveValue,
      drifted: false,
      version: overlay.version ?? null,
      id: overlay.id ?? null,
      nodeKind: overlay.node_kind ?? OVERLAY_ROOT_NODE_KIND,
      nodeKey: overlay.node_key ?? OVERLAY_ROOT_NODE_KEY,
      fieldPath: overlay.field_path,
    }
  }

  return {
    subject: { module: "products", id: productId },
    locale: {
      requestedLocale: scope.preferredLocales[0] ?? "en-GB",
      sourceLocale: source.resolution.served_locale,
      servedLocale: effective.resolution.served_locale,
      matchKind: effectiveLocaleMatchKind(source, active),
    },
    source: source.content,
    effective: effective.content,
    fields,
    overlays: active,
    availableSourceLocales: [source.resolution.served_locale],
    availableOverlayLocales: unique(overlays.map((overlay) => overlay.locale)),
  }
}

export async function writeProductEditorialOverlay(
  db: AnyDrizzleDb,
  productId: string,
  input: ProductEditorialOverlayWriteInput,
  options: ProductEditorialOverlayServiceOptions,
): Promise<SelectCatalogOverlay> {
  const scope: ProductContentScope = {
    preferredLocales: [input.scope.locale],
    market: input.scope.market,
    acceptMachineTranslated: false,
  }
  const source = await getProductContent(db, productId, scope, {
    registry: options.registry,
    applyOverlays: false,
  })
  if (!source) throw new Error(`Product ${productId} not found`)

  const target = normalizeTarget(input)
  validateTarget(source.content, target)

  const existing = await fetchOverlaysForEntity(db, "products", productId)
  const candidateOverlays = [
    ...existing
      .filter((overlay) => !sameTarget(overlay, target, input.scope))
      .map((overlay) =>
        normalizeProductContentOverlay({
          field_path: overlay.field_path,
          node_kind: overlay.node_kind,
          node_key: overlay.node_key,
          value: overlay.value,
        }),
      ),
    normalizeProductContentOverlay({
      field_path: target.field_path,
      node_kind: target.node_kind,
      node_key: target.node_key,
      value: input.value,
    }),
  ]
  const merged = mergeOverlaysIntoProductContent(source.content, candidateOverlays)
  const validation = validateProductContent(merged)
  if (!validation.valid) {
    throw new Error(`Product editorial overlay failed validation: ${validation.reason}`)
  }

  return writeOverlay(db, {
    entity_module: "products",
    entity_id: productId,
    node_kind: target.node_kind,
    node_key: target.node_key,
    field_path: target.field_path,
    locale: input.scope.locale,
    audience: input.scope.audience,
    market: input.scope.market,
    value: input.value,
    origin: input.origin,
    expected_version: input.expected_version,
    editorial_note: input.editorial_note,
  })
}

export async function clearProductEditorialOverlay(
  db: AnyDrizzleDb,
  productId: string,
  input: ProductEditorialOverlayClearInput,
): Promise<SelectCatalogOverlay | null> {
  const target = normalizeTarget(input)
  return clearOverlayByTarget(db, {
    entity_module: "products",
    entity_id: productId,
    node_kind: target.node_kind,
    node_key: target.node_key,
    field_path: target.field_path,
    locale: input.scope.locale,
    audience: input.scope.audience,
    market: input.scope.market,
    expected_version: input.expected_version,
  })
}

export async function listProductEditorialOverlayHistory(
  db: AnyDrizzleDb,
  productId: string,
  target?: Partial<ProductEditorialOverlayTarget & ProductEditorialOverlayScope>,
): Promise<SelectCatalogOverlayHistory[]> {
  return listOverlayHistoryForTarget(db, {
    entity_module: "products",
    entity_id: productId,
    ...(target?.node_kind ? { node_kind: target.node_kind } : {}),
    ...(target?.node_key ? { node_key: target.node_key } : {}),
    ...(target?.field_path
      ? {
          field_path: normalizeFieldPath({
            node_kind: target.node_kind,
            field_path: target.field_path,
          }),
        }
      : {}),
    ...(target?.locale ? { locale: target.locale } : {}),
    ...(target?.audience ? { audience: target.audience } : {}),
    ...(target?.market ? { market: target.market } : {}),
  })
}

export { OverlayVersionConflictError }

function normalizeTarget(
  target: ProductEditorialOverlayTarget,
): Required<ProductEditorialOverlayTarget> {
  const nodeKind = target.node_kind ?? OVERLAY_ROOT_NODE_KIND
  const nodeKey = target.node_key ?? OVERLAY_ROOT_NODE_KEY
  return {
    node_kind: nodeKind,
    node_key: nodeKey,
    field_path: normalizeFieldPath(target),
  }
}

function normalizeFieldPath(target: ProductEditorialOverlayTarget): string {
  const nodeKind = target.node_kind ?? OVERLAY_ROOT_NODE_KIND
  if (nodeKind === OVERLAY_ROOT_NODE_KIND) {
    return productContentFieldToPointer(target.field_path) ?? target.field_path
  }
  return target.field_path.startsWith("/") ? target.field_path.slice(1) : target.field_path
}

function validateTarget(
  content: ProductContent,
  target: Required<ProductEditorialOverlayTarget>,
): void {
  if (target.node_kind === OVERLAY_ROOT_NODE_KIND) {
    if (target.node_key !== OVERLAY_ROOT_NODE_KEY) {
      throw new Error("Root product editorial overlays must use node_key=root")
    }
    if (!ROOT_FIELDS.has(target.field_path)) {
      throw new Error(`Field ${target.field_path} is not an overlayable product presentation field`)
    }
    return
  }
  if (target.node_kind === "itinerary-day") {
    if (!DAY_FIELDS.has(target.field_path)) {
      throw new Error(`Field ${target.field_path} is not an overlayable itinerary-day field`)
    }
    const found = content.days.some((day) => day.id === target.node_key)
    if (!found) {
      throw new Error(
        `Itinerary-day overlay target ${target.node_key} is not present with a stable day id`,
      )
    }
    return
  }
  throw new Error(`Unsupported product editorial overlay node kind ${target.node_kind}`)
}

function sameTarget(
  overlay: {
    node_kind?: string
    node_key?: string
    field_path: string
    locale: string
    audience: string
    market: string
  },
  target: Required<ProductEditorialOverlayTarget>,
  scope: ProductEditorialOverlayScope,
): boolean {
  return (
    (overlay.node_kind ?? OVERLAY_ROOT_NODE_KIND) === target.node_kind &&
    (overlay.node_key ?? OVERLAY_ROOT_NODE_KEY) === target.node_key &&
    normalizeFieldPath({ node_kind: target.node_kind, field_path: overlay.field_path }) ===
      target.field_path &&
    overlay.locale === scope.locale &&
    overlay.audience === scope.audience &&
    overlay.market === scope.market
  )
}

function overlayMatchesReadScope(
  overlay: { locale: string; audience: string; market: string },
  scope: ProductContentScope,
  overlayScope?: Partial<Pick<ProductEditorialOverlayScope, "audience">>,
): boolean {
  const requestedLocale = scope.preferredLocales[0] ?? "en-GB"
  const requestedAudience = overlayScope?.audience ?? "customer"
  return (
    (overlay.locale === requestedLocale || overlay.locale === OVERLAY_DEFAULT_SCOPE) &&
    (overlay.audience === requestedAudience || overlay.audience === OVERLAY_DEFAULT_SCOPE) &&
    (overlay.market === (scope.market ?? OVERLAY_DEFAULT_SCOPE) ||
      overlay.market === OVERLAY_DEFAULT_SCOPE)
  )
}

function readProductTargetValue(
  content: ProductContent,
  overlay: { node_kind?: string; node_key?: string; field_path: string },
): unknown {
  const nodeKind = toProductEditorialNodeKind(overlay.node_kind)
  if (!nodeKind) return undefined
  const normalized = normalizeTarget({ ...overlay, node_kind: nodeKind })
  if (normalized.node_kind === "itinerary-day") {
    const day = content.days.find((candidate) => candidate.id === normalized.node_key)
    return day ? (day as Record<string, unknown>)[normalized.field_path] : undefined
  }
  return readPointer(content, normalized.field_path)
}

function toProductEditorialNodeKind(value?: string): ProductEditorialNodeKind | undefined {
  if (!value || value === OVERLAY_ROOT_NODE_KIND) return OVERLAY_ROOT_NODE_KIND
  if (value === "itinerary-day") return value
  return undefined
}

function readPointer(value: unknown, pointer: string): unknown {
  if (!pointer.startsWith("/")) return undefined
  let cursor = value
  for (const raw of pointer.slice(1).split("/")) {
    const segment = raw.replaceAll("~1", "/").replaceAll("~0", "~")
    if (Array.isArray(cursor)) {
      cursor = cursor[Number.parseInt(segment, 10)]
    } else if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }
  return cursor
}

function overlayState(
  sourceValue: unknown,
  overlayValue: unknown,
  effectiveValue: unknown,
): string {
  if (sourceValue === undefined && effectiveValue !== undefined) return "overlay-only"
  if (overlayValue !== undefined) return "overlaid"
  if (effectiveValue === undefined) return "missing"
  return "inherited"
}

function effectiveLocaleMatchKind(
  source: Awaited<ReturnType<typeof getProductContent>> & {},
  overlays: ReadonlyArray<{ locale: string }>,
): string {
  if (!source) return "missing"
  const requested = source.resolution.candidate.locale
  const hasRequestedOverlay = overlays.some((overlay) => overlay.locale === requested)
  if (hasRequestedOverlay && source.resolution.match_kind !== "exact") return "mixed"
  if (hasRequestedOverlay) return "overlay-only"
  if (source.resolution.match_kind === "exact") return "exact"
  if (source.resolution.match_kind === "language_match") return "language-fallback"
  return "source-fallback"
}

function targetKey(
  nodeKind = OVERLAY_ROOT_NODE_KIND,
  nodeKey = OVERLAY_ROOT_NODE_KEY,
  path: string,
) {
  return `${nodeKind}:${nodeKey}:${path}`
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort()
}
