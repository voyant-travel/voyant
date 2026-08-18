import { describe, expect, it } from "vitest"

import {
  buildPersonConversationStartRequest,
  selectConversationComposerOptions,
} from "./use-person-conversation-composer.js"

const contact = { id: "contact_1", kind: "email", value: "guest@example.test", isPrimary: true }
const account = {
  id: "account_1",
  channel: "email",
  displayAddress: "hello@example.test",
  displayName: "Hello",
  lifecycle: "active",
  health: "healthy",
  outboundCapable: true,
}
const inboxes = [{ id: "inbox_1", isDefault: true }]

describe("Person conversation composer capability selection", () => {
  it("offers only active healthy outbound-capable account/contact pairs", () => {
    expect(selectConversationComposerOptions([account], [contact], inboxes)).toHaveLength(1)
    expect(
      selectConversationComposerOptions(
        [
          { ...account, id: "disabled", lifecycle: "disabled" },
          { ...account, id: "unavailable", health: "unavailable" },
          { ...account, id: "inbound", outboundCapable: false },
        ],
        [contact],
        inboxes,
      ),
    ).toEqual([])
  })

  it("offers SMS with exact channel semantics when an Inbox is writable", () => {
    const smsAccount = { ...account, channel: "sms", displayAddress: "+12025550100" }
    const phone = { ...contact, kind: "mobile", value: "+12025550101" }
    expect(selectConversationComposerOptions([smsAccount], [phone], [])).toEqual([])
    expect(selectConversationComposerOptions([smsAccount], [phone], inboxes)).toEqual([
      expect.objectContaining({
        channel: "sms",
        contact: phone,
        account: smsAccount,
        inboxId: "inbox_1",
      }),
    ])
  })

  it("builds exact discriminated email and SMS start requests", () => {
    const [email] = selectConversationComposerOptions([account], [contact], inboxes)
    expect(
      buildPersonConversationStartRequest(
        "person_1",
        { option: email!, subject: "Hello", text: "Email body" },
        "email-key",
      ),
    ).toMatchObject({
      channel: "email",
      inboxId: "inbox_1",
      fromAddress: "hello@example.test",
      subject: "Hello",
    })
    const [sms] = selectConversationComposerOptions(
      [{ ...account, channel: "sms", displayAddress: "+12025550100" }],
      [{ ...contact, kind: "mobile", value: "+12025550101" }],
      inboxes,
    )
    const request = buildPersonConversationStartRequest(
      "person_1",
      { option: sms!, subject: "ignored", text: "SMS body" },
      "sms-key",
    )
    expect(request).toMatchObject({ channel: "sms", inboxId: "inbox_1", subject: null })
    expect(request).not.toHaveProperty("fromAddress")
  })
})
