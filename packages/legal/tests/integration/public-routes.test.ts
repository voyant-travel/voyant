import { createEventBus } from "@voyantjs/core"
import type { StorageProvider, StorageUploadBody } from "@voyantjs/storage"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { contractsPublicRoutes, createContractsAdminRoutes } from "../../src/contracts/routes.js"
import {
  contractAttachments,
  contracts,
  contractTemplates,
  contractTemplateVersions,
} from "../../src/contracts/schema.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("Legal public routes", () => {
  let adminApp: Hono
  let publicApp: Hono
  let db: PostgresJsDatabase
  let generatedNames: string[]
  let documentEvents: Array<Record<string, unknown>>
  let uploadedObjects: Array<{ key: string; size: number; contentType: string | null }>
  let lifecycleEvents: Array<Record<string, unknown>>

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    adminApp = new Hono()
    adminApp.use("*", async (c, next) => {
      c.set("db" as never, db)
      await next()
    })
    const eventBus = createEventBus()
    documentEvents = []
    eventBus.subscribe("contract.document.generated", (event) => {
      documentEvents.push(event as Record<string, unknown>)
    })
    uploadedObjects = []
    const documentStorage: StorageProvider = {
      name: "legal-test-storage",
      async upload(body: StorageUploadBody, options = {}) {
        const key = options.key ?? `contracts/test/${uploadedObjects.length + 1}`
        const size =
          body instanceof Blob
            ? body.size
            : body instanceof Uint8Array
              ? body.byteLength
              : body.byteLength
        uploadedObjects.push({ key, size, contentType: options.contentType ?? null })
        return { key, url: `https://cdn.example.com/${key}` }
      },
      async delete() {},
      async signedUrl(key: string) {
        return `https://signed.example.com/${key}`
      },
      async get() {
        return null
      },
    }
    lifecycleEvents = []
    for (const eventName of [
      "contract.issued",
      "contract.sent",
      "contract.signed",
      "contract.executed",
      "contract.voided",
    ]) {
      eventBus.subscribe(eventName, (event) => {
        lifecycleEvents.push(event as Record<string, unknown>)
      })
    }
    adminApp.route(
      "/",
      createContractsAdminRoutes({
        eventBus,
        documentStorage,
        resolveDocumentDownloadUrl: (_bindings, storageKey) =>
          `https://signed.example.com/${storageKey}`,
        documentGenerator: async ({ contract }) => {
          const name = `contract-${generatedNames.length + 1}.pdf`
          generatedNames.push(name)
          return {
            kind: "document",
            name,
            mimeType: "application/pdf",
            fileSize: 1024,
            storageKey: `contracts/${contract.id}/${name}`,
            metadata: {
              source: "legal-test",
              url: `https://cdn.example.com/contracts/${contract.id}/${name}`,
            },
          }
        },
      }),
    )

    publicApp = new Hono()
    publicApp.use("*", async (c, next) => {
      c.set("db" as never, db)
      await next()
    })
    publicApp.route("/", contractsPublicRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
    generatedNames = []
    documentEvents = []
    uploadedObjects = []
    lifecycleEvents = []
  })

  it("selects the default active template using language fallback order", async () => {
    await db.insert(contractTemplates).values([
      {
        name: "Customer EN",
        slug: "customer-en",
        scope: "customer",
        language: "en",
        body: "Hello {{customer.firstName}}",
        active: true,
      },
      {
        name: "Customer RO",
        slug: "customer-ro",
        scope: "customer",
        language: "ro",
        body: "Salut {{customer.firstName}}",
        active: true,
      },
    ])

    const publicRes = await publicApp.request(
      "/templates/default?scope=customer&language=de&fallbackLanguages=ro,en",
    )
    expect(publicRes.status).toBe(200)
    expect((await publicRes.json()).data.slug).toBe("customer-ro")

    const adminRes = await adminApp.request(
      "/templates/default?scope=customer&language=de&fallbackLanguages=en",
    )
    expect(adminRes.status).toBe(200)
    expect((await adminRes.json()).data.slug).toBe("customer-en")
  })

  it("selects explicit channel defaults before global defaults", async () => {
    await db.insert(contractTemplates).values([
      {
        name: "Global Customer RO",
        slug: "global-customer-ro",
        scope: "customer",
        language: "ro",
        body: "Global RO",
        isDefault: true,
        active: true,
      },
      {
        name: "Web Customer RO",
        slug: "web-customer-ro",
        scope: "customer",
        language: "ro",
        channelId: "channel_web",
        body: "Web RO",
        isDefault: true,
        active: true,
      },
      {
        name: "Inactive Web Customer EN",
        slug: "inactive-web-customer-en",
        scope: "customer",
        language: "en",
        channelId: "channel_web",
        body: "Inactive Web EN",
        isDefault: true,
        active: false,
      },
      {
        name: "Global Customer EN",
        slug: "global-customer-en",
        scope: "customer",
        language: "en",
        body: "Global EN",
        isDefault: true,
        active: true,
      },
    ])

    const channelRes = await publicApp.request(
      "/templates/default?scope=customer&channelId=channel_web&language=ro&fallbackLanguages=en",
    )
    expect(channelRes.status).toBe(200)
    expect((await channelRes.json()).data.slug).toBe("web-customer-ro")

    const globalRes = await publicApp.request(
      "/templates/default?scope=customer&language=ro&fallbackLanguages=en",
    )
    expect(globalRes.status).toBe(200)
    expect((await globalRes.json()).data.slug).toBe("global-customer-ro")

    const fallbackRes = await publicApp.request(
      "/templates/default?scope=customer&channelId=channel_web&language=de&fallbackLanguages=en",
    )
    expect(fallbackRes.status).toBe(200)
    expect((await fallbackRes.json()).data.slug).toBe("global-customer-en")
  })

  it("enforces one default template per scope, channel, and language", async () => {
    await db.insert(contractTemplates).values({
      name: "Default Customer EN",
      slug: "default-customer-en",
      scope: "customer",
      language: "en",
      body: "Default EN",
      isDefault: true,
      active: true,
    })

    await expect(
      db.insert(contractTemplates).values({
        name: "Duplicate Default Customer EN",
        slug: "duplicate-default-customer-en",
        scope: "customer",
        language: "en",
        body: "Duplicate default EN",
        isDefault: true,
        active: true,
      }),
    ).rejects.toThrow()

    await db.insert(contractTemplates).values({
      name: "Channel Default Customer EN",
      slug: "channel-default-customer-en",
      scope: "customer",
      language: "en",
      channelId: "channel_partner",
      body: "Channel default EN",
      isDefault: true,
      active: true,
    })
  })

  it("renders a public preview from an active template", async () => {
    const [template] = await db
      .insert(contractTemplates)
      .values({
        name: "Customer RO",
        slug: "customer-ro",
        scope: "customer",
        language: "ro",
        body: "Salut {{customer.firstName}} {{customer.lastName}}",
        active: true,
      })
      .returning()

    const res = await publicApp.request(`/templates/${template.id}/preview`, {
      method: "POST",
      ...json({
        variables: {
          customer: { firstName: "Ana", lastName: "Popescu" },
        },
      }),
    })

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({
      rendered: "Salut Ana Popescu",
    })

    const stableAliasRes = await publicApp.request(`/templates/${template.id}/render-preview`, {
      method: "POST",
      ...json({
        variables: {
          customer: { firstName: "Mara", lastName: "Ionescu" },
        },
      }),
    })

    expect(stableAliasRes.status).toBe(200)
    expect((await stableAliasRes.json()).data).toEqual({
      rendered: "Salut Mara Ionescu",
    })
  })

  it("generates and regenerates a canonical contract document attachment", async () => {
    const [template] = await db
      .insert(contractTemplates)
      .values({
        name: "Customer RO",
        slug: "customer-ro",
        scope: "customer",
        language: "ro",
        body: "Salut {{customer.firstName}}",
        active: true,
      })
      .returning()

    const [version] = await db
      .insert(contractTemplateVersions)
      .values({
        templateId: template.id,
        version: 1,
        body: "Salut {{customer.firstName}}",
      })
      .returning()

    await db
      .update(contractTemplates)
      .set({ currentVersionId: version.id })
      .where(eq(contractTemplates.id, template.id))

    const [contract] = await db
      .insert(contracts)
      .values({
        title: "Booking contract",
        scope: "customer",
        status: "draft",
        templateVersionId: version.id,
        variables: {
          customer: { firstName: "Ana" },
        },
      })
      .returning()

    const firstRes = await adminApp.request(`/${contract.id}/generate-document`, {
      method: "POST",
      ...json({}),
    })

    expect(firstRes.status).toBe(201)
    const firstBody = await firstRes.json()
    expect(firstBody.data.renderedBody).toBe("Salut Ana")
    expect(firstBody.data.attachment.name).toBe("contract-1.pdf")
    expect(firstBody.data.download).toEqual({
      url: `https://signed.example.com/${firstBody.data.attachment.storageKey}`,
      expiresAt: null,
      filename: "contract-1.pdf",
    })

    const [issuedContract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contract.id))
      .limit(1)

    expect(issuedContract?.status).toBe("issued")
    expect(issuedContract?.renderedBody).toBe("Salut Ana")

    const secondRes = await adminApp.request(`/${contract.id}/regenerate-pdf`, {
      method: "POST",
      ...json({}),
    })

    expect(secondRes.status).toBe(200)
    const secondBody = await secondRes.json()
    expect(secondBody.data.attachment.name).toBe("contract-2.pdf")
    expect(secondBody.data.download).toEqual({
      url: `https://signed.example.com/${secondBody.data.attachment.storageKey}`,
      expiresAt: null,
      filename: "contract-2.pdf",
    })

    const attachments = await db
      .select()
      .from(contractAttachments)
      .where(eq(contractAttachments.contractId, contract.id))

    expect(attachments).toHaveLength(1)
    expect(attachments[0]?.name).toBe("contract-2.pdf")
    expect(attachments[0]?.storageKey).toContain("contract-2.pdf")
    expect(documentEvents).toEqual([
      expect.objectContaining({
        name: "contract.document.generated",
        metadata: {
          category: "internal",
          source: "service",
        },
        data: expect.objectContaining({
          contractId: contract.id,
          attachmentKind: "document",
          attachmentName: "contract-1.pdf",
          regenerated: false,
        }),
      }),
      expect.objectContaining({
        name: "contract.document.generated",
        metadata: {
          category: "internal",
          source: "service",
        },
        data: expect.objectContaining({
          contractId: contract.id,
          attachmentKind: "document",
          attachmentName: "contract-2.pdf",
          regenerated: true,
        }),
      }),
    ])

    const latestAttachment = attachments[0]
    expect(latestAttachment).toBeDefined()

    const downloadRes = await adminApp.request(`/attachments/${latestAttachment?.id}/download`)
    expect(downloadRes.status).toBe(302)
    expect(downloadRes.headers.get("location")).toBe(
      `https://signed.example.com/${latestAttachment?.storageKey}`,
    )
  })

  it("attaches an uploaded stored document to a contract", async () => {
    const [contract] = await db
      .insert(contracts)
      .values({
        title: "Uploaded contract",
        scope: "customer",
        status: "issued",
      })
      .returning()

    const form = new FormData()
    form.set("name", "Signed contract.pdf")
    form.set("kind", "signed_contract")
    form.set("file", new File(["signed body"], "signed.pdf", { type: "application/pdf" }))

    const res = await adminApp.request(`/${contract.id}/attach-document`, {
      method: "POST",
      body: form,
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toMatchObject({
      contractId: contract.id,
      kind: "signed_contract",
      name: "Signed contract.pdf",
      mimeType: "application/pdf",
      fileSize: 11,
      checksum: expect.stringMatching(/^sha256:/),
    })
    expect(body.data.storageKey).toContain(`contracts/${contract.id}/attachments/`)
    expect(uploadedObjects).toEqual([
      expect.objectContaining({
        key: body.data.storageKey,
        size: 11,
        contentType: "application/pdf",
      }),
    ])
  })

  it("does not upload a stored document for a missing contract", async () => {
    const form = new FormData()
    form.set("name", "Missing contract.pdf")
    form.set("kind", "signed_contract")
    form.set("file", new File(["signed body"], "missing.pdf", { type: "application/pdf" }))

    const res = await adminApp.request("/00000000-0000-0000-0000-000000000000/attach-document", {
      method: "POST",
      body: form,
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Contract not found" })
    expect(uploadedObjects).toEqual([])
  })

  it("validates contract lifecycle transitions, records history, and emits safe events", async () => {
    const createRes = await adminApp.request("/", {
      method: "POST",
      ...json({
        title: "Lifecycle contract",
        scope: "customer",
      }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()).data
    expect(created.stageHistory).toEqual([
      expect.objectContaining({
        stage: "draft",
        previousStage: null,
        transition: "created",
      }),
    ])

    const prematureSign = await adminApp.request(`/${created.id}/sign`, {
      method: "POST",
      ...json({
        signerName: "Ada Lovelace",
        method: "manual",
      }),
    })
    expect(prematureSign.status).toBe(409)

    const issueRes = await adminApp.request(`/${created.id}/issue`, { method: "POST" })
    expect(issueRes.status).toBe(200)

    const sendRes = await adminApp.request(`/${created.id}/send`, { method: "POST" })
    expect(sendRes.status).toBe(200)

    const signRes = await adminApp.request(`/${created.id}/sign`, {
      method: "POST",
      ...json({
        signerName: "Ada Lovelace",
        method: "manual",
      }),
    })
    expect(signRes.status).toBe(200)

    const executeRes = await adminApp.request(`/${created.id}/execute`, { method: "POST" })
    expect(executeRes.status).toBe(200)

    const voidRes = await adminApp.request(`/${created.id}/void`, { method: "POST" })
    expect(voidRes.status).toBe(200)
    const finalContract = (await voidRes.json()).data

    expect(finalContract.status).toBe("void")
    expect(finalContract.stageHistory.map((entry: { stage: string }) => entry.stage)).toEqual([
      "draft",
      "issued",
      "sent",
      "signed",
      "executed",
      "void",
    ])
    expect(lifecycleEvents.map((event) => event.name)).toEqual([
      "contract.issued",
      "contract.sent",
      "contract.signed",
      "contract.executed",
      "contract.voided",
    ])
    expect(lifecycleEvents[0]?.metadata).toEqual({
      category: "domain",
      source: "service",
    })
    expect(lifecycleEvents[0]?.data).toEqual(
      expect.not.objectContaining({
        renderedBody: expect.anything(),
        variables: expect.anything(),
        metadata: expect.anything(),
      }),
    )
  })
})
