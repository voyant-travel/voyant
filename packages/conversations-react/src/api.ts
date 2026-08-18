import type { VoyantFetcher } from "@voyant-travel/react"
import type {
  AssignableStaff,
  ConversationInbox,
  InboxConversation,
  InboxConversationDetail,
  InboxNote,
  InboxPart,
} from "./types.js"

async function request<T>(fetcher: VoyantFetcher, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, init)
  const payload = (await response.json()) as { data?: T; error?: string }
  if (!response.ok || payload.data === undefined)
    throw new Error(payload.error ?? `Request failed (${response.status})`)
  return payload.data
}

export const conversationsApi = {
  list(fetcher: VoyantFetcher, baseUrl: string, filters: { inboxId?: string } = {}) {
    const query = filters.inboxId ? `?inboxId=${encodeURIComponent(filters.inboxId)}` : ""
    return request<InboxConversation[]>(fetcher, `${baseUrl}/v1/admin/conversations${query}`)
  },
  get(fetcher: VoyantFetcher, baseUrl: string, id: string) {
    return request<InboxConversationDetail>(
      fetcher,
      `${baseUrl}/v1/admin/conversations/${encodeURIComponent(id)}`,
    )
  },
  markRead(fetcher: VoyantFetcher, baseUrl: string, id: string) {
    return request<InboxConversation>(
      fetcher,
      `${baseUrl}/v1/admin/conversations/${encodeURIComponent(id)}/read`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    )
  },
  note(fetcher: VoyantFetcher, baseUrl: string, id: string, revision: number, body: string) {
    return request<InboxNote>(
      fetcher,
      `${baseUrl}/v1/admin/conversations/${encodeURIComponent(id)}/notes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision, body }),
      },
    )
  },
  update(
    fetcher: VoyantFetcher,
    baseUrl: string,
    id: string,
    input: {
      revision: number
      status?: InboxConversation["status"]
      snoozedUntil?: string | null
      priority?: InboxConversation["priority"]
      assignedToUserId?: string | null
      inboxId?: string
    },
  ) {
    return request<InboxConversation>(
      fetcher,
      `${baseUrl}/v1/admin/conversations/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    )
  },
  inboxes(fetcher: VoyantFetcher, baseUrl: string) {
    return request<ConversationInbox[]>(fetcher, `${baseUrl}/v1/admin/conversation-inboxes`)
  },
  assignableStaff(fetcher: VoyantFetcher, baseUrl: string, inboxId: string) {
    return request<AssignableStaff[]>(
      fetcher,
      `${baseUrl}/v1/admin/conversation-inboxes/${encodeURIComponent(inboxId)}/assignable-staff`,
    )
  },
  reply(
    fetcher: VoyantFetcher,
    baseUrl: string,
    id: string,
    input: {
      channelAccountId: string
      text: string
      html?: string | null
      attachmentIds?: string[]
      idempotencyKey: string
    },
  ) {
    return request<InboxPart>(
      fetcher,
      `${baseUrl}/v1/admin/conversations/${encodeURIComponent(id)}/replies`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    )
  },
  start(
    fetcher: VoyantFetcher,
    baseUrl: string,
    input: {
      inboxId: string
      personRef: string
      contactPointRef: string
      channelAccountId: string
      fromAddress: string
      subject: string | null
      text: string
      idempotencyKey: string
    },
  ) {
    return request<InboxConversationDetail>(fetcher, `${baseUrl}/v1/admin/conversations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })
  },
}
