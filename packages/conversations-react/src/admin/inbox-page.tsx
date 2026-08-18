"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAdminHref } from "@voyant-travel/admin"
import { useVoyantReactContext } from "@voyant-travel/react"
import { type FormEvent, useState } from "react"
import { conversationsApi } from "../api.js"
import type { InboxConversation } from "../types.js"

export function InboxPage() {
  const { baseUrl, fetcher } = useVoyantReactContext()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<Record<string, string | boolean | undefined>>({})
  const [selected, setSelected] = useState<string[]>([])
  const conversations = useQuery({
    queryKey: ["voyant", "conversations", "list", filters],
    queryFn: () => conversationsApi.list(fetcher, baseUrl, filters),
  })
  const items = conversations.data?.data ?? []
  const report = useQuery({
    queryKey: ["voyant", "conversations", "reporting"],
    queryFn: () => {
      const to = new Date()
      const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1_000)
      return conversationsApi.reporting(fetcher, baseUrl, from.toISOString(), to.toISOString())
    },
  })
  const bulk = useMutation({
    mutationFn: (changes: {
      assignedToUserId?: string | null
      status?: InboxConversation["status"]
    }) =>
      conversationsApi.bulk(fetcher, baseUrl, {
        items: items
          .filter(({ id }) => selected.includes(id))
          .map(({ id, revision }) => ({ id, revision })),
        changes,
      }),
    onSuccess: async () => {
      setSelected([])
      await queryClient.invalidateQueries({ queryKey: ["voyant", "conversations"] })
    },
  })
  const error = conversations.error ? String(conversations.error) : null
  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setFilters({
      queue: String(form.get("queue") ?? ""),
      q: String(form.get("q") ?? ""),
      priority: String(form.get("priority") ?? ""),
      unread: form.get("unread") === "on" ? true : undefined,
    })
    setSelected([])
  }
  function submitBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const status = String(form.get("status") ?? "") as InboxConversation["status"] | ""
    const assignee = String(form.get("assignedToUserId") ?? "")
    bulk.mutate({
      ...(status ? { status } : {}),
      ...(assignee ? { assignedToUserId: assignee } : {}),
    })
  }
  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-muted-foreground">Customer conversations</p>
      </header>
      <form className="flex flex-wrap gap-2" onSubmit={submitFilters} aria-label="Inbox filters">
        <select name="queue" className="rounded border p-2" defaultValue="">
          <option value="">All queues</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned_to_me">Assigned to me</option>
          <option value="waiting_on_staff">Waiting on staff</option>
          <option value="waiting_on_customer">Waiting on customer</option>
          <option value="snoozed">Snoozed</option>
          <option value="closed">Closed</option>
        </select>
        <input
          name="q"
          minLength={2}
          maxLength={100}
          placeholder="Search Inbox"
          className="rounded border p-2"
        />
        <select name="priority" className="rounded border p-2" defaultValue="">
          <option value="">Any priority</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="unread" />
          Unread
        </label>
        <button className="rounded border px-3" type="submit">
          Apply
        </button>
      </form>
      {report.data ? (
        <section className="grid gap-2 sm:grid-cols-4" aria-label="Seven-day Inbox report">
          <Metric label="New" value={report.data.volumes.new} />
          <Metric label="Closed" value={report.data.volumes.closed} />
          <Metric label="Backlog" value={report.data.backlog} />
          <Metric label="Delivery failures" value={report.data.delivery.failed} />
          <p className="sm:col-span-4 text-xs text-muted-foreground">
            Elapsed-time operational indicators; business-hour SLA rules are not configured.
          </p>
        </section>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {selected.length > 0 ? (
        <form
          className="flex flex-wrap gap-2 rounded border p-3"
          onSubmit={submitBulk}
          aria-label="Bulk lifecycle update"
        >
          <span>{selected.length} selected</span>
          <input
            name="assignedToUserId"
            placeholder="Assign to staff ID"
            className="rounded border px-2"
          />
          <select name="status" defaultValue="" className="rounded border px-2">
            <option value="">Keep lifecycle</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <button type="submit" className="rounded border px-3">
            Apply audited update
          </button>
        </form>
      ) : null}
      <section className="divide-y rounded-md border" aria-label="Conversations">
        {items.map((item) => (
          <ConversationRow
            key={item.id}
            item={item}
            selected={selected.includes(item.id)}
            onSelected={(checked) =>
              setSelected((current) =>
                checked ? [...current, item.id] : current.filter((id) => id !== item.id),
              )
            }
          />
        ))}
        {items.length === 0 && !error ? (
          <p className="p-6 text-sm text-muted-foreground">No conversations yet.</p>
        ) : null}
      </section>
      {conversations.data?.page.nextCursor ? (
        <button
          className="rounded border px-3 py-2"
          type="button"
          onClick={() =>
            setFilters((current) => ({ ...current, cursor: conversations.data!.page.nextCursor! }))
          }
        >
          Next page
        </button>
      ) : null}
      <StartConversation />
    </main>
  )
}

