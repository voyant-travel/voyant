/**
 * Validates the reference operator Docker/Node deploy target.
 *
 * The Docker image must be built through the operator package build lane so it
 * generates `.voyant/` and copies the generated graph artifacts into dist. The
 * runtime image must then boot the checked Node server from dist.
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const DOCKERFILE = "starters/operator/Dockerfile"
const OPERATOR_PACKAGE_JSON = "starters/operator/package.json"

const violations = []

function includesAll(value, snippets) {
  return snippets.every((snippet) => value.includes(snippet))
}

function commandIndex(value, snippet) {
  const index = value.indexOf(snippet)
  return index === -1 ? null : index
}

if (!existsSync(join(ROOT, OPERATOR_PACKAGE_JSON))) {
  violations.push({
    file: OPERATOR_PACKAGE_JSON,
    check: "missing-operator-package-json",
    message: "The operator package manifest is missing.",
  })
} else {
  const packageJson = JSON.parse(readFileSync(join(ROOT, OPERATOR_PACKAGE_JSON), "utf8"))
  const scripts =
    packageJson.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {}
  const buildScript = typeof scripts.build === "string" ? scripts.build : ""
  const copyScript =
    typeof scripts["copy:deployment-artifacts"] === "string"
      ? scripts["copy:deployment-artifacts"]
      : ""
  const graphCheckIndex = commandIndex(buildScript, "pnpm run graph:emit")
  const viteBuildIndex = commandIndex(buildScript, "vite build")
  const copyArtifactsIndex = commandIndex(buildScript, "pnpm run copy:deployment-artifacts")

  if (graphCheckIndex === null) {
    violations.push({
      file: OPERATOR_PACKAGE_JSON,
      check: "operator-build-graph-check-missing",
      message: "The operator build script must generate .voyant artifacts before Vite.",
    })
  }
  if (viteBuildIndex === null) {
    violations.push({
      file: OPERATOR_PACKAGE_JSON,
      check: "operator-build-vite-missing",
      message: "The operator build script must run Vite before copying deployment artifacts.",
    })
  }
  if (copyArtifactsIndex === null) {
    violations.push({
      file: OPERATOR_PACKAGE_JSON,
      check: "operator-build-artifact-copy-missing",
      message: "The operator build script must copy deployment graph artifacts into dist.",
    })
  }
  if (graphCheckIndex !== null && viteBuildIndex !== null && graphCheckIndex > viteBuildIndex) {
    violations.push({
      file: OPERATOR_PACKAGE_JSON,
      check: "operator-build-graph-check-after-vite",
      message:
        "The operator build script must generate .voyant artifacts before Vite creates dist.",
    })
  }
  if (
    viteBuildIndex !== null &&
    copyArtifactsIndex !== null &&
    copyArtifactsIndex < viteBuildIndex
  ) {
    violations.push({
      file: OPERATOR_PACKAGE_JSON,
      check: "operator-build-artifact-copy-before-vite",
      message:
        "The operator build script must copy deployment graph artifacts after Vite creates dist.",
    })
  }
  if (!includesAll(copyScript, [".voyant", "dist/.voyant"])) {
    violations.push({
      file: OPERATOR_PACKAGE_JSON,
      check: "operator-deployment-artifact-copy-incomplete",
      message:
        "copy:deployment-artifacts must copy the disposable .voyant artifact bundle into dist/.voyant.",
    })
  }
}

if (!existsSync(join(ROOT, DOCKERFILE))) {
  violations.push({
    file: DOCKERFILE,
    check: "missing-operator-dockerfile",
    message: "The reference operator Dockerfile is missing.",
  })
} else {
  const source = readFileSync(join(ROOT, DOCKERFILE), "utf8")
  if (!source.includes("pnpm --filter operator build")) {
    violations.push({
      file: DOCKERFILE,
      check: "docker-build-not-using-operator-build",
      message: "The Docker build stage must use the operator build script.",
    })
  }
  if (source.includes("vite build")) {
    violations.push({
      file: DOCKERFILE,
      check: "docker-build-bypasses-package-build",
      message: "The Dockerfile must not bypass the operator build with a raw Vite build.",
    })
  }
  if (!source.includes("COPY --from=build /repo/starters/operator/dist ./dist")) {
    violations.push({
      file: DOCKERFILE,
      check: "docker-runtime-dist-copy-missing",
      message: "The runtime image must copy the built operator dist directory.",
    })
  }
  if (!source.includes('CMD ["node", "dist/server/server.js"]')) {
    violations.push({
      file: DOCKERFILE,
      check: "docker-runtime-cmd-missing",
      message: "The runtime image must boot the checked Node server entry.",
    })
  }
}

if (violations.length > 0) {
  console.error("Operator Docker target violation.")
  console.error("See docs/architecture/deployment-targets.md for the rule.\n")
  for (const violation of violations) {
    console.error(`  ${violation.file} (${violation.check})`)
    console.error(`    ${violation.message}`)
  }
  process.exit(1)
}

console.log("check-operator-docker-target: OK (Docker/Node target consumes .voyant artifacts)")
