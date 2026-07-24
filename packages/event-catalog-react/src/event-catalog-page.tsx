"use client"

import type {
  VoyantGraphEventCatalog,
  VoyantGraphEventCatalogEntry,
} from "@voyant-travel/core/project"
import { formatMessage } from "@voyant-travel/i18n"
import { useVoyantReactContext } from "@voyant-travel/react"
import { AlertCircle, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { type EventCatalogUiMessages, useEventCatalogUiMessagesOrDefault } from "./i18n.js"

interface EventCatalogResponse {
  data: VoyantGraphEventCatalog
}

export function EventCatalogPage() {
  const { baseUrl, fetcher } = useVoyantReactContext()
  const messages = useEventCatalogUiMessagesOrDefault().page
  const [catalog, setCatalog] = useState<VoyantGraphEventCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    void fetcher(`${baseUrl}/v1/admin/event-catalog`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            messages.requestFailedWithStatus.replace("{status}", String(response.status)),
          )
        }
        return (await response.json()) as EventCatalogResponse
      })
      .then(({ data }) => {
        setCatalog(data)
        setSelectedKey((current) => current ?? data.events[0]?.key ?? null)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : messages.requestFailed)
        }
      })
    return () => controller.abort()
  }, [baseUrl, fetcher, messages.requestFailed, messages.requestFailedWithStatus])

  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return catalog?.events ?? []
    return (catalog?.events ?? []).filter((event) =>
      [event.eventType, event.packageName, event.audit.sourceModule].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    )
  }, [catalog, query])
  const selected =
    catalog?.events.find((event) => event.key === selectedKey) ?? visibleEvents[0] ?? null

  return (
    <main className="flex min-h-full flex-col bg-background">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold">{messages.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {catalog
            ? formatMessage(messages.selectedContracts, { count: catalog.events.length })
            : messages.selectedContractsLoading}
        </p>
      </header>

      {error ? (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <section className="border-b lg:border-r lg:border-b-0" aria-label={messages.eventsLabel}>
          <div className="border-b p-3">
            <label className="relative block">
              <span className="sr-only">{messages.filterLabel}</span>
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                className="h-9 w-full rounded-md border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="search"
                placeholder={messages.filterPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="max-h-[38vh] overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
            {!catalog && !error ? (
              <p className="p-4 text-sm text-muted-foreground">{messages.loading}</p>
            ) : null}
            {catalog && visibleEvents.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{messages.noMatchingEvents}</p>
            ) : null}
            {visibleEvents.map((event) => (
              <EventRow
                key={event.key}
                event={event}
                selected={event.key === selected?.key}
                onSelect={() => setSelectedKey(event.key)}
              />
            ))}
          </div>
        </section>

        <section className="min-w-0 overflow-y-auto p-4 sm:p-6" aria-label={messages.contractLabel}>
          {selected ? <EventContract event={selected} messages={messages} /> : null}
        </section>
      </div>
    </main>
  )
}

function EventRow({
  event,
  selected,
  onSelect,
}: {
  event: VoyantGraphEventCatalogEntry
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`block w-full border-b px-4 py-3 text-left transition-colors ${
        selected ? "bg-muted" : "hover:bg-muted/50"
      }`}
      onClick={onSelect}
    >
      <span className="block break-all font-mono text-sm font-medium">{event.eventType}</span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {event.version} / {event.audit.sourceModule}
      </span>
    </button>
  )
}

function EventContract({
  event,
  messages,
}: {
  event: VoyantGraphEventCatalogEntry
  messages: EventCatalogUiMessages["page"]
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <h2 className="break-all font-mono text-lg font-semibold">{event.eventType}</h2>
          <p className="mt-1 break-all text-sm text-muted-foreground">{event.id}</p>
        </div>
        <span className="rounded border px-2 py-1 font-mono text-xs">v{event.version}</span>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border-b py-5 text-sm sm:grid-cols-2">
        <Metadata label={messages.owner} value={event.packageName} mono />
        <Metadata label={messages.sourceModule} value={event.audit.sourceModule} mono />
        <Metadata label={messages.visibility} value={event.visibility} />
        <Metadata label={messages.category} value={event.audit.category} />
      </dl>

      <section className="border-b py-5">
        <h3 className="text-sm font-semibold">{messages.redactedFields}</h3>
        {event.redactedFields.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {event.redactedFields.map((field) => (
              <li key={field} className="rounded border bg-muted px-2 py-1 font-mono text-xs">
                {field}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{messages.noneDeclared}</p>
        )}
      </section>

      <section className="py-5">
        <h3 className="text-sm font-semibold">{messages.payloadSchema}</h3>
        <pre className="mt-3 max-w-full overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs leading-5">
          <code>{JSON.stringify(event.payloadSchema, null, 2)}</code>
        </pre>
      </section>
    </div>
  )
}

function Metadata({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-all ${mono ? "font-mono text-xs" : "capitalize"}`}>{value}</dd>
    </div>
  )
}
