import { z } from "zod/v4"
import { fetchWithValidation, type VoyantResourcesContextValue } from "../index.js"

/**
 * Mutation transport for the packaged resources admin surfaces. The
 * resources module exposes plain REST mutations (no domain mutation hooks
 * yet), so the dialogs/hosts send requests through the shared resources
 * provider context (`baseUrl` + `fetcher`) — the same client the read
 * hooks already use. No app RPC client.
 */

const batchMutationResponseSchema = z.looseObject({
  total: z.number(),
  succeeded: z.number(),
  failed: z.array(z.looseObject({ id: z.string(), error: z.string() })),
})

export type BatchMutationResponse = z.infer<typeof batchMutationResponseSchema>

/** Accept any (or empty) body — mutation callers only care about success. */
const anyResponseSchema = z.unknown()

export async function sendResourcesMutation(
  client: VoyantResourcesContextValue,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
): Promise<void> {
  await fetchWithValidation(path, anyResponseSchema, client, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

export function postResourcesBatch(
  client: VoyantResourcesContextValue,
  path: string,
  body: Record<string, unknown>,
): Promise<BatchMutationResponse> {
  return fetchWithValidation(path, batchMutationResponseSchema, client, {
    method: "POST",
    body: JSON.stringify(body),
  })
}
