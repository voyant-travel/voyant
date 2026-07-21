import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  analyzeProjectSubscriberLinkConventions,
  compileProjectSubscriberLinkConventions,
  type ProjectSubscriberLinkConventionError,
} from "./project-subscriber-link-conventions.js"

const fixtureRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  )
})

describe("project subscriber and link conventions", () => {
  it("compiles deterministic static subscriber and link artifacts", async () => {
    const root = await projectFixture({
      "src/subscribers/zeta.ts": [
        'import type { SubscriberRuntimeDescriptor } from "@voyant-travel/core"',
        "const manifest = {",
        '  id: "filter.zeta",',
        '  eventType: "booking.created",',
        "  register: () => undefined,",
        "} satisfies SubscriberRuntimeDescriptor",
        "export default manifest",
      ].join("\n"),
      "src/subscribers/alpha/created.ts":
        'export default { id: "filter.alpha", eventType: "person.created", register: () => undefined }\n',
      "src/links/zeta.ts": [
        'import { defineLink as link } from "@voyant-travel/core/links"',
        'import { left, right } from "../linkables.js"',
        "const definition = link(left, right)",
        "export default definition",
      ].join("\n"),
      "src/links/alpha.ts": [
        'import { defineLink } from "@voyant-travel/core"',
        'import { left, right } from "../linkables.js"',
        "export default defineLink(left, right, { deleteCascade: true })",
      ].join("\n"),
      "src/linkables.ts": "export const left = {}; export const right = {}\n",
    })

    const first = await compileProjectSubscriberLinkConventions({ projectRoot: root })
    const second = await compileProjectSubscriberLinkConventions({ projectRoot: root })

    expect(first).toEqual(second)
    expect(
      first.subscribers.map(({ subscriberId, eventType, sourcePath }) => ({
        subscriberId,
        eventType,
        sourcePath,
      })),
    ).toEqual([
      {
        eventType: "person.created",
        sourcePath: "src/subscribers/alpha/created.ts",
        subscriberId: "filter.alpha",
      },
      {
        eventType: "booking.created",
        sourcePath: "src/subscribers/zeta.ts",
        subscriberId: "filter.zeta",
      },
    ])
    expect(first.links.map(({ id, sourcePath }) => ({ id, sourcePath }))).toEqual([
      { id: "project.link.alpha", sourcePath: "src/links/alpha.ts" },
      { id: "project.link.zeta", sourcePath: "src/links/zeta.ts" },
    ])
    expect(first.generatedFiles).toEqual([
      {
        path: "runtime/project-subscribers.generated.ts",
        contents: [
          'import type { SubscriberRuntimeDescriptor } from "@voyant-travel/core"',
          'import subscriber0 from "../../src/subscribers/alpha/created.js"',
          'import subscriber1 from "../../src/subscribers/zeta.js"',
          "",
          "export { subscriber0 as projectSubscriber0 }",
          "export { subscriber1 as projectSubscriber1 }",
          "",
          "export const projectSubscribers = [subscriber0, subscriber1] as const satisfies readonly SubscriberRuntimeDescriptor[]",
          "",
        ].join("\n"),
      },
      {
        path: "runtime/project-links.generated.ts",
        contents: [
          'import type { LinkDefinition } from "@voyant-travel/core"',
          'import link0 from "../../src/links/alpha.js"',
          'import link1 from "../../src/links/zeta.js"',
          "",
          "export { link0 as projectLink0 }",
          "export { link1 as projectLink1 }",
          "",
          "export const projectLinks = [link0, link1] as const satisfies readonly LinkDefinition[]",
          "",
        ].join("\n"),
      },
    ])
    expect(first.graphSubscribers).toEqual([
      expect.objectContaining({
        id: "filter.alpha",
        eventType: "person.created",
        runtime: {
          entry: "./.voyant/runtime/project-subscribers.generated.ts",
          export: "projectSubscriber0",
        },
      }),
      expect.objectContaining({
        id: "filter.zeta",
        eventType: "booking.created",
        runtime: {
          entry: "./.voyant/runtime/project-subscribers.generated.ts",
          export: "projectSubscriber1",
        },
      }),
    ])
    expect(first.graphLinks).toEqual([
      {
        export: "default",
        id: "project.link.alpha",
        kind: "definition",
        source: "src/links/alpha.ts",
      },
      {
        export: "default",
        id: "project.link.zeta",
        kind: "definition",
        source: "src/links/zeta.ts",
      },
    ])
  })

  it("reports missing defaults, named exports, and invalid declaration shapes", async () => {
    const root = await projectFixture({
      "src/subscribers/missing.ts": 'export const filter = { id: "x", eventType: "x" }\n',
      "src/subscribers/call.ts": "export default makeSubscriber()\n",
      "src/subscribers/function.ts":
        'export default { id: "function-filter", eventType: "x", input: () => true }\n',
      "src/subscribers/literals.ts":
        'const id = "literal-filter"; const eventType = "x"; export default { id, eventType, register: () => undefined }\n',
      "src/subscribers/named-destructuring.ts":
        'export const { named } = { named: true }; export default { id: "named", eventType: "x", register: () => undefined }\n',
      "src/links/plain.ts": "export default { tableName: 'plain' }\n",
      "src/links/wrong-helper.ts": [
        'import { defineLink } from "./helper.js"',
        "export default defineLink({}, {})",
      ].join("\n"),
      "src/links/helper.ts": "export const defineLink = () => ({})\n",
    })

    const analysis = await analyzeProjectSubscriberLinkConventions({ projectRoot: root })

    expect(analysis.subscribers.map(({ subscriberId }) => subscriberId)).toEqual([
      "literal-filter",
      "named",
    ])
    expect(analysis.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROJECT_CONVENTION_MISSING_DEFAULT_EXPORT",
          sourcePaths: ["src/subscribers/missing.ts"],
        }),
        expect.objectContaining({
          code: "PROJECT_CONVENTION_UNSUPPORTED_EXPORT",
          exportName: "filter",
        }),
        expect.objectContaining({
          code: "PROJECT_CONVENTION_UNSUPPORTED_EXPORT",
          exportName: "named",
        }),
        expect.objectContaining({
          code: "PROJECT_SUBSCRIBER_INVALID_DESCRIPTOR",
          sourcePaths: ["src/subscribers/call.ts"],
        }),
        expect.objectContaining({
          code: "PROJECT_SUBSCRIBER_INVALID_DESCRIPTOR",
          sourcePaths: ["src/subscribers/function.ts"],
        }),
        expect.objectContaining({
          code: "PROJECT_LINK_INVALID_DEFINITION",
          sourcePaths: ["src/links/plain.ts"],
        }),
        expect.objectContaining({
          code: "PROJECT_LINK_INVALID_DEFINITION",
          sourcePaths: ["src/links/wrong-helper.ts"],
        }),
      ]),
    )
  })

  it("reports duplicate subscriber ids and project-root import escapes", async () => {
    const root = await projectFixture({
      "src/subscribers/a.ts": [
        'import "../../../outside.js"',
        'export default { id: "duplicate", eventType: "a", register: () => undefined }',
      ].join("\n"),
      "src/subscribers/b.ts":
        'export default { id: "duplicate", eventType: "b", register: () => undefined }\n',
      "src/links/escaped.ts": [
        'import { defineLink } from "@voyant-travel/core"',
        'import left from "file:///tmp/left.js"',
        "export default defineLink(left, {})",
      ].join("\n"),
    })

    const analysis = await analyzeProjectSubscriberLinkConventions({ projectRoot: root })

    expect(analysis.diagnostics).toEqual([
      expect.objectContaining({
        code: "PROJECT_CONVENTION_IMPORT_ESCAPE",
        sourcePaths: ["src/links/escaped.ts"],
      }),
      expect.objectContaining({
        code: "PROJECT_CONVENTION_IMPORT_ESCAPE",
        sourcePaths: ["src/subscribers/a.ts"],
      }),
      {
        code: "PROJECT_SUBSCRIBER_ID_COLLISION",
        message:
          'Subscriber id "duplicate" is exported by "src/subscribers/a.ts", "src/subscribers/b.ts".',
        severity: "error",
        sourcePaths: ["src/subscribers/a.ts", "src/subscribers/b.ts"],
        subscriberId: "duplicate",
      },
    ])
  })

  it("preserves scanner diagnostics for path-derived ID collisions", async () => {
    const root = await projectFixture({
      "src/links/booking-person.ts": [
        'import { defineLink } from "@voyant-travel/core"',
        "export default defineLink({}, {})",
      ].join("\n"),
      "src/links/booking_person.ts": [
        'import { defineLink } from "@voyant-travel/core"',
        "export default defineLink({}, {})",
      ].join("\n"),
    })

    const analysis = await analyzeProjectSubscriberLinkConventions({ projectRoot: root })

    expect(analysis.diagnostics).toContainEqual({
      code: "PROJECT_CONVENTION_ID_COLLISION",
      message:
        'Convention ID "project.link.booking-person" is produced by "src/links/booking-person.ts", "src/links/booking_person.ts".',
      severity: "error",
      sourcePaths: ["src/links/booking-person.ts", "src/links/booking_person.ts"],
    })
  })

  it("throws one typed compilation error with sorted diagnostics", async () => {
    const root = await projectFixture({
      "src/links/bad.ts": "export default {}\n",
      "src/subscribers/bad.ts": "export default {}\n",
    })

    await expect(compileProjectSubscriberLinkConventions({ projectRoot: root })).rejects.toEqual(
      expect.objectContaining({
        name: "ProjectSubscriberLinkConventionError",
        diagnostics: [
          expect.objectContaining({ code: "PROJECT_LINK_INVALID_DEFINITION" }),
          expect.objectContaining({ code: "PROJECT_SUBSCRIBER_INVALID_DESCRIPTOR" }),
        ],
      } satisfies Partial<ProjectSubscriberLinkConventionError>),
    )
  })
})

async function projectFixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(process.cwd(), ".project-subscriber-link-test-"))
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
