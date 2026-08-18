import type { VoyantFetcher } from "@voyant-travel/react"
import type {
  AssignableStaff,
  ConversationInbox,
  InboxConversation,
  InboxConversationDetail,
  InboxConversationPage,
  InboxNote,
  InboxOperationalReport,
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
  async list(
    fetcher: VoyantFetcher,
    baseUrl: string,
    filters: Record<string, string | boolean | undefined> = {},
  ): Promise<InboxConversationPage> {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") query.set(key, String(value))
    }
    const response = await fetcher(`${baseUrl}/v1/admin/conversations?${query}`)
    const payload = (await response.json()) as InboxConversationPage & { error?: string }
    if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`)
    return payload
  },
  bulk(
    fetcher: VoyantFetcher,
    baseUrl: string,
    input: {
      items: Array<{ id: string; revision: number }>
      changes: { assignedToUserId?: string | null; status?: InboxConversation["status"] }
    },
  ) {
    return request<InboxConversation[]>(fetcher, `${baseUrl}/v1/admin/conversations/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })
  },
  reporting(fetcher: VoyantFetcher, baseUrl: string, from: string, to: string) {
    const query = new URLSearchParams({ from, to })
    return request<InboxOperationalReport>(
      fetcher,
      `${baseUrl}/v1/admin/conversations/reporting?${query}`,
    )
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
      text: string
      idempotencyKey: string
    } & (
      | { channel: "email"; fromAddress: string; subject: string | null }
      | { channel: "sms"; subject?: null }
    ),
  ) {
    return request<InboxConversationDetail>(fetcher, `${baseUrl}/v1/admin/conversations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })
  },
}
