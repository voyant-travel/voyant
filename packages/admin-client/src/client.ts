import {
  bookingsOperations,
  type DeploymentCapabilities,
  financeOperations,
  type InferInput,
} from "@voyantjs/admin-contracts"

import { type AdminClientConfig, createExecutor, fetchCapabilities } from "./http.js"

/**
 * Create a framework-neutral admin client for a Voyant deployment. Runs in
 * Expo, Node, Workers, and Max tools — no React or framework runtime deps.
 *
 * ```ts
 * const client = createAdminClient({
 *   baseUrl: "https://acme.voyant.app",
 *   auth: { type: "apiKey", apiKey: "voy_..." },
 * })
 * const { data } = await client.bookings.list({ status: "on_hold" })
 * await client.bookings.confirm({ id: "book_123" }, { note: "ok" })
 * ```
 */
export function createAdminClient(config: AdminClientConfig) {
  const execute = createExecutor(config)

  return {
    /** Escape hatch: run any operation descriptor directly. */
    execute,
    /** Discover enabled modules, operations, version, and required scopes. */
    capabilities: (): Promise<DeploymentCapabilities> => fetchCapabilities(config),

    bookings: {
      list: (input?: InferInput<typeof bookingsOperations.list>) =>
        execute(bookingsOperations.list, undefined, input),
      get: (params: { id: string }) => execute(bookingsOperations.get, params),
      confirm: (params: { id: string }, input?: InferInput<typeof bookingsOperations.confirm>) =>
        execute(bookingsOperations.confirm, params, input),
      cancel: (params: { id: string }, input?: InferInput<typeof bookingsOperations.cancel>) =>
        execute(bookingsOperations.cancel, params, input),
    },

    finance: {
      invoices: {
        list: (input?: InferInput<typeof financeOperations.invoices.list>) =>
          execute(financeOperations.invoices.list, undefined, input),
        get: (params: { id: string }) => execute(financeOperations.invoices.get, params),
      },
      payments: {
        record: (
          params: { id: string },
          input: InferInput<typeof financeOperations.payments.record>,
        ) => execute(financeOperations.payments.record, params, input),
      },
      paymentLinks: {
        create: (
          params: { id: string },
          input?: InferInput<typeof financeOperations.paymentLinks.create>,
        ) => execute(financeOperations.paymentLinks.create, params, input),
      },
    },
  }
}

export type AdminClient = ReturnType<typeof createAdminClient>
