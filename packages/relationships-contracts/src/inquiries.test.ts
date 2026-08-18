import { describe, expect, it } from "vitest"

import { INQUIRY_DETAIL_DESTINATION, inquiryDetailPathTemplate } from "./inquiry-navigation.js"
import {
  assignInquirySchema,
  attachInquiryAssetSchema,
  closeInquirySchema,
  convertInquiryToProposalSchema,
  createInquirySchema,
  createPublicInquirySchema,
  inquiryAttachmentRecordSchema,
  inquiryListQuerySchema,
  inquiryRecordSchema,
  inquiryTargetRecordSchema,
  inquiryTravelBriefV1Schema,
  publicInquiryReceiptSchema,
} from "./validation.js"

describe("Inquiry contracts", () => {
  const base = {
    subject: "Anniversary trip",
    kind: "custom_trip" as const,
    contactSnapshot: { email: "traveler@example.com" },
    source: "phone" as const,
  }

  it("owns the import-cheap semantic detail destination", () => {
    expect(INQUIRY_DETAIL_DESTINATION).toBe("inquiry.detail")
    expect(inquiryDetailPathTemplate("/solicitari/")).toBe("/solicitari/{inquiryId}")
  })

  it("applies safe defaults to admin capture", () => {
    const parsed = createInquirySchema.parse({
      ...base,
      firstResponseDueAt: "2099-01-01T00:00:00.000Z",
    })
    expect(parsed).toMatchObject({
      priority: "normal",
      tags: [],
      customFields: {},
    })
    expect(parsed).not.toHaveProperty("firstResponseDueAt")
  })

  it("requires at least one submitted contact detail", () => {
    expect(createInquirySchema.safeParse({ ...base, contactSnapshot: {} }).success).toBe(false)
  })

  it("validates the versioned partial travel brief", () => {
    expect(
      inquiryTravelBriefV1Schema.parse({
        version: 1,
        destinations: [{ label: "Kyoto" }],
        dateFlexibility: "few_weeks",
        budget: { currency: "EUR", flexibility: "approximate" },
      }),
    ).toMatchObject({ version: 1, destinations: [{ label: "Kyoto" }] })
  })

  it("requires an explanation when clearing assignment", () => {
    expect(assignInquirySchema.safeParse({ ownerId: null }).success).toBe(false)
    expect(
      assignInquirySchema.safeParse({ ownerId: null, unassignedReason: "Awaiting triage" }).success,
    ).toBe(true)
  })

  it("requires outcome-specific close evidence", () => {
    expect(closeInquirySchema.safeParse({ outcome: "duplicate" }).success).toBe(false)
    expect(closeInquirySchema.safeParse({ outcome: "other" }).success).toBe(false)
    expect(closeInquirySchema.safeParse({ outcome: "spam" }).success).toBe(true)
  })

  it("requires a persisted idempotency key for Proposal conversion", () => {
    expect(
      convertInquiryToProposalSchema.parse({ kind: "proposal", idempotencyKey: "proposal-alt-1" }),
    ).toEqual({
      kind: "proposal",
      idempotencyKey: "proposal-alt-1",
      keepInquiryOpen: false,
    })
    expect(
      convertInquiryToProposalSchema.safeParse({ kind: "proposal", idempotencyKey: " " }).success,
    ).toBe(false)
  })

  it("accepts canonical work-queue views and composes explicit filters", () => {
    expect(inquiryListQuerySchema.parse({})).toMatchObject({
      view: "actionable",
      limit: 50,
      offset: 0,
    })
    expect(inquiryListQuerySchema.parse({ view: "mine", status: "in_progress" })).toMatchObject({
      view: "mine",
      status: "in_progress",
      limit: 50,
      offset: 0,
    })
    expect(inquiryListQuerySchema.safeParse({ view: "mailbox" }).success).toBe(false)
  })

  it("owns the serialized Inquiry record contract", () => {
    expect(
      inquiryRecordSchema.safeParse({
        id: "inq_1",
        subject: "Anniversary trip",
        kind: "custom_trip",
        status: "new",
        closeOutcome: null,
        closeNote: null,
        duplicateOfInquiryId: null,
        priority: "normal",
        personId: null,
        organizationId: null,
        contactSnapshot: { email: "traveler@example.com" },
        ownerId: null,
        teamId: null,
        unassignedReason: null,
        nextActionAt: null,
        firstResponseDueAt: null,
        firstRespondedAt: null,
        travelBrief: null,
        customerMessage: null,
        internalSummary: null,
        source: "admin",
        sourceRef: null,
        sourceUrl: null,
        locale: null,
        consentSnapshot: null,
        tags: [],
        customFields: {},
        lastActivityAt: null,
        qualifiedAt: null,
        convertedAt: null,
        closedAt: null,
        privacyErasedAt: null,
        privacyErasedBy: null,
        privacyErasureReason: null,
        createdAt: "2026-08-18T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
        targets: [],
        attachments: [],
      }).success,
    ).toBe(true)
  })

  it("owns immutable cross-module target snapshots", () => {
    expect(
      inquiryTargetRecordSchema.parse({
        linkId: "link_1",
        inquiryId: "inq_1",
        kind: "option_unit",
        targetId: "avsl_1",
        snapshot: {
          title: "Danube cruise",
          optionLabel: "12 September",
          startDate: "2026-09-12",
          endDate: "2026-09-19",
          sourceChannel: "storefront-web",
        },
        createdAt: "2026-08-18T00:00:00.000Z",
      }),
    ).toMatchObject({ kind: "option_unit", targetId: "avsl_1" })
  })

  it("does not accept caller-supplied attachment file metadata", () => {
    expect(
      attachInquiryAssetSchema.safeParse({
        assetId: "mast_01k00000000000000000000000",
        caption: "Passport scan",
        name: "spoofed.pdf",
        mimeType: "application/pdf",
        storageKey: "documents/private.pdf",
        publicUrl: "https://cdn.example/private.pdf",
      }).success,
    ).toBe(false)
    expect(
      attachInquiryAssetSchema.parse({
        assetId: "mast_01k00000000000000000000000",
        caption: "Passport scan",
      }),
    ).toEqual({
      assetId: "mast_01k00000000000000000000000",
      caption: "Passport scan",
    })
    expect(
      inquiryAttachmentRecordSchema.safeParse({
        linkId: "lnk_1",
        inquiryId: "inq_1",
        assetId: "mast_01k00000000000000000000000",
        name: "passport.pdf",
        mimeType: "application/pdf",
        caption: null,
        attachedBy: "user_1",
        createdAt: "2026-08-18T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
        downloadPath: "/v1/admin/relationships/inquiries/inq_1/attachments/lnk_1/download",
        storageKey: "documents/private.pdf",
      }).success,
    ).toBe(false)
  })

  it("keeps public intake source-controlled and returns an idempotent receipt", () => {
    expect(
      createPublicInquirySchema.safeParse({
        sourceRef: "submission-spoofed",
        subject: "Question about Kyoto",
        kind: "product",
        contactSnapshot: { email: "traveler@example.com" },
        targets: [
          {
            kind: "product",
            targetId: "prod_1",
            snapshot: {
              title: "Kyoto discovery",
              sourceChannel: "spoofed-channel",
              publicUrl: "https://travel.example/cruises/1",
            },
          },
        ],
      }).success,
    ).toBe(false)
    const intake = createPublicInquirySchema.parse({
      sourceRef: "submission-1",
      subject: "Question about Kyoto",
      kind: "product",
      contactSnapshot: { email: "traveler@example.com" },
      personId: "per_body_override",
      targets: [
        {
          kind: "product",
          targetId: "prod_1",
          snapshot: { title: "Kyoto discovery" },
        },
      ],
    })
    expect(intake.targets).toHaveLength(1)
    expect(intake.targets[0]?.snapshot).not.toHaveProperty("sourceChannel")
    expect("source" in intake).toBe(false)
    expect("personId" in intake).toBe(false)
    expect(
      publicInquiryReceiptSchema.safeParse({
        data: {
          inquiryId: "inq_1",
          status: "new",
          duplicate: true,
          receivedAt: "2026-08-18T00:00:00.000Z",
        },
      }).success,
    ).toBe(true)
  })

  it("accepts targetless custom intake but requires a Product target for product intake", () => {
    expect(
      createPublicInquirySchema.safeParse({
        sourceRef: "custom-1",
        subject: "Design a custom trip",
        kind: "custom_trip",
        contactSnapshot: { phone: "+40 700 000 000" },
      }).success,
    ).toBe(true)
    expect(
      createPublicInquirySchema.safeParse({
        sourceRef: "product-1",
        subject: "Product question without a product",
        kind: "product",
        contactSnapshot: { email: "traveler@example.com" },
      }).success,
    ).toBe(false)
    expect(
      createPublicInquirySchema.safeParse({
        sourceRef: "unsupported-1",
        subject: "Unsupported public target",
        kind: "general",
        contactSnapshot: { email: "traveler@example.com" },
        targets: [{ kind: "trip", targetId: "trpe_1", snapshot: { title: "Draft" } }],
      }).success,
    ).toBe(false)
  })

  it("rejects duplicate public target references", () => {
    const target = {
      kind: "product" as const,
      targetId: "prod_1",
      snapshot: { title: "Kyoto discovery" },
    }
    expect(
      createPublicInquirySchema.safeParse({
        sourceRef: "duplicate-targets-1",
        subject: "Duplicate targets",
        kind: "product",
        contactSnapshot: { email: "traveler@example.com" },
        targets: [target, target],
      }).success,
    ).toBe(false)
  })
})
