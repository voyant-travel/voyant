import { z } from "zod"

/** Path of the (follow-up) server capability-discovery endpoint. */
export const CAPABILITIES_PATH = "/v1/admin/_meta/capabilities"

/** Semver of the admin contract surface this client/build was compiled against. */
export const ADMIN_CONTRACT_VERSION = "0.1.0"

/** One operation as advertised by a deployment's capability descriptor. */
export const operationCapabilitySchema = z.object({
  id: z.string(),
  method: z.string(),
  pathTemplate: z.string(),
  classification: z.string(),
  scopes: z.array(z.string()),
  capabilityKey: z.string().optional(),
})

export type OperationCapability = z.infer<typeof operationCapabilitySchema>

/**
 * What a deployment advertises about itself so clients can adapt to module
 * availability and version instead of hard-coding them. Returned by
 * `GET /v1/admin/_meta/capabilities` (server route is a follow-up).
 */
export const deploymentCapabilitiesSchema = z.object({
  /** Admin contract semver the deployment implements. */
  contractVersion: z.string(),
  /** Deployment/build version, when surfaced. */
  deploymentVersion: z.string().optional(),
  /** Enabled module names (e.g. `["bookings", "finance", "crm"]`). */
  modules: z.array(z.string()),
  /** Operations available on this deployment. */
  operations: z.array(operationCapabilitySchema),
  /** The resolved actor for the calling credentials. */
  actor: z.string().optional(),
  /** The caller's granted scopes (for API-key callers). */
  scopes: z.array(z.string()).optional(),
})

export type DeploymentCapabilities = z.infer<typeof deploymentCapabilitiesSchema>
