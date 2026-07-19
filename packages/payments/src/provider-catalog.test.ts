import { describe, expect, it } from "vitest"

import { defaultPaymentProviderCatalog, findPaymentProviderDescriptor } from "./default-catalog.js"
import { paymentAdapterRuntimePort } from "./index.js"
import { validatePaymentCredentials } from "./provider-catalog.js"
import { createRemotePaymentAdapter, PAYMENT_REMOTE_NOT_IMPLEMENTED } from "./remote-adapter.js"

const netopia = findPaymentProviderDescriptor("netopia")

describe("default payment provider catalog", () => {
  it("ships Netopia as available and Voyant Payments as coming soon", () => {
    expect(netopia?.availability).toBe("available")
    expect(findPaymentProviderDescriptor("voyant-payments")?.availability).toBe("coming_soon")
  })

  it("declares only signature-verified callbacks", () => {
    for (const provider of defaultPaymentProviderCatalog) {
      expect(provider.capabilities.callbackSignatureVerification).toBe(true)
    }
  })
})

describe("createRemotePaymentAdapter", () => {
  it("produces an adapter that passes the runtime port contract", () => {
    const adapter = createRemotePaymentAdapter({
      id: "netopia",
      label: "Netopia Payments",
      mode: "sandbox",
      capabilities: netopia!.capabilities,
      connectionRef: "conn_test",
    })
    expect(() => paymentAdapterRuntimePort.test(adapter)).not.toThrow()
  })

  it("fails closed when no transport is configured", async () => {
    const adapter = createRemotePaymentAdapter({
      id: "netopia",
      label: "Netopia Payments",
      mode: "sandbox",
      capabilities: netopia!.capabilities,
      connectionRef: "conn_test",
    })
    await expect(adapter.health({ env: {} })).rejects.toMatchObject({
      code: PAYMENT_REMOTE_NOT_IMPLEMENTED,
    })
  })

  it("rejects credentials that are not signature-verified", () => {
    expect(() =>
      createRemotePaymentAdapter({
        id: "x",
        label: "X",
        mode: "sandbox",
        connectionRef: "c",
        capabilities: { ...netopia!.capabilities, callbackSignatureVerification: false },
      }),
    ).toThrow()
  })
})

describe("validatePaymentCredentials", () => {
  it("flags missing required fields", () => {
    const errors = validatePaymentCredentials(netopia!.credentialFieldSchema, {})
    expect(errors.map((error) => error.key)).toContain("apiKey")
  })

  it("passes when all required fields are present", () => {
    const errors = validatePaymentCredentials(netopia!.credentialFieldSchema, {
      merchantId: "M1",
      apiKey: "k",
      posSignature: "sig",
      ipnPublicKey: "-----BEGIN PUBLIC KEY-----",
    })
    expect(errors).toEqual([])
  })
})
