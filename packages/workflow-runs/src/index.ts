/**
 * `@voyant-travel/workflow-runs` — passive observability for in-process
 * workflows.
 *
 * The package gives templates two things:
 *
 *   1. A `recordWorkflowRun` / recorder API that writes lifecycle
 *      rows into `workflow_runs` + `workflow_run_steps` as a
 *      workflow runs. Edge-compatible — postgres-js or neon-http.
 *   2. A read-only Hono router (`createWorkflowRunsAdminRoutes`)
 *      that serves `/v1/admin/workflow-runs[/:id]` for the
 *      `WorkflowRunsPage` UI in `@voyant-travel/workflows-react/ui`
 *      to consume.
 *
 * Distinct from the durable `@voyant-travel/workflows` SDK — that one is
 * the Cloud-orchestrated runtime; this one is the lightweight
 * "what just happened?" log every template can ship without a
 * separate worker process.
 */

export {
  createWorkflowRunsHonoModule,
  WORKFLOW_RUNS_ADMIN_ROUTE_PATHS,
} from "./hono-module.js"
export {
  type BeginWorkflowRunInput,
  beginWorkflowRun,
  type WorkflowRunRecorder,
} from "./recorder.js"
export {
  type MountWorkflowRunsAdminRoutesOptions,
  mountWorkflowRunsAdminRoutes,
  resolveWorkflowAdminSurface,
  type WorkflowAdminSurface,
} from "./routes.js"
export {
  type WorkflowIdempotency,
  type WorkflowRerunContext,
  type WorkflowResumeContext,
  type WorkflowRunner,
  WorkflowRunnerRegistry,
  type WorkflowTriggerContext,
} from "./runner.js"
export {
  type NewWorkflowRun,
  type NewWorkflowRunStep,
  type WorkflowRun,
  type WorkflowRunErrorPayload,
  type WorkflowRunStep,
  workflowRunStatusEnum,
  workflowRunStepStatusEnum,
  workflowRunSteps,
  workflowRuns,
} from "./schema.js"
export {
  type ListWorkflowRunsQuery,
  type ListWorkflowRunsResult,
  workflowRunsService,
} from "./service.js"
export {
  type RecordedWorkflowOptions,
  type RecordedWorkflowResultContext,
  type RecordedWorkflowRunContext,
  recordedWorkflow,
} from "./workflows.js"
