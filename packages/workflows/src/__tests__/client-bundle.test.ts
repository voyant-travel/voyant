import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { build } from "esbuild"
import { afterEach, describe, expect, test } from "vitest"

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
})

describe("@voyant-travel/workflows/client bundle boundary", () => {
  test("app bundles can trigger workflows without pulling workflow definitions or node-only imports", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".tmp-voyant-workflows-client-"))
    tempDirs.push(dir)

    const appEntry = join(dir, "app-entry.ts")
    const workflowEntry = join(dir, "workflow-entry.ts")
    const nodeOnly = join(dir, "node-only.ts")
    const appOut = join(dir, "app-bundle.js")
    const workflowOut = join(dir, "workflow-bundle.js")

    await writeFile(
      appEntry,
      `
        import { createCloudWorkflowsClient } from "@voyant-travel/workflows/client";
        export const workflows = createCloudWorkflowsClient({
          baseUrl: "https://api.voyant.test",
          triggerToken: "trg_test",
          appSlug: "operator",
          environment: "production",
          fetch,
        });
        export function triggerBooking(bookingId: string) {
          return workflows.trigger("booking.node-only", { bookingId });
        }
      `,
      "utf8",
    )
    await writeFile(
      nodeOnly,
      `
        import { readFileSync } from "node:fs";
        export function readNodeOnlyConfig() {
          return readFileSync("/etc/hosts", "utf8");
        }
      `,
      "utf8",
    )
    await writeFile(
      workflowEntry,
      `
        import { workflow } from "@voyant-travel/workflows";
        import { readNodeOnlyConfig } from "./node-only";
        export const bookingNodeOnly = workflow({
          id: "booking.node-only",
          defaultRuntime: "node",
          async run() {
            return readNodeOnlyConfig();
          },
        });
      `,
      "utf8",
    )

    const appBundle = await build({
      entryPoints: [appEntry],
      outfile: appOut,
      bundle: true,
      format: "esm",
      platform: "browser",
      metafile: true,
      write: true,
    })
    const appCode = await readFile(appOut, "utf8")

    expect(
      Object.keys(appBundle.metafile.inputs).some((input) => input.endsWith("node-only.ts")),
    ).toBe(false)
    expect(appCode).not.toContain("node:fs")
    expect(appCode).not.toContain("readNodeOnlyConfig")

    const workflowBundle = await build({
      entryPoints: [workflowEntry],
      outfile: workflowOut,
      bundle: true,
      format: "esm",
      platform: "node",
      metafile: true,
      write: true,
    })

    expect(
      Object.keys(workflowBundle.metafile.inputs).some((input) => input.endsWith("node-only.ts")),
    ).toBe(true)
  })
})
