"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AdminRoutePageProps } from "@voyant-travel/admin"
import { useVoyantReactContext } from "@voyant-travel/react"
import { DateTimePicker } from "@voyant-travel/ui/components/date-time-picker"
import { type FormEvent, useEffect } from "react"
import { conversationsApi } from "../api.js"
import type { InboxPart } from "../types.js"

export default function ConversationPage({ params }: AdminRoutePageProps) {
  const id = params.id ?? ""
  const { baseUrl, fetcher } = useVoyantReactContext()
  const queryClient = useQueryClient()
  const key = ["voyant", "conversations", "detail", id] as const
  const detail = useQuery({
    queryKey: key,
    queryFn: () => conversationsApi.get(fetcher, baseUrl, id),
  })
  const assignees = useQuery({
    queryKey: ["voyant", "conversations", "assignable", detail.data?.conversation.inboxId],
    queryFn: () =>
      conversationsApi.assignableStaff(fetcher, baseUrl, detail.data!.conversation.inboxId!),
    enabled: Boolean(detail.data?.conversation.inboxId),
  })
  const inboxes = useQuery({
    queryKey: ["voyant", "conversations", "inboxes"],
    queryFn: () => conversationsApi.inboxes(fetcher, baseUrl),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["voyant", "conversations"] })
  const reply = useMutation({
    mutationFn: (input: { channelAccountId: string; text: string }) =>
      conversationsApi.reply(fetcher, baseUrl, id, {
        ...input,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: refresh,
  })
  const note = useMutation({
    mutationFn: (body: string) =>
      conversationsApi.note(fetcher, baseUrl, id, detail.data!.conversation.revision, body),
    onSuccess: refresh,
  })
  const update = useMutation({
    mutationFn: (changes: Parameters<typeof conversationsApi.update>[3]) =>
      conversationsApi.update(fetcher, baseUrl, id, changes),
    onSuccess: refresh,
  })
  useEffect(() => {
    conversationsApi
      .markRead(fetcher, baseUrl, id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["voyant", "conversations"] }))
      .catch(() => undefined)
  }, [baseUrl, fetcher, id, queryClient])

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    reply.mutate({
      channelAccountId: String(form.get("channelAccountId")),
      text: String(form.get("text")),
    })
    event.currentTarget.reset()
  }
  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    note.mutate(String(form.get("body")))
    event.currentTarget.reset()
  }
  if (!detail.data)
    return (
      <main className="p-6">{detail.error ? String(detail.error) : "Loading conversation…"}</main>
    )
  const conversation = detail.data.conversation
  const error = reply.error ?? note.error ?? update.error
  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{conversation.subject ?? "No subject"}</h1>
        <p className="text-sm text-muted-foreground">{conversation.customerAddress}</p>
      </header>
      <section className="flex flex-wrap gap-3" aria-label="Conversation routing">
        <select
          aria-label="Inbox"
          value={conversation.inboxId ?? ""}
          onChange={(event) =>
            update.mutate({ revision: conversation.revision, inboxId: event.target.value })
          }
        >
          {(inboxes.data ?? []).map((inbox) => (
            <option key={inbox.id} value={inbox.id}>
              {inbox.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={conversation.status}
          onChange={(event) =>
            update.mutate({
              revision: conversation.revision,
              status: event.target.value as typeof conversation.status,
            })
          }
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <div className="flex items-center gap-2 text-sm">
          <span>Snooze until</span>
          <DateTimePicker
            placeholder="Snooze until"
            onChange={(value) => {
              if (!value) return
              update.mutate({
                revision: conversation.revision,
                status: "snoozed",
                snoozedUntil: new Date(value).toISOString(),
              })
            }}
          />
        </div>
        <select
          aria-label="Priority"
          value={conversation.priority}
          onChange={(event) =>
            update.mutate({
              revision: conversation.revision,
              priority: event.target.value as typeof conversation.priority,
            })
          }
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select
          aria-label="Assignee"
          value={conversation.assignedToUserId ?? ""}
          onChange={(event) =>
            update.mutate({
              revision: conversation.revision,
              assignedToUserId: event.target.value || null,
            })
          }
        >
          <option value="">Unassigned</option>
          {(assignees.data ?? []).map((staff) => (
            <option key={staff.userId} value={staff.userId}>
              {staff.displayName}
            </option>
          ))}
        </select>
      </section>
      <ol className="space-y-3" aria-label="Conversation timeline">
        {detail.data.timeline.map((item) => {
          if (item.kind === "part")
            return (
              <li
                key={item.id}
                className={`max-w-2xl rounded-md border p-4 ${item.part.direction === "outbound" ? "ml-auto bg-muted/40" : ""}`}
              >
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>{item.part.senderAddress}</span>
                  <span>
                    {item.part.classification === "message"
                      ? item.part.deliveryStatus
                      : item.part.classification}
                  </span>
                </div>
                {item.part.contentStatus === "redacted" ? (
                  <p className="italic text-muted-foreground">Content redacted</p>
                ) : item.part.textBody ? (
                  <p className="whitespace-pre-wrap">{item.part.textBody}</p>
                ) : item.part.htmlBody ? (
                  <SafeConversationHtml html={item.part.htmlBody} />
                ) : (
                  <p className="italic text-muted-foreground">No message body</p>
                )}
                {item.part.attachments.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t pt-3">
                    {item.part.attachments.map((attachment) => (
                      <li key={attachment.id} className="text-sm">
                        {attachment.scanStatus === "clean" &&
                        attachment.availability === "active" ? (
                          <a
                            className="underline"
                            href={`${baseUrl}/v1/admin/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachment.id)}/download`}
                          >
                            {attachment.filename}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            {attachment.filename} ({attachmentStatusLabel(attachment)})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          if (item.kind === "note")
            return (
              <li
                key={item.id}
                className="max-w-2xl rounded-md border border-dashed bg-amber-50 p-4"
              >
                <div className="mb-2 text-xs text-muted-foreground">
                  Internal note · {item.note.authorUserId}
                </div>
                <p className="whitespace-pre-wrap">{item.note.body}</p>
              </li>
            )
          return (
            <li key={item.id} className="text-center text-xs text-muted-foreground">
              {item.event.type} · revision {item.event.revision}
            </li>
          )
        })}
      </ol>
      {detail.data.parts.at(-1)?.replyable === false ? (
        <p className="text-sm text-muted-foreground">
          This system-generated item is quarantined and cannot be replied to.
        </p>
      ) : (
        <form className="grid max-w-2xl gap-3" onSubmit={submitReply}>
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
        </form>
      )}
      <form className="grid max-w-2xl gap-3" onSubmit={submitNote}>
        <textarea
          required
          name="body"
          placeholder="Internal note"
          className="min-h-20 rounded border border-dashed p-2"
        />
        <button className="justify-self-start rounded border px-4 py-2" type="submit">
          Add note
        </button>
      </form>
      {error ? (
        <p role="alert">
          {String(error).includes("conversation_conflict")
            ? "This conversation changed. Reload it before retrying."
            : String(error)}{" "}
          <button type="button" className="underline" onClick={() => detail.refetch()}>
            Reload
          </button>
        </p>
      ) : null}
    </main>
  )
}

/** HTML reaches this component only after the Conversations server sanitizer. */
function SafeConversationHtml({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm max-w-none break-words"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: server-owned sanitizer is the only persistence boundary.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function attachmentStatusLabel(attachment: InboxPart["attachments"][number]) {
  if (attachment.availability === "redacted") return "redacted"
  if (attachment.availability === "redaction_pending") return "redaction pending"
  if (attachment.scanStatus === "pending") return "scanning"
  if (attachment.scanStatus === "blocked") return "blocked"
  return "unavailable"
}
