"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"

const contactPoint = z.object({
  id: z.string(),
  kind: z.string(),
  value: z.string(),
  isPrimary: z.boolean(),
})
const channelAccount = z.object({
  id: z.string(),
  channel: z.string(),
  displayAddress: z.string(),
  displayName: z.string(),
  lifecycle: z.string(),
  health: z.string(),
  outboundCapable: z.boolean(),
})
const contactsResponse = z.object({ data: z.array(contactPoint) })
const accountsResponse = z.object({ data: z.array(channelAccount) })
const inboxesResponse = z.object({
  data: z.array(z.object({ id: z.string(), isDefault: z.boolean() })),
})
const startedConversationResponse = z.object({
  data: z.object({ conversation: z.object({ id: z.string() }) }),
})

export type PersonComposerContact = z.infer<typeof contactPoint>
export type PersonComposerChannelAccount = z.infer<typeof channelAccount>

export interface PersonComposerOption {
  channel: "email" | "sms"
  contact: PersonComposerContact
  account: PersonComposerChannelAccount
  inboxId: string
}

/** Pure capability gate, exported so unavailable combinations stay regression-tested. */
export function selectConversationComposerOptions(
  accounts: readonly PersonComposerChannelAccount[],
  contacts: readonly PersonComposerContact[],
  inboxes: readonly { id: string; isDefault: boolean }[],
  supportedChannels: readonly ("email" | "sms")[] = ["email", "sms"],
): PersonComposerOption[] {
  const inboxId = inboxes.find((inbox) => inbox.isDefault)?.id ?? inboxes[0]?.id
  if (!inboxId) return []
  const supported = new Set(supportedChannels)
  const usableAccounts = accounts.filter(
    (account) =>
      (account.channel === "email" || account.channel === "sms") &&
      supported.has(account.channel) &&
      account.lifecycle === "active" &&
      account.health !== "unavailable" &&
      account.outboundCapable,
  )
  return usableAccounts.flatMap((account) => {
    const channel = account.channel as "email" | "sms"
    const allowedKinds = channel === "email" ? ["email"] : ["phone", "mobile", "sms"]
    return contacts
      .filter((contact) => allowedKinds.includes(contact.kind) && contact.value.trim().length > 0)
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
      .map((contact) => ({ channel, contact, account, inboxId }))
  })
}

export function buildPersonConversationStartRequest(
  personId: string,
  input: { option: PersonComposerOption; subject: string | null; text: string },
  idempotencyKey: string,
) {
  const base = {
    inboxId: input.option.inboxId,
    personRef: personId,
    contactPointRef: input.option.contact.id,
    channelAccountId: input.option.account.id,
    channel: input.option.channel,
    text: input.text,
    idempotencyKey,
  }
  return input.option.channel === "email"
    ? {
        ...base,
        channel: "email" as const,
        fromAddress: input.option.account.displayAddress,
        subject: input.subject,
      }
    : { ...base, channel: "sms" as const, subject: null }
}

export function usePersonConversationComposer(personId: string | undefined, canWrite: boolean) {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: [...relationshipsQueryKeys.person(personId ?? ""), "conversation-composer"],
    enabled: Boolean(personId) && canWrite,
    queryFn: async () => {
      if (!personId) throw new Error("usePersonConversationComposer requires a personId")
      const [contacts, accounts, inboxes] = await Promise.all([
        fetchWithValidation(
          `/v1/admin/relationships/people/${personId}/contact-methods`,
          contactsResponse,
          { baseUrl, fetcher },
        ),
        fetchWithValidation("/v1/admin/notifications/channel-accounts", accountsResponse, {
          baseUrl,
          fetcher,
        }),
        fetchWithValidation("/v1/admin/conversation-inboxes", inboxesResponse, {
          baseUrl,
          fetcher,
        }),
      ])
      return selectConversationComposerOptions(accounts.data, contacts.data, inboxes.data)
    },
  })
  const start = useMutation({
    mutationFn: async (input: {
      option: PersonComposerOption
      subject: string | null
      text: string
    }) => {
      if (!personId) throw new Error("usePersonConversationComposer requires a personId")
      return fetchWithValidation(
        "/v1/admin/conversations",
        startedConversationResponse,
        {
          baseUrl,
          fetcher,
        },
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildPersonConversationStartRequest(personId, input, crypto.randomUUID()),
          ),
        },
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...relationshipsQueryKeys.person(personId ?? ""), "communications"],
      })
    },
  })
  return { ...query, start }
}
