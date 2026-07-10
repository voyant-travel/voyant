import { defineDeployment } from "../../packages/framework/src/deployment-graph.ts"
import type { VoyantProjectProviders } from "../../packages/framework/src/profile.ts"
import { OPERATOR_VOYANT_PROJECT } from "./voyant.project.ts"

export const OPERATOR_VOYANT_DEPLOYMENT_PROVIDERS = {
  database: "postgres",
  storage: "memory",
  cache: "memory",
  sharedState: "memory",
  rateLimit: "memory",
  search: "none",
  email: "none",
  sms: "none",
  auth: "better-auth",
  scheduledJobs: "none",
  workflows: "none",
} as const satisfies VoyantProjectProviders

export const OPERATOR_VOYANT_DEPLOYMENT = defineDeployment({
  project: OPERATOR_VOYANT_PROJECT,
  target: "node",
  mode: "self-hosted",
  providers: OPERATOR_VOYANT_DEPLOYMENT_PROVIDERS,
})
