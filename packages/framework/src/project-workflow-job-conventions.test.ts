import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  analyzeProjectWorkflowJobConventions,
  compileProjectWorkflowJobConventions,
  ProjectWorkflowJobConventionError,
} from "./project-workflow-job-conventions.js"

const fixtureRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  )
})

describe("project workflow and job conventions", () => {
  it("compiles deterministic static registries without evaluating project source", async () => {
    const root = await projectFixture({
      "src/workflows/z-send-reminder.ts": [
        'import { defineWorkflow } from "@voyant-travel/framework/project-runtime"',
        'throw new Error("compiler must not evaluate this module")',
        "export type ReminderInput = { bookingId: string }",
        'export default defineWorkflow({ id: "send-reminder", run: async () => undefined })',
      ].join("\n"),
      "src/workflows/booking/a-confirm.ts": [
        'import { defineWorkflow as define } from "@voyant-travel/workflows"',
        'export default (define({ id: "confirm-booking", run: async () => undefined }))',
      ].join("\n"),
      "src/jobs/z-reconcile.ts": [
        'export const schedule = { cron: "0 * * * *" }',
        "export interface JobContext { attempt: number }",
        "export default async function reconcile() {}",
      ].join("\n"),
      "src/jobs/a-cleanup.ts": [
        'const cleanupSchedule = { cron: "0 3 * * *" }',
        "async function cleanup() {}",
        "export { cleanupSchedule as schedule }",
        "export { cleanup as default }",
      ].join("\n"),
    })

    const compilation = await compileProjectWorkflowJobConventions({ projectRoot: root })

    expect(compilation.workflows.map(({ id, sourcePath }) => ({ id, sourcePath }))).toEqual([
      {
        id: "project.workflow.booking.a-confirm",
        sourcePath: "src/workflows/booking/a-confirm.ts",
      },
      {
        id: "project.workflow.z-send-reminder",
        sourcePath: "src/workflows/z-send-reminder.ts",
      },
    ])
    expect(compilation.jobs.map(({ id, sourcePath }) => ({ id, sourcePath }))).toEqual([
      { id: "project.job.a-cleanup", sourcePath: "src/jobs/a-cleanup.ts" },
      { id: "project.job.z-reconcile", sourcePath: "src/jobs/z-reconcile.ts" },
    ])
    expect(compilation.generatedFiles).toEqual([
      {
        path: "runtime/project-workflows.generated.ts",
        contents: [
          'import type { WorkflowDefinition } from "@voyant-travel/framework/project-runtime"',
          'import workflow0 from "../../src/workflows/booking/a-confirm.js"',
          'import workflow1 from "../../src/workflows/z-send-reminder.js"',
          "",
          "export { workflow0 as projectWorkflow0 }",
          "export { workflow1 as projectWorkflow1 }",
          "",
          "export const projectWorkflows = [",
          '  { id: "confirm-booking", definition: workflow0 },',
          '  { id: "send-reminder", definition: workflow1 },',
          "] as const satisfies readonly { id: string; definition: WorkflowDefinition }[]",
          "",
        ].join("\n"),
      },
      {
        path: "runtime/project-jobs.generated.ts",
        contents: [
          'import { defineWorkflow, type ScheduleDeclaration, type WorkflowContext } from "@voyant-travel/framework/project-runtime"',
          'import job0, { schedule as schedule0 } from "../../src/jobs/a-cleanup.js"',
          'import job1, { schedule as schedule1 } from "../../src/jobs/z-reconcile.js"',
          "",
          "type ProjectJobHandler = (input: unknown, context: WorkflowContext<unknown>) => unknown | Promise<unknown>",
          "",
          "const projectJobHandler0 = job0 as ProjectJobHandler",
          "export const projectJobWorkflow0 = defineWorkflow({",
          '  id: "project.job.a-cleanup",',
          "  schedule: schedule0,",
          "  run: projectJobHandler0,",
          "})",
          "",
          "const projectJobHandler1 = job1 as ProjectJobHandler",
          "export const projectJobWorkflow1 = defineWorkflow({",
          '  id: "project.job.z-reconcile",',
          "  schedule: schedule1,",
          "  run: projectJobHandler1,",
          "})",
          "",
          "export const projectJobs = [",
          '  { id: "project.job.a-cleanup", schedule: schedule0, handler: projectJobHandler0, workflow: projectJobWorkflow0 },',
          '  { id: "project.job.z-reconcile", schedule: schedule1, handler: projectJobHandler1, workflow: projectJobWorkflow1 },',
          "] as const satisfies readonly { id: string; schedule: ScheduleDeclaration; handler: ProjectJobHandler; workflow: ReturnType<typeof defineWorkflow> }[]",
          "",
        ].join("\n"),
      },
    ])
    expect(compilation.graphWorkflows).toEqual([
      {
        id: "confirm-booking",
        config: {},
        runtime: {
          entry: "./.voyant/runtime/project-workflows.generated.ts",
          export: "projectWorkflow0",
        },
      },
      {
        id: "send-reminder",
        config: {},
        runtime: {
          entry: "./.voyant/runtime/project-workflows.generated.ts",
          export: "projectWorkflow1",
        },
      },
      {
        id: "project.job.a-cleanup",
        config: { schedule: { cron: "0 3 * * *" } },
        runtime: {
          entry: "./.voyant/runtime/project-jobs.generated.ts",
          export: "projectJobWorkflow0",
        },
      },
      {
        id: "project.job.z-reconcile",
        config: { schedule: { cron: "0 * * * *" } },
        runtime: {
          entry: "./.voyant/runtime/project-jobs.generated.ts",
          export: "projectJobWorkflow1",
        },
      },
    ])
  })

  it("rejects registered, indirect, missing, and extra workflow exports", async () => {
    const root = await projectFixture({
      "src/workflows/registered.ts": [
        'import { workflow } from "@voyant-travel/workflows"',
        'export default workflow({ id: "registered", run: async () => undefined })',
      ].join("\n"),
      "src/workflows/indirect.ts": [
        'import { defineWorkflow } from "@voyant-travel/workflows"',
        'const definition = defineWorkflow({ id: "indirect", run: async () => undefined })',
        "export default definition",
      ].join("\n"),
      "src/workflows/missing.ts": "export type Input = { id: string }\n",
      "src/workflows/extra.ts": [
        'import { defineWorkflow } from "@voyant-travel/workflows"',
        "export const metadata = {}",
        'export default defineWorkflow({ id: "extra", run: async () => undefined })',
      ].join("\n"),
    })

    const analysis = await analyzeProjectWorkflowJobConventions({ projectRoot: root })

    expect(
      analysis.diagnostics.map(({ code, exportName, sourcePaths }) => ({
        code,
        exportName,
        sourcePath: sourcePaths[0],
      })),
    ).toEqual([
      {
        code: "PROJECT_WORKFLOW_INVALID_DEFAULT_EXPORT",
        exportName: "default",
        sourcePath: "src/workflows/indirect.ts",
      },
      {
        code: "PROJECT_WORKFLOW_INVALID_DEFAULT_EXPORT",
        exportName: "default",
        sourcePath: "src/workflows/registered.ts",
      },
      {
        code: "PROJECT_WORKFLOW_MISSING_DEFAULT_EXPORT",
        exportName: "default",
        sourcePath: "src/workflows/missing.ts",
      },
      {
        code: "PROJECT_WORKFLOW_UNSUPPORTED_EXPORT",
        exportName: "metadata",
        sourcePath: "src/workflows/extra.ts",
      },
    ])
  })

  it("rejects missing and unsupported job exports", async () => {
    const root = await projectFixture({
      "src/jobs/no-handler.ts": 'export const schedule = { cron: "* * * * *" }\n',
      "src/jobs/no-schedule.ts": "export default async function run() {}\n",
      "src/jobs/extra.ts": [
        'export const schedule = { cron: "* * * * *" }',
        'export const description = "extra"',
        "export default async function run() {}",
      ].join("\n"),
    })

    const analysis = await analyzeProjectWorkflowJobConventions({ projectRoot: root })

    expect(analysis.diagnostics).toEqual([
      expect.objectContaining({
        code: "PROJECT_JOB_MISSING_DEFAULT_EXPORT",
        sourcePaths: ["src/jobs/no-handler.ts"],
      }),
      expect.objectContaining({
        code: "PROJECT_JOB_MISSING_SCHEDULE_EXPORT",
        sourcePaths: ["src/jobs/no-schedule.ts"],
      }),
      expect.objectContaining({
        code: "PROJECT_JOB_UNSUPPORTED_EXPORT",
        exportName: "description",
        sourcePaths: ["src/jobs/extra.ts"],
      }),
    ])
    await expect(
      compileProjectWorkflowJobConventions({ projectRoot: root }),
    ).rejects.toBeInstanceOf(ProjectWorkflowJobConventionError)
  })

  it("rejects static, re-export, and dynamic imports that escape the project", async () => {
    const root = await projectFixture({
      "src/workflows/escaped.ts": [
        'import { defineWorkflow } from "@voyant-travel/workflows"',
        'import "../../../outside.js"',
        'const load = () => import("../../../secret.js")',
        'export default defineWorkflow({ id: "escaped", run: async () => load() })',
      ].join("\n"),
      "src/jobs/escaped.ts": [
        'export { schedule } from "../../../schedule.js"',
        'export const value = import("file:///tmp/value.js")',
        "export default async function run() {}",
      ].join("\n"),
    })

    const analysis = await analyzeProjectWorkflowJobConventions({ projectRoot: root })

    expect(analysis.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROJECT_JOB_IMPORT_ESCAPE",
          specifier: "../../../schedule.js",
        }),
        expect.objectContaining({
          code: "PROJECT_JOB_IMPORT_ESCAPE",
          specifier: "file:///tmp/value.js",
        }),
        expect.objectContaining({
          code: "PROJECT_WORKFLOW_IMPORT_ESCAPE",
          specifier: "../../../outside.js",
        }),
        expect.objectContaining({
          code: "PROJECT_WORKFLOW_IMPORT_ESCAPE",
          specifier: "../../../secret.js",
        }),
      ]),
    )
  })

  it("reports path-normalization ID collisions before generating imports", async () => {
    const root = await projectFixture({
      "src/workflows/send-email.ts": validWorkflow("send-email"),
      "src/workflows/send_email.ts": validWorkflow("send_email"),
      "src/jobs/re-index.ts": validJob(),
      "src/jobs/re_index.ts": validJob(),
    })

    const analysis = await analyzeProjectWorkflowJobConventions({ projectRoot: root })

    expect(analysis.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROJECT_JOB_ID_COLLISION",
          id: "project.job.re-index",
          sourcePaths: ["src/jobs/re-index.ts", "src/jobs/re_index.ts"],
        }),
        expect.objectContaining({
          code: "PROJECT_WORKFLOW_ID_COLLISION",
          id: "project.workflow.send-email",
          sourcePaths: ["src/workflows/send-email.ts", "src/workflows/send_email.ts"],
        }),
      ]),
    )
  })
})

function validWorkflow(id: string): string {
  return [
    'import { defineWorkflow } from "@voyant-travel/workflows"',
    `export default defineWorkflow({ id: ${JSON.stringify(id)}, run: async () => undefined })`,
  ].join("\n")
}

function validJob(): string {
  return [
    'export const schedule = { cron: "* * * * *" }',
    "export default async function run() {}",
  ].join("\n")
}

async function projectFixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(process.cwd(), ".project-workflow-job-test-"))
  fixtureRoots.push(root)
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = path.join(root, ...relativePath.split("/"))
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, contents)
    }),
  )
  return root
}
