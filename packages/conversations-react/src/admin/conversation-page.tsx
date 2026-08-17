"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"
import { useVoyantReactContext } from "@voyant-travel/react"
import { type FormEvent, useEffect, useState } from "react"
import { conversationsApi } from "../api.js"
import type { InboxConversationDetail } from "../types.js"

export default function ConversationPage({ params }: AdminRoutePageProps) {
  const id = params.id ?? ""
  const { baseUrl, fetcher } = useVoyantReactContext()
  const [detail, setDetail] = useState<InboxConversationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    conversationsApi
      .get(fetcher, baseUrl, id)
      .then(setDetail)
      .catch((cause) => setError(String(cause)))
    conversationsApi.markRead(fetcher, baseUrl, id).catch(() => undefined)
  }, [baseUrl, fetcher, id])
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const part = await conversationsApi.reply(fetcher, baseUrl, id, {
        channelAccountId: String(form.get("channelAccountId")),
        text: String(form.get("text")),
        idempotencyKey: crypto.randomUUID(),
      })
      setDetail((current) => (current ? { ...current, parts: [...current.parts, part] } : current))
      event.currentTarget.reset()
    } catch (cause) {
      setError(String(cause))
    }
  }
  if (!detail) return <main className="p-6">{error ?? "Loading conversation…"}</main>
  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{detail.conversation.subject ?? "No subject"}</h1>
        <p className="text-sm text-muted-foreground">{detail.conversation.customerAddress}</p>
      </header>
      <ol className="space-y-3">
        {detail.parts.map((part) => (
          <li
            key={part.id}
            className={`max-w-2xl rounded-md border p-4 ${part.direction === "outbound" ? "ml-auto bg-muted/40" : ""}`}
          >
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>{part.senderAddress}</span>
              <span>{part.deliveryStatus}</span>
            </div>
            <p className="whitespace-pre-wrap">{part.textBody ?? "(HTML message)"}</p>
          </li>
        ))}
      </ol>
      <form className="grid max-w-2xl gap-3" onSubmit={reply}>
        <input
          required
          name="channelAccountId"
          placeholder="Channel account ID"
          className="rounded border p-2"
        />
        <textarea
          required
          name="text"
          placeholder="Reply"
          className="min-h-28 rounded border p-2"
        />
        <button
          className="justify-self-start rounded bg-primary px-4 py-2 text-primary-foreground"
          type="submit"
        >
          Send reply
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </main>
  )
}
