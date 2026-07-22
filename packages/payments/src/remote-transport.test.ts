import { describe, expect, it, vi } from "vitest"
import type { PaymentOperationResult, PaymentStatusResult } from "./index.js"
import { createControlPlaneRemotePaymentTransport } from "./remote-transport.js"

describe("control-plane remote payment transport", () => {
  it("forwards status processor identity to the control plane", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        data: {
          ok: true,
          result: {
            nextState: "paid",
            processorIdentity: {
              providerId: "netopia",
              connectionId: "payment_connection_123",
            },
          },
        },
      }),
    )
    const transport = createControlPlaneRemotePaymentTransport({
      endpoint: "https://control.example/admin-runtime/payments",
      deploymentToken: "token",
      deploymentId: "deployment_123",
      fetchImpl,
    })

    const result = await transport.call<PaymentStatusResult>({
      method: "status",
      connectionRef: "conn_ref",
      context: { env: {} },
      payload: {
        paymentSessionId: "psess_123",
        processorSessionId: "processor_session_123",
        processorIdentity: {
          providerId: "netopia",
          connectionId: "payment_connection_123",
        },
      },
    })

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      paymentSessionId: "psess_123",
      processorSessionId: "processor_session_123",
      processorIdentity: {
        providerId: "netopia",
        connectionId: "payment_connection_123",
      },
    })
    expect(result).toMatchObject({
      nextState: "paid",
      processorIdentity: {
        providerId: "netopia",
        connectionId: "payment_connection_123",
      },
    })
  })

  it("types operation results with processor identity", () => {
    const result: PaymentOperationResult = {
      status: "accepted",
      nextState: "authorized",
      processorIdentity: {
        providerId: "netopia",
        connectionId: "payment_connection_123",
      },
    }

    expect(result.processorIdentity).toEqual({
      providerId: "netopia",
      connectionId: "payment_connection_123",
    })
  })

  it("forwards callback connection id to the control plane verifier", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        data: {
          verified: true,
          event: {
            eventId: "evt_123",
            paymentSessionId: "psess_123",
            nextState: "paid",
            occurredAt: "2026-07-22T00:00:00.000Z",
            idempotencyKey: "evt_123",
          },
        },
      }),
    )
    const transport = createControlPlaneRemotePaymentTransport({
      endpoint: "https://control.example/admin-runtime/payments",
      deploymentToken: "token",
      deploymentId: "deployment_123",
      fetchImpl,
    })

    await transport.call({
      method: "verifyCallback",
      connectionRef: "conn_ref",
      context: { env: {} },
      payload: {
        headers: { "x-signature": "signed" },
        rawBody: '{"ok":true}',
        receivedAt: "2026-07-22T00:00:00.000Z",
        connectionId: "payment_connection_123",
      },
    })

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      headers: { "x-signature": "signed" },
      rawBody: '{"ok":true}',
      receivedAt: "2026-07-22T00:00:00.000Z",
      connectionId: "payment_connection_123",
    })
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