function ConversationRow({
  item,
  selected,
  onSelected,
}: {
  item: InboxConversation
  selected: boolean
  onSelected(checked: boolean): void
}) {
  const resolveHref = useAdminHref()
  const href = resolveHref("conversation.detail", { id: item.id })
  return (
    <div className="flex items-start gap-3 p-4 hover:bg-muted/50">
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) => onSelected(event.target.checked)}
        aria-label={`Select ${item.subject ?? item.id}`}
      />
      <a className="block min-w-0 flex-1" href={href}>
        <div className="flex justify-between gap-4">
          <strong>{item.subject ?? item.suggestedSubject ?? "No subject"}</strong>
          <time className="text-xs">{new Date(item.lastPartAt).toLocaleString()}</time>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{item.customerAddress}</span>
          <span>{item.unreadCount > 0 ? `${item.unreadCount} unread` : item.status}</span>
        </div>
      </a>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <strong>{value}</strong>
    </div>
  )
}

function StartConversation() {
  const { baseUrl, fetcher } = useVoyantReactContext()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inboxes = useQuery({
    queryKey: ["voyant", "conversations", "inboxes"],
    queryFn: () => conversationsApi.inboxes(fetcher, baseUrl),
    enabled: open,
  })
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await conversationsApi.start(fetcher, baseUrl, {
        channel: "email",
        inboxId: String(form.get("inboxId")),
        personRef: String(form.get("personRef")),
        contactPointRef: String(form.get("contactPointRef")),
        channelAccountId: String(form.get("channelAccountId")),
        fromAddress: String(form.get("fromAddress")),
        subject: String(form.get("subject")) || null,
        text: String(form.get("text")),
        idempotencyKey: crypto.randomUUID(),
      })
      await queryClient.invalidateQueries({ queryKey: ["voyant", "conversations"] })
      setOpen(false)
    } catch (cause) {
      setError(String(cause))
    }
  }
  if (!open)
    return (
      <button type="button" className="rounded-md border px-3 py-2" onClick={() => setOpen(true)}>
        Start conversation
      </button>
    )
  return (
    <form className="grid max-w-xl gap-3 rounded-md border p-4" onSubmit={submit}>
      <h2 className="font-medium">New email conversation</h2>
      <select required name="inboxId" className="rounded border p-2">
        <option value="">Choose Inbox</option>
        {(inboxes.data ?? []).map((inbox) => (
          <option key={inbox.id} value={inbox.id}>
            {inbox.name}
          </option>
        ))}
      </select>
      <input
        required
        name="personRef"
        placeholder="Person reference"
        className="rounded border p-2"
      />
      <input
        required
        name="contactPointRef"
        placeholder="Email contact point reference"
        className="rounded border p-2"
      />
      <input
        required
        name="channelAccountId"
        placeholder="Channel account ID"
        className="rounded border p-2"
      />
      <input
        required
        name="fromAddress"
        type="email"
        placeholder="Sending address"
        className="rounded border p-2"
      />
      <input name="subject" placeholder="Subject" className="rounded border p-2" />
      <textarea
        required
        name="text"
        placeholder="Message"
        className="min-h-24 rounded border p-2"
      />
      {error ? <p role="alert">{error}</p> : null}
      <div className="flex gap-2">
        <button className="rounded bg-primary px-3 py-2 text-primary-foreground" type="submit">
          Send
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}
