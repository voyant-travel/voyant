import { describe, expect, it } from "vitest"
import {
  assertAttachmentSetPolicy,
  assertDetectedAttachmentMetadata,
  CONVERSATION_ATTACHMENT_LIMITS,
  ConversationAttachmentPolicyError,
  normalizeAttachmentMetadata,
  sanitizeConversationHtml,
} from "../../src/content-security.js"

describe("conversation content security", () => {
  it("removes executable, tracking, style, form, and remote image markup", () => {
    const html = sanitizeConversationHtml(`
      <style>body { display: none }</style>
      <script>alert(1)</script>
      <img src="https://tracker.invalid/pixel" onerror="alert(2)">
      <form action="https://invalid"><input name="secret"></form>
      <p style="background:url(https://tracker.invalid)">Hello</p>
      <a href="javascript:alert(3)" onclick="alert(4)">bad</a>
      <a href="https://example.test/path">safe</a>
      <a href="tel:+40123456789">call</a>
    `)
    expect(html).not.toMatch(/script|style=|<style|<img|<form|<input|javascript:|onclick/i)
    expect(html).toContain('href="https://example.test/path"')
    expect(html).toContain('href="tel:+40123456789"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it("normalizes filenames and rejects active types and extension/type mismatches", () => {
    expect(
      normalizeAttachmentMetadata({
        filename: "../invoice.pdf",
        contentType: "application/pdf; charset=binary",
        sizeBytes: 50,
      }),
    ).toEqual({ filename: ".._invoice.pdf", contentType: "application/pdf", sizeBytes: 50 })
    expect(() =>
      normalizeAttachmentMetadata({
        filename: "invoice.pdf",
        contentType: "text/html",
        sizeBytes: 50,
      }),
    ).toThrow(ConversationAttachmentPolicyError)
    expect(() =>
      normalizeAttachmentMetadata({
        filename: "invoice.pdf",
        contentType: "image/png",
        sizeBytes: 50,
      }),
    ).toThrow("extension and content type disagree")
  })

  it("rejects scanner drift and aggregate limit overflow", () => {
    expect(() =>
      assertDetectedAttachmentMetadata({
        filename: "invoice.pdf",
        declaredContentType: "application/pdf",
        declaredSizeBytes: 10,
        detectedContentType: "application/pdf",
        detectedSizeBytes: 11,
      }),
    ).toThrow("size does not match")
    expect(() =>
      assertAttachmentSetPolicy(
        Array.from({ length: CONVERSATION_ATTACHMENT_LIMITS.maxCount + 1 }, () => ({
          filename: "invoice.pdf",
          contentType: "application/pdf",
          sizeBytes: 1,
        })),
      ),
    ).toThrow("Too many attachments")
  })
})
