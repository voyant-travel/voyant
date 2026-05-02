"use client"

import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components/sheet"
import { cn } from "@voyantjs/ui/lib/utils"
import { Check, ExternalLink, Minus } from "lucide-react"
import type { ReactNode } from "react"

export interface CatalogDetailAction {
  label: string
  onClick: (hit: CatalogSearchHit) => void
  variant?: "default" | "secondary" | "outline" | "ghost"
}

export interface CatalogDetailSheetProps {
  hit: CatalogSearchHit | null
  onOpenChange: (open: boolean) => void
  formatters?: Record<string, (value: unknown) => ReactNode>
  actions?: CatalogDetailAction[]
  imageField?: string
}

const HIDDEN_FIELDS = new Set([
  "id",
  "name",
  "description",
  "shortDescription",
  "status",
  "text_embedding",
  "embedding_model_id",
])

const SYSTEM_FIELD_PREFIXES = ["source.", "seller."] as const

const ARRAY_FIELDS = new Set(["tags", "highlights", "regions", "themes", "defaultBookingModes"])

/**
 * Right-side detail sheet for any catalog hit. Header shows the entity's
 * primary image, name, status, and id. Body is split into Description,
 * Highlights/Tags (when present), and a clean two-column attribute grid.
 * System provenance fields are tucked into a collapsible at the bottom.
 */
export function CatalogDetailSheet({
  hit,
  onOpenChange,
  formatters,
  actions,
  imageField = "thumbnailUrl",
}: CatalogDetailSheetProps) {
  const open = hit != null
  const fields = hit?.document.fields ?? {}
  const name = stringOr(fields.name, "Untitled")
  const status = stringOr(fields.status, null)
  const description = stringOr(fields.description, null)
  const shortDescription = stringOr(fields.shortDescription, null)
  const imageUrl = stringOr(fields[imageField], null)

  const allEntries = Object.entries(fields).filter(([k]) => !HIDDEN_FIELDS.has(k))
  const arrayEntries: Array<[string, unknown]> = []
  const attributeEntries: Array<[string, unknown]> = []
  const systemEntries: Array<[string, unknown]> = []
  for (const [k, v] of allEntries) {
    if (SYSTEM_FIELD_PREFIXES.some((p) => k.startsWith(p))) systemEntries.push([k, v])
    else if (ARRAY_FIELDS.has(k) || Array.isArray(v)) arrayEntries.push([k, v])
    else attributeEntries.push([k, v])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <SheetHeader className="border-b bg-muted/20 px-6 py-5">
            <div className="flex items-start gap-4">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={name}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-border"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-medium text-white ring-1 ring-border">
                  {initialsOf(name)}
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-6">
                <SheetTitle className="text-base leading-snug">{name}</SheetTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {status && (
                    <Badge
                      variant={status === "active" || status === "live" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {status}
                    </Badge>
                  )}
                  {hit?.id && (
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {hit.id}
                    </code>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-6">
              {(shortDescription || description) && (
                <Section>
                  {shortDescription && (
                    <p className="text-sm font-medium leading-relaxed text-foreground">
                      {shortDescription}
                    </p>
                  )}
                  {description && (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  )}
                </Section>
              )}

              {arrayEntries.length > 0 && (
                <Section title="Tags & themes">
                  <div className="flex flex-col gap-3">
                    {arrayEntries.map(([key, value]) => (
                      <div key={key} className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {humanize(key)}
                        </span>
                        <ArrayBadges value={value} />
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {attributeEntries.length > 0 && (
                <Section title="Attributes">
                  <AttributeList entries={attributeEntries} formatters={formatters} />
                </Section>
              )}

              {systemEntries.length > 0 && (
                <details className="group rounded-lg border bg-muted/20">
                  <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-muted/40 group-open:border-b">
                    System
                  </summary>
                  <div className="px-4 py-3">
                    <AttributeList entries={systemEntries} formatters={formatters} />
                  </div>
                </details>
              )}
            </div>
          </div>

          {/* Footer */}
          {actions && actions.length > 0 && hit && (
            <SheetFooter className="border-t bg-muted/20 px-6 py-3">
              <div className="flex flex-wrap justify-end gap-2">
                {actions.map((a) => (
                  <Button
                    key={a.label}
                    variant={a.variant ?? "default"}
                    size="sm"
                    onClick={() => a.onClick(hit)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </SheetFooter>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

function AttributeList({
  entries,
  formatters,
}: {
  entries: Array<[string, unknown]>
  formatters?: Record<string, (value: unknown) => ReactNode>
}) {
  return (
    <div className="divide-y rounded-lg border">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[140px_1fr] items-baseline gap-4 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{humanize(key)}</span>
          <span className="text-sm break-words">
            {formatters?.[key] ? formatters[key](value) : defaultFormat(key, value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ArrayBadges({ value }: { value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {value.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: array values aren't guaranteed unique (e.g. duplicate strings); the index disambiguates and the list is render-only.
        <Badge key={`${String(v)}-${i}`} variant="secondary" className="font-normal">
          {String(v)}
        </Badge>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Field formatting
// ─────────────────────────────────────────────────────────────────────────────

function defaultFormat(field: string, value: unknown): ReactNode {
  if (value == null || value === "") {
    return <span className="text-muted-foreground">—</span>
  }

  // Booleans (and string "true"/"false" — products schema stores some as strings)
  if (typeof value === "boolean" || value === "true" || value === "false") {
    const truthy = value === true || value === "true"
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-sm",
          truthy ? "text-emerald-600" : "text-muted-foreground",
        )}
      >
        {truthy ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        {truthy ? "Yes" : "No"}
      </span>
    )
  }

  // URLs (image, map, hero)
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        Open
        <ExternalLink className="h-3 w-3" />
      </a>
    )
  }

  // JSON-stringified ISO date — projection writes dates via JSON.stringify
  // so they arrive wrapped in quotes ("\"2026-04-30T17:41:01Z\"")
  if (typeof value === "string") {
    const stripped = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(stripped)) {
      const d = new Date(stripped)
      if (!Number.isNaN(d.getTime())) {
        return (
          <time dateTime={stripped} className="text-sm">
            {new Intl.DateTimeFormat(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            }).format(d)}
          </time>
        )
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(stripped)) {
      return <span className="text-sm">{stripped}</span>
    }
  }

  // Money fields stored as cents (integer string or number)
  if (/Cents$/.test(field)) {
    const num = typeof value === "number" ? value : Number(value)
    if (Number.isFinite(num)) {
      return (
        <span className="font-medium text-sm">
          {new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(num / 100)}
        </span>
      )
    }
  }

  // IDs — render in mono so they're visually distinct
  if (/Id$|^id$/.test(field) && typeof value === "string") {
    return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>
  }

  // Numeric strings (Typesense stores everything as string)
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
    return <span className="text-sm tabular-nums">{value}</span>
  }

  return <span className="text-sm">{String(value)}</span>
}

/**
 * Turn camelCase / snake_case / dotted paths into a human-readable label.
 * `defaultQuantity` → "Default quantity"
 * `seller.operator_id` → "Seller · operator id"
 * `text_embedding` → "Text embedding"
 */
function humanize(key: string): string {
  const pretty = key
    .replace(/\./g, " · ")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^(.)/, (m) => m.toUpperCase())
    .toLowerCase()
  return pretty.charAt(0).toUpperCase() + pretty.slice(1)
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" && value.length > 0 ? value : fallback
}
