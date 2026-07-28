import assert from "node:assert/strict"
import { test } from "node:test"

import { z } from "zod"
import {
  entryId,
  findRefinementPaths,
  inspectRefinementInventory,
} from "../lib/tool-refinement-inventory.mjs"

test("finds a refinement on the object root", () => {
  const schema = z.object({ a: z.string() }).refine(() => true)
  assert.deepEqual(findRefinementPaths(schema).paths, ["<root>"])
})

test("finds superRefine the same as refine", () => {
  const schema = z.object({ a: z.string() }).superRefine(() => {})
  assert.deepEqual(findRefinementPaths(schema).paths, ["<root>"])
})

test("finds a refinement on a field", () => {
  const schema = z.object({ a: z.string().refine(() => true), b: z.number() })
  assert.deepEqual(findRefinementPaths(schema).paths, ["a"])
})

test("descends through optional, nullable and default wrappers", () => {
  const schema = z.object({
    a: z
      .string()
      .refine(() => true)
      .optional(),
    b: z
      .string()
      .refine(() => true)
      .nullable(),
    c: z
      .string()
      .refine(() => true)
      .default("x"),
  })
  assert.deepEqual(findRefinementPaths(schema).paths.sort(), ["a", "b", "c"])
})

test("descends into arrays and nested objects", () => {
  const schema = z.object({
    items: z.array(z.object({ note: z.string().refine(() => true) })),
  })
  assert.deepEqual(findRefinementPaths(schema).paths, ["items[].note"])
})

test("descends into record values and keys", () => {
  const schema = z.object({
    visibility: z.record(
      z.string().refine(() => true),
      z.boolean(),
    ),
  })
  assert.deepEqual(findRefinementPaths(schema).paths, ["visibility{key}"])
})

test("does not report constraints JSON Schema can express", () => {
  const schema = z.object({ a: z.string().min(3).max(9), b: z.number().int() })
  assert.deepEqual(findRefinementPaths(schema).paths, [])
})

// A walker that silently skips an unfamiliar node reports a confident zero,
// which is how the first sweep convinced itself the class did not exist.
test("reports an unrecognised node type instead of skipping it", () => {
  const alien = { _zod: { def: { type: "quantum" } } }
  const result = findRefinementPaths(alien)
  assert.deepEqual(result.paths, [])
  assert.deepEqual(result.unknownTypes, ["<root>: quantum"])
})

// A recursive schema must terminate; the getter mints a fresh node each call.
test("terminates on a recursive schema", () => {
  const node = z.object({
    name: z.string().refine(() => true),
    get children() {
      return z.array(node).optional()
    },
  })
  const result = findRefinementPaths(node)
  assert.ok(result.paths.includes("name"))
})

const NOTE = "Stated on the field description."

function inventory(entries, maxUndocumented) {
  return { entries, maxUndocumented }
}

test("passes when every refinement is classified and the ceiling matches", () => {
  const found = [{ id: "p:t:<root>" }]
  const result = inspectRefinementInventory(
    found,
    inventory([{ id: "p:t:<root>", documented: true, note: NOTE }], 0),
  )
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.documented, 1)
  assert.equal(result.undocumented, 0)
})

test("fails on a refinement nobody has classified", () => {
  const result = inspectRefinementInventory([{ id: "p:t:<root>" }], inventory([], 0))
  assert.equal(result.diagnostics.length, 1)
  assert.match(result.diagnostics[0], /Unregistered refinement "p:t:<root>"/)
})

test("fails on an inventory entry whose refinement has gone", () => {
  const result = inspectRefinementInventory(
    [],
    inventory([{ id: "p:t:<root>", documented: true, note: NOTE }], 0),
  )
  assert.equal(result.diagnostics.length, 1)
  assert.match(result.diagnostics[0], /Stale inventory entry/)
})

test("fails when an entry has no note", () => {
  const result = inspectRefinementInventory(
    [{ id: "p:t:<root>" }],
    inventory([{ id: "p:t:<root>", documented: false, note: "  " }], 1),
  )
  assert.ok(result.diagnostics.some((d) => /needs a note/.test(d)))
})

test("fails when documented is not recorded as a boolean", () => {
  const result = inspectRefinementInventory(
    [{ id: "p:t:<root>" }],
    inventory([{ id: "p:t:<root>", note: NOTE }], 0),
  )
  assert.ok(result.diagnostics.some((d) => /must record `documented`/.test(d)))
})

test("ratchets: a new undocumented refinement above the ceiling fails", () => {
  const result = inspectRefinementInventory(
    [{ id: "p:t:a" }, { id: "p:t:b" }],
    inventory(
      [
        { id: "p:t:a", documented: false, note: NOTE },
        { id: "p:t:b", documented: false, note: NOTE },
      ],
      1,
    ),
  )
  assert.ok(result.diagnostics.some((d) => /exceeds the ceiling of 1/.test(d)))
})

test("ratchets: documenting one forces the ceiling down", () => {
  const result = inspectRefinementInventory(
    [{ id: "p:t:a" }],
    inventory([{ id: "p:t:a", documented: true, note: NOTE }], 1),
  )
  assert.ok(result.diagnostics.some((d) => /Lower `maxUndocumented` to 0/.test(d)))
})

test("fails when the ceiling is missing entirely", () => {
  const result = inspectRefinementInventory([{ id: "p:t:a" }], {
    entries: [{ id: "p:t:a", documented: true, note: NOTE }],
  })
  assert.ok(result.diagnostics.some((d) => /must set `maxUndocumented`/.test(d)))
})

test("entryId composes package, tool and path", () => {
  assert.equal(
    entryId("@voyant-travel/trips", "create_trip", "components[]"),
    "@voyant-travel/trips:create_trip:components[]",
  )
})
