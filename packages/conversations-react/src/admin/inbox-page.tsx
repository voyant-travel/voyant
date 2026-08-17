"use client"

import { useAdminHref } from "@voyant-travel/admin"
import { useVoyantReactContext } from "@voyant-travel/react"
import { type FormEvent, useEffect, useState } from "react"
import { conversationsApi } from "../api.js"
import type { InboxConversation } from "../types.js"

export function InboxPage() {
  const { baseUrl, fetcher } = useVoyantReactContext()
  const [items, setItems] = useState<InboxConversation[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    conversationsApi
      .list(fetcher, baseUrl)
      .then(setItems)
      .catch((cause) => setError(String(cause)))
  }, [baseUrl, fetcher])
  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-muted-foreground">Customer email conversations</p>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <section className="divide-y rounded-md border" aria-label="Conversations">
        {items.map((item) => (
          <ConversationRow key={item.id} item={item} />
        ))}
        {items.length === 0 && !error ? (
          <p className="p-6 text-sm text-muted-foreground">No conversations yet.</p>
        ) : null}
      </section>
      <StartConversation onStarted={(item) => setItems((current) => [item, ...current])} />
    </main>
  )
}

function ConversationRow({ item }: { item: InboxConversation }) {
  const resolveHref = useAdminHref()
  const href = resolveHref("conversation.detail", { id: item.id })
  return (
    <a className="block p-4 hover:bg-muted/50" href={href}>
      <div className="flex justify-between gap-4">
        <strong>{item.subject ?? item.suggestedSubject ?? "No subject"}</strong>
        <time className="text-xs">{new Date(item.lastPartAt).toLocaleString()}</time>
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{item.customerAddress}</span>
        <span>{item.unreadCount > 0 ? `${item.unreadCount} unread` : item.status}</span>
      </div>
    </a>
  )
}

function StartConversation({ onStarted }: { onStarted(item: InboxConversation): void }) {
  const { baseUrl, fetcher } = useVoyantReactContext()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const detail = await conversationsApi.start(fetcher, baseUrl, {
        personRef: String(form.get("personRef")),
        contactPointRef: String(form.get("contactPointRef")),
        channelAccountId: String(form.get("channelAccountId")),
        fromAddress: String(form.get("fromAddress")),
        subject: String(form.get("subject")) || null,
        text: String(form.get("text")),
        idempotencyKey: crypto.randomUUID(),
      })
      onStarted(detail.conversation)
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
