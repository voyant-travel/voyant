import {
  assertOperatorDeploymentGraphResourceEnv,
  loadOperatorDeploymentGraphArtifacts,
} from "../src/deployment-graph-artifacts"
import {
  resolveOperatorNodeProviderPlan,
  validateOperatorNodeProviderPlanEnv,
} from "../src/operator-node-provider-plan"

function loadLocalEnv(): void {
  try {
    const processWithEnvFile = process as typeof process & {
      loadEnvFile?: (path?: string) => void
    }
    processWithEnvFile.loadEnvFile?.(".env")
  } catch {
    // No local .env file. Real deployments rely on ambient platform env.
  }
}

function main(): void {
  loadLocalEnv()

  const summary = loadOperatorDeploymentGraphArtifacts()
  assertOperatorDeploymentGraphResourceEnv(summary, process.env)
  const providerPlan = resolveOperatorNodeProviderPlan(summary.providers)
  const providerPlanIssues = validateOperatorNodeProviderPlanEnv(providerPlan, process.env)
  if (providerPlanIssues.length > 0) {
    throw new Error(
      `Operator deployment graph provider plan requirements are not satisfied:\n${formatIssues(
        providerPlanIssues,
      )}`,
    )
  }

  const requiredEnvNames = new Set(
    summary.resourceRequirements.flatMap((resource) =>
      resource.env
        .filter((requirement) => requirement.required)
        .map((requirement) => requirement.name),
    ),
  )

  console.log(`operator deployment graph env: OK (${requiredEnvNames.size} required resource env)`)
}

function formatIssues(issues: readonly string[]): string {
  return issues.map((issue) => `- ${issue}`).join("\n")
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

try {
  main()
} catch (error) {
  console.error(reason(error))
  process.exitCode = 1
}
