import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getVoyantCloudClient: vi.fn(),
  sendMessage: vi.fn(async (_message: { html: string }) => ({ id: "message-1" })),
}))

vi.mock("@voyant-travel/cloud-sdk", () => ({
  getVoyantCloudClient: mocks.getVoyantCloudClient,
}))

import { resolveVoyantCloudAuthEmailSender } from "./index.js"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getVoyantCloudClient.mockReturnValue({ email: { sendMessage: mocks.sendMessage } })
})

describe("Operator cloud auth email", () => {
  it("stays disabled when no cloud API key is configured", () => {
    expect(resolveVoyantCloudAuthEmailSender({})).toBeNull()
    expect(resolveVoyantCloudAuthEmailSender({ VOYANT_API_KEY: "local-dev" })).toBeNull()
    expect(mocks.getVoyantCloudClient).not.toHaveBeenCalled()
  })

  it("sends password reset and verification messages through Voyant Cloud", async () => {
    const sender = resolveVoyantCloudAuthEmailSender({
      VOYANT_API_KEY: "vc_test",
      VOYANT_CLOUD_API_URL: "https://cloud.example.test",
      VOYANT_CLOUD_USER_AGENT: "operator-test",
      EMAIL_FROM: "Support <support@example.test>",
      EMAIL_REPLY_TO: "help@example.test, owner@example.test",
    })

    expect(mocks.getVoyantCloudClient).toHaveBeenCalledWith(
      {
        VOYANT_CLOUD_API_KEY: "vc_test",
        VOYANT_CLOUD_API_URL: "https://cloud.example.test",
        VOYANT_CLOUD_USER_AGENT: "operator-test",
      },
      { apiKey: "vc_test" },
    )
    await sender?.sendResetPassword({
      user: { email: "ana@example.test", name: "Ana <Admin>" },
      url: "https://operator.example.test/reset?token=a&next=/admin",
    })
    await sender?.sendVerificationOtp({
      email: "ana@example.test",
      otp: "123456",
      type: "email-verification",
    })

    expect(mocks.sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        from: "Support <support@example.test>",
        to: ["ana@example.test"],
        replyTo: ["help@example.test", "owner@example.test"],
        subject: "Reset your password",
        html: expect.stringContaining("Ana &lt;Admin&gt;"),
      }),
    )
    expect(mocks.sendMessage.mock.calls[0]?.[0]?.html).toContain("token=a&amp;next=/admin")
    expect(mocks.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        from: "Support <support@example.test>",
        to: ["ana@example.test"],
        replyTo: ["help@example.test", "owner@example.test"],
        subject: "Verify your email",
        html: expect.stringContaining("<strong>123456</strong>"),
      }),
    )
  })

  it("uses the standard sender and generic OTP subject defaults", async () => {
    const sender = resolveVoyantCloudAuthEmailSender({ VOYANT_API_KEY: "vc_other" })
    await sender?.sendVerificationOtp({
      email: "user@example.test",
      otp: "654321",
      type: "sign-in",
    })

    expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Voyant <noreply@voyantcloud.app>",
        subject: "Your verification code",
      }),
    )
  })
})
