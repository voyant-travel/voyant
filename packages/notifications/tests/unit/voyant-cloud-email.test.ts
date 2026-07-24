import { describe, expect, it, vi } from "vitest"

import { createVoyantCloudEmailProvider } from "../../src/providers/voyant-cloud-email.js"

function makeFakeClient(emailResponse: Record<string, unknown>) {
  const sendMessage = vi.fn(async () => emailResponse)
  return {
    sendMessage,
    client: { email: { sendMessage } } as Parameters<
      typeof createVoyantCloudEmailProvider
    >[0]["client"],
  }
}

describe("createVoyantCloudEmailProvider", () => {
  it("delegates to the cloud client's email.sendMessage", async () => {
    const { sendMessage, client } = makeFakeClient({ id: "em_42" })

    const provider = createVoyantCloudEmailProvider({
      client,
      from: "noreply@example.com",
      renderTemplate: () => ({
        subject: "Hello",
        html: "<p>Hi</p>",
        text: "Hi",
      }),
    })

    expect(provider.defaultFromAddress).toBe("noreply@example.com")
    expect(provider.durableDelivery).toMatchObject({ supported: false })

    const result = await provider.send({
      to: "traveler@example.com",
      channel: "email",
      template: "welcome",
    })

    expect(sendMessage).toHaveBeenCalledWith({
      from: "noreply@example.com",
      to: ["traveler@example.com"],
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    })
    expect(result).toEqual({ id: "em_42", provider: "voyant-cloud-email" })
  })

  it("falls back to template + JSON-stringified data when no renderer is set", async () => {
    const { sendMessage, client } = makeFakeClient({ id: "em_43" })

    const provider = createVoyantCloudEmailProvider({
      client,
      from: "noreply@example.com",
    })

    await provider.send({
      to: "x@example.com",
      channel: "email",
      template: "welcome",
      data: { name: "Mihai" },
    })

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "welcome",
        text: '{"name":"Mihai"}',
      }),
    )
  })

  it("payload subject/from/replyTo override defaults", async () => {
    const { sendMessage, client } = makeFakeClient({ id: "em_44" })

    const provider = createVoyantCloudEmailProvider({
      client,
      from: "noreply@example.com",
      replyTo: ["support@example.com"],
    })

    await provider.send({
      to: "x@example.com",
      channel: "email",
      template: "welcome",
      from: "ops@example.com",
      subject: "Override",
      html: "<b>Body</b>",
    })

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "ops@example.com",
        subject: "Override",
        html: "<b>Body</b>",
        replyTo: ["support@example.com"],
      }),
    )
  })

  it("forwards email attachments to the cloud client", async () => {
    const { sendMessage, client } = makeFakeClient({ id: "em_46" })

    const provider = createVoyantCloudEmailProvider({
      client,
      from: "noreply@example.com",
    })

    await provider.send({
      to: "x@example.com",
      channel: "email",
      template: "welcome",
      subject: "Documents",
      attachments: [
        {
          filename: "contract.pdf",
          path: "https://cdn.example.com/contract.pdf",
          contentType: "application/pdf",
        },
        {
          filename: "terms.txt",
          contentBase64: "SGVsbG8=",
          contentId: "terms",
        },
      ],
    })

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: "contract.pdf",
            path: "https://cdn.example.com/contract.pdf",
            contentType: "application/pdf",
          },
          {
            filename: "terms.txt",
            content: "SGVsbG8=",
            contentId: "terms",
          },
        ],
      }),
    )
  })

  it("rejects non-email payloads", async () => {
    const { client } = makeFakeClient({ id: "em_45" })

    const provider = createVoyantCloudEmailProvider({
      client,
      from: "noreply@example.com",
    })

    await expect(
      provider.send({
        to: "+40123",
        channel: "sms",
        template: "x",
      }),
    ).rejects.toThrow(/only supports the "email" channel/)
  })

  it("rejects email sends when no sender is configured", async () => {
    const { sendMessage, client } = makeFakeClient({ id: "em_47" })

    const provider = createVoyantCloudEmailProvider({
      client,
      from: " ",
    })

    await expect(
      provider.send({
        to: "x@example.com",
        channel: "email",
        template: "welcome",
      }),
    ).rejects.toThrow(/requires a sender address/)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
