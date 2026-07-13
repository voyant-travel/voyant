import { createLocalStorageProvider } from "@voyant-travel/storage/providers/local"
import { describe, expect, it } from "vitest"

import {
  createStorageBackedContractDocumentGenerator,
  defaultPdfContractDocumentSerializer,
} from "../../src/contracts/service-documents.js"

describe("createStorageBackedContractDocumentGenerator", () => {
  it("uploads rendered contract output through the configured storage provider", async () => {
    const storage = createLocalStorageProvider({ baseUrl: "https://files.example/" })
    const generator = createStorageBackedContractDocumentGenerator({ storage })

    const result = await generator({
      db: {} as never,
      contract: { id: "cont_123" } as never,
      templateVersion: null,
      renderedBody: "<h1>Contract</h1>",
      renderedBodyFormat: "html",
      variables: {},
      bindings: {},
    })

    expect(result.name).toBe("contract-cont_123.html")
    expect(result.mimeType).toBe("text/html; charset=utf-8")
    expect(result.storageKey).toBe("contracts/cont_123/contract-cont_123.html")
    expect(result.metadata).toMatchObject({
      storageProvider: "memory",
      url: "https://files.example/contracts/cont_123/contract-cont_123.html",
    })

    const bytes = await storage.get(result.storageKey ?? "")
    expect(bytes).not.toBeNull()
    expect(new TextDecoder().decode(bytes ?? undefined)).toBe("<h1>Contract</h1>")
  })

  it("provides a built-in pdf serializer", async () => {
    const upload = await defaultPdfContractDocumentSerializer({
      db: {} as never,
      contract: { id: "cont_123", status: "issued" } as never,
      templateVersion: null,
      renderedBody: "<h1>Contract</h1><p>Passenger Ana</p>",
      renderedBodyFormat: "html",
      variables: {},
      bindings: {},
    })

    expect(upload.mimeType).toBe("application/pdf")
    expect(upload.name).toBe("contract-cont_123.pdf")
    expect(upload.body).toBeInstanceOf(Uint8Array)
  })
})
