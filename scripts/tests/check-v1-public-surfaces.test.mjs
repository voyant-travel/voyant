import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const repoRoot = path.resolve(import.meta.dirname, "../..")

const packages = {
  commerce: {
    required: [
      "./validation",
      "./product-reindex-workflow",
      "./product-reindex-workflow-manifest",
      "./promotion-boundary-workflow",
    ],
    retiredPrefixes: ["./markets", "./promotions", "./sellability"],
  },
  distribution: {
    required: ["./linkables", "./validation"],
    retiredPrefixes: ["./external-refs", "./suppliers"],
  },
  operations: {
    required: ["./linkables", "./scheduling", "./validation"],
    retiredPrefixes: ["./availability", "./ground", "./places", "./resources"],
  },
}

test("v1 packages expose intentional public surfaces without legacy owner paths", () => {
  for (const [packageName, policy] of Object.entries(packages)) {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "packages", packageName, "package.json"), "utf8"),
    )
    for (const exports of [packageJson.exports, packageJson.publishConfig.exports]) {
      const keys = Object.keys(exports)
      for (const required of policy.required) assert.ok(keys.includes(required))
      for (const prefix of policy.retiredPrefixes) {
        assert.equal(
          keys.some((key) => key === prefix || key.startsWith(`${prefix}/`)),
          false,
          `${packageJson.name} restored retired export family ${prefix}`,
        )
      }
    }
  }
})
