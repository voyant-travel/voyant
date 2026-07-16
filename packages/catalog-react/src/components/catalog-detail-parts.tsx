"use client"

import { Badge } from "@voyant-travel/ui/components/badge"
import { Input } from "@voyant-travel/ui/components/input"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Check, Copy, ExternalLink, Loader2, Minus, Plus, X } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react"

import { useCatalogUiI18nOrDefault, useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import type { CatalogUiMessages } from "../i18n/messages.js"
import type { CatalogDetailEnrichment, CatalogSearchHit } from "../index.js"
import type { CatalogDetailSheetWidth } from "./catalog-detail-sheet.js"

/**
 * Header-side "From {price}" indicator. Prefers per-departure
 * `lowestPriceCents` minimums (only counting open/limited slots); falls
 * back to the product's indexed `sellAmountCents` so always-on products
 * still surface a price. Renders nothing when neither source has a
 * value — the rest of the sheet still carries pricing detail elsewhere.
 */
export function ProductPriceFrom({
  enrichment,
  fields,
  messages,
}: {
  enrichment: CatalogDetailEnrichment | null
  fields: Record<string, unknown>
  messages: CatalogUiMessages["catalogPage"]["detail"]
}) {
  const { locale } = useCatalogUiI18nOrDefault()
  const departureMin = (enrichment?.departures ?? []).reduce<{
    amount: number
    currency: string | null
  } | null>((acc, d) => {
    if (typeof d.lowestPriceCents !== "number") return acc
    if (d.status === "sold_out" || d.status === "closed" || d.status === "cancelled") return acc
    if (acc && acc.amount <= d.lowestPriceCents) return acc
    return { amount: d.lowestPriceCents, currency: d.currency ?? null }
  }, null)
  const fallbackAmount =
    typeof fields.sellAmountCents === "number"
      ? fields.sellAmountCents
      : typeof fields.sellAmountCents === "string"
        ? Number(fields.sellAmountCents)
        : null
  const fallbackCurrency = typeof fields.sellCurrency === "string" ? fields.sellCurrency : null

  const amount = departureMin?.amount ?? (Number.isFinite(fallbackAmount) ? fallbackAmount : null)
  const currency = departureMin?.currency ?? fallbackCurrency
  if (amount == null) return null

  return (
    <div className="flex flex-col items-end whitespace-nowrap">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {messages.priceFromLabel}
      </span>
      <span className="font-semibold text-base tabular-nums">
        {formatPriceCents(amount, currency ?? undefined, locale)}
      </span>
    </div>
  )
}

export function DefaultMediaGrid({
  media,
}: {
  media: NonNullable<CatalogDetailEnrichment["media"]>
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {media.slice(0, 9).map((m, idx) =>
        m.type === "image" || m.type == null ? (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: gallery is render-only and ordering is stable per response -- owner: catalog-react; existing suppression is intentional pending typed cleanup.
            key={`${m.url}-${idx}`}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="block aspect-square overflow-hidden rounded-md ring-1 ring-border hover:ring-primary"
          >
            <img
              src={m.url}
              alt={m.caption ?? ""}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </a>
        ) : (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: gallery is render-only -- owner: catalog-react; existing suppression is intentional pending typed cleanup.
            key={`${m.url}-${idx}`}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="flex aspect-square items-center justify-center rounded-md bg-muted text-xs text-muted-foreground ring-1 ring-border hover:ring-primary"
          >
            {m.type}
          </a>
        ),
      )}
    </div>
  )
}

const SHEET_WIDTH_CLASSES: Record<string, string> = {
  md: "max-w-md!",
  lg: "max-w-lg!",
  xl: "max-w-xl!",
  "2xl": "max-w-2xl!",
  "3xl": "max-w-3xl!",
  "4xl": "max-w-4xl!",
  "5xl": "max-w-5xl!",
  "6xl": "max-w-6xl!",
}

export function sheetWidthClass(width: CatalogDetailSheetWidth): string {
  return SHEET_WIDTH_CLASSES[width] ?? width
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
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

export function AttributeList({
  entries,
  formatters,
  messages,
  renderSupplierLink,
}: {
  entries: Array<[string, unknown]>
  formatters?: Record<string, (value: unknown) => ReactNode>
  messages: CatalogUiMessages["catalogPage"]
  renderSupplierLink?: (supplierId: string, displayName: string) => ReactNode
}) {
  const { locale } = useCatalogUiI18nOrDefault()
  return (
    <div className="divide-y rounded-lg border">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[140px_1fr] items-baseline gap-4 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{attributeLabel(key, messages)}</span>
          <span className="text-sm break-words">
            {renderAttributeValue(key, value, {
              formatters,
              messages,
              renderSupplierLink,
              locale,
            })}
          </span>
        </div>
      ))}
    </div>
  )
}

function attributeLabel(key: string, messages: CatalogUiMessages["catalogPage"]): string {
  const overrides = messages.detail.attributeLabels
  if (key === "sellAmount") return overrides.sellAmount
  if (key === "supplierId") return overrides.supplierId
  return humanize(key)
}

