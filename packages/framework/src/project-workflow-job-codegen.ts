/** Paths relative to the project's disposable `.voyant` artifact root. */
export const PROJECT_WORKFLOWS_GENERATED_PATH = "runtime/project-workflows.generated.ts"
export const PROJECT_JOBS_GENERATED_PATH = "runtime/project-jobs.generated.ts"

interface ProjectWorkflowJobSource {
  id: string
  sourcePath: string
}

export function generateProjectWorkflowsSource(
  workflows: readonly ProjectWorkflowJobSource[],
): string {
  const ordered = [...workflows].sort(compareContributions)
  return [
    'import type { WorkflowDefinition } from "@voyant-travel/workflows"',
    ...ordered.map(
      (workflow, index) =>
        `import workflow${index} from ${JSON.stringify(generatedImportSpecifier(workflow.sourcePath))}`,
    ),
    ...(ordered.length > 0 ? [""] : []),
    "export const projectWorkflows = [",
    ...ordered.map(
      (workflow, index) =>
        `  { id: ${JSON.stringify(workflow.id)}, definition: workflow${index} },`,
    ),
    "] as const satisfies readonly { id: string; definition: WorkflowDefinition }[]",
    "",
  ].join("\n")
}

export function generateProjectJobsSource(jobs: readonly ProjectWorkflowJobSource[]): string {
  const ordered = [...jobs].sort(compareContributions)
  return [
    'import type { ScheduleDeclaration } from "@voyant-travel/workflows"',
    ...ordered.map(
      (job, index) =>
        `import job${index}, { schedule as schedule${index} } from ${JSON.stringify(generatedImportSpecifier(job.sourcePath))}`,
    ),
    ...(ordered.length > 0 ? [""] : []),
    "export const projectJobs = [",
    ...ordered.map(
      (job, index) =>
        `  { id: ${JSON.stringify(job.id)}, schedule: schedule${index}, handler: job${index} },`,
    ),
    "] as const satisfies readonly { id: string; schedule: ScheduleDeclaration; handler: unknown }[]",
    "",
  ].join("\n")
}

function generatedImportSpecifier(sourcePath: string): string {
  return `../../${sourcePath.replace(/\.ts$/, ".js")}`
}

function compareContributions(
  left: ProjectWorkflowJobSource,
  right: ProjectWorkflowJobSource,
): number {
  return left.sourcePath < right.sourcePath ? -1 : left.sourcePath > right.sourcePath ? 1 : 0
}