function renderAttributeValue(
  key: string,
  value: unknown,
  ctx: {
    formatters?: Record<string, (value: unknown) => ReactNode>
    messages: CatalogUiMessages["catalogPage"]
    renderSupplierLink?: (supplierId: string, displayName: string) => ReactNode
    locale: string
  },
): ReactNode {
  const { formatters, messages, renderSupplierLink, locale } = ctx

  // Synthetic "Sell amount" — value is `{ amountCents, currency }`,
  // emitted by the attribute-reshaping pass above.
  if (key === "sellAmount" && value && typeof value === "object" && "amountCents" in value) {
    const amountCents = (value as { amountCents: unknown }).amountCents
    const currency = (value as { currency?: unknown }).currency
    const cents = typeof amountCents === "number" ? amountCents : Number(amountCents)
    if (!Number.isFinite(cents)) return <span className="text-muted-foreground">—</span>
    return (
      <span className="font-medium tabular-nums">
        {formatPriceCents(cents, typeof currency === "string" ? currency : undefined, locale)}
      </span>
    )
  }

  // Supplier — render an operator-supplied link to the supplier record,
  // falling back to the plain formatter when no renderer is wired.
  if (key === "supplierId" && renderSupplierLink && typeof value === "string" && value) {
    const displayName =
      typeof formatters?.[key] === "function"
        ? String((formatters[key] as (v: unknown) => unknown)(value) ?? value)
        : value
    return renderSupplierLink(value, displayName)
  }

  // Visibility — render as a badge so it reads at a glance.
  if (key === "visibility" && typeof value === "string" && value) {
    return (
      <Badge variant={value === "public" ? "default" : "secondary"} className="capitalize">
        {value}
      </Badge>
    )
  }

  return formatters?.[key] ? formatters[key]!(value) : defaultFormat(key, value, messages, locale)
}

export function ArrayBadges({ value }: { value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {value.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: array values aren't guaranteed unique (e.g. duplicate strings); the index disambiguates and the list is render-only. -- owner: catalog-react; existing suppression is intentional pending typed cleanup.
        <Badge key={`${String(v)}-${i}`} variant="secondary" className="font-normal">
          {String(v)}
        </Badge>
      ))}
    </div>
  )
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.length > 0)
}

/**
 * Inline tag editor used by the catalog detail sheet. Holds a local
 * working list so chip add/remove feels immediate; the indexed `value`
 * re-syncs whenever the hit refetches after a successful mutation.
 */
export function InlineTagsEditor({
  hit,
  value,
  onChange,
  placeholder,
}: {
  hit: CatalogSearchHit
  value: string[]
  onChange: (hit: CatalogSearchHit, next: string[]) => Promise<void> | void
  placeholder: string
}) {
  const messages = useCatalogUiMessagesOrDefault().catalogPage.detail
  // Seed the working set from the indexed value on each *hit change*
  // only. The catalog search refetches after every mutation, but
  // search reindexing is asynchronous — for a few seconds after the
  // PATCH the indexed hit still carries the pre-mutation tags. If we
  // re-synced from `value` on every render, those stale tags would
  // clobber the chip the user just added. Pinning the seed to `hit.id`
  // means a different product re-seeds, but our own optimistic state
  // sticks while the index catches up.
  const [tags, setTags] = useState<string[]>(value)
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const seededIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (seededIdRef.current === hit.id) return
    seededIdRef.current = hit.id
    setTags(value)
    setDraft("")
  }, [hit.id, value])

  const commit = async (next: string[]) => {
    const previous = tags
    setTags(next)
    setPending(true)
    try {
      await onChange(hit, next)
    } catch {
      setTags(previous)
    } finally {
      setPending(false)
    }
  }

  const addTag = () => {
    const trimmed = draft.trim().replace(/,+$/, "")
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setDraft("")
      return
    }
    void commit([...tags, trimmed])
    setDraft("")
  }

  const removeTag = (tag: string) => {
    void commit(tags.filter((t) => t !== tag))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addTag()
      return
    }
    if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      event.preventDefault()
      removeTag(tags[tags.length - 1] as string)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 font-normal">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="rounded-full hover:text-destructive"
              onClick={() => removeTag(tag)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
          onClick={() => inputRef.current?.focus()}
        >
          <Plus className="h-3 w-3" />
          {messages.addTag}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) addTag()
          }}
          placeholder={placeholder}
          className="h-8 max-w-xs text-sm"
        />
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Field formatting
// ─────────────────────────────────────────────────────────────────────────────

export function defaultFormat(
  field: string,
  value: unknown,
  messages: CatalogUiMessages["catalogPage"],
  locale: string,
): ReactNode {
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
        {truthy ? messages.values.yes : messages.values.no}
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
        {messages.values.open}
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
            {new Intl.DateTimeFormat(locale, {
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
          {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(num / 100)}
        </span>
      )
    }
  }

  // IDs — render in mono so they're visually distinct
  if (/Id$|^id$/.test(field) && typeof value === "string") {
    return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>
  }

  // Numeric strings returned by an index adapter
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
export function humanize(key: string): string {
  const pretty = key
    .replace(/\./g, " · ")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^(.)/, (m) => m.toUpperCase())
    .toLowerCase()
  return pretty.charAt(0).toUpperCase() + pretty.slice(1)
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

export function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" && value.length > 0 ? value : fallback
}

export function formatPriceCents(
  cents: number,
  currency: string | null | undefined,
  locale: string,
): string {
  if (!currency) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(cents / 100)
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? "" : String(value)
  })
}

/**
 * Compact, copyable id chip. Sourced cruise ids embed the full upstream
 * SourceRef (`crus_sr_<base64url>`) so they're long; truncate the display,
 * keep the full id on hover (`title`), and copy it on click.
 */
export function IdChip({ id }: { id: string }): ReactNode {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={id}
      onClick={() => {
        void navigator.clipboard?.writeText(id).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          },
          () => undefined,
        )
      }}
      className="inline-flex max-w-[14rem] items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="truncate">{id}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-60" />
      )}
    </button>
  )
}

/**
 * One cabin in the cruise Cabins tab: photo gallery (carousel + lightbox),
 * name + size/capacity, description, and amenity chips.
 */
