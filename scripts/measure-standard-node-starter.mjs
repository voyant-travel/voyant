import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const rootFlagIndex = process.argv.indexOf("--root")
const root =
  rootFlagIndex >= 0 && process.argv[rootFlagIndex + 1]
    ? resolve(process.argv[rootFlagIndex + 1])
    : scriptRoot
const operatorRoot = join(root, "starters/operator")
const requireBuild = process.argv.includes("--require-build") || process.argv.includes("--check")
const check = process.argv.includes("--check")
const serverEntry = join(operatorRoot, "dist/server/server.js")
const clientRoot = join(operatorRoot, "dist/client")

if (requireBuild && (!existsSync(serverEntry) || !existsSync(clientRoot))) {
  console.error(
    "measure-standard-node-starter: build output is missing; run the Operator build first",
  )
  process.exit(1)
}

const serverFiles = existsSync(dirname(serverEntry))
  ? walk(dirname(serverEntry)).filter((file) => extname(file) === ".js")
  : []
const clientFiles = existsSync(clientRoot)
  ? walk(clientRoot).filter((file) => extname(file) === ".js")
  : []
const adminChunks = clientFiles.filter((file) => /(?:admin|route|page|chunk)/i.test(file))
const configSource = readFileSync(join(operatorRoot, "voyant.config.ts"), "utf8")
const checkedInMetadataNames = [
  "env.d.ts",
  "tsconfig.json",
  "tsconfig.client.json",
  "tsconfig.server.json",
  "turbo.json",
  "vite.config.ts",
  "vitest.config.ts",
]
const generatedMetadataNames = [
  "env.d.ts",
  "tsconfig.client.json",
  "tsconfig.server.json",
  "vite.config.ts",
  "vitest.config.ts",
]
const checkedInMetadata = checkedInMetadataNames
  .map((file) => join(operatorRoot, file))
  .filter(existsSync)
const generatedMetadata = generatedMetadataNames
  .map((file) => join(operatorRoot, ".voyant", file))
  .filter(existsSync)

const report = {
  schemaVersion: "voyant.starter-performance.v2",
  authoredConfig: {
    lines: configSource.trim().split(/\r?\n/).length,
    repeatsStandardModules: /\bmodules\s*:/.test(configSource),
    repeatsStandardExtensions: /\bextensions\s*:/.test(configSource),
  },
  metadata: {
    checkedIn: summarizeMetadata(checkedInMetadata),
    generated: {
      ...summarizeMetadata(generatedMetadata),
      declarationPathEntries: generatedDeclarationPathEntries(operatorRoot),
    },
  },
  server: summarize(serverFiles),
  admin: summarize(adminChunks),
  client: summarize(clientFiles),
  boot: existsSync(serverEntry) ? measureBoot(serverEntry) : null,
}

console.log(JSON.stringify(report, null, 2))

if (check) {
  const failures = []
  if (report.authoredConfig.lines > 20) failures.push("voyant.config.ts exceeds 20 lines")
  if (report.authoredConfig.repeatsStandardModules) failures.push("config repeats standard modules")
  if (report.authoredConfig.repeatsStandardExtensions)
    failures.push("config repeats standard extensions")
  if (report.metadata.checkedIn.files > 0) failures.push("starter copies checked-in metadata")
  if (report.metadata.generated.files !== generatedMetadataNames.length) {
    failures.push("generated .voyant metadata is incomplete")
  }
  if (report.server.gzipBytes > 25 * 1024 * 1024)
    failures.push("server gzip closure exceeds 25 MiB")
  if (report.admin.gzipBytes > 15 * 1024 * 1024) failures.push("admin gzip chunks exceed 15 MiB")
  if (report.admin.largestGzipBytes > 2 * 1024 * 1024) {
    failures.push("largest admin gzip chunk exceeds 2 MiB")
  }
  if (!report.boot?.ok || report.boot.milliseconds > 5_000) {
    failures.push("cold Node module boot exceeds 5000 ms or failed")
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
}

function summarizeMetadata(files) {
  return {
    files: files.length,
    bytes: files.reduce((total, file) => total + statSync(file).size, 0),
    paths: files.map((file) => relative(operatorRoot, file)).sort(),
  }
}

function generatedDeclarationPathEntries(root) {
  const config = join(root, ".voyant/tsconfig.client.json")
  if (!existsSync(config)) return 0
  const parsed = JSON.parse(readFileSync(config, "utf8"))
  return Object.keys(parsed.compilerOptions?.paths ?? {}).length
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function summarize(files) {
  const entries = files.map((file) => {
    const contents = readFileSync(file)
    return {
      file: relative(operatorRoot, file),
      bytes: statSync(file).size,
      gzipBytes: gzipSync(contents).byteLength,
    }
  })
  return {
    files: entries.length,
    bytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    gzipBytes: entries.reduce((total, entry) => total + entry.gzipBytes, 0),
    largestGzipBytes: Math.max(0, ...entries.map((entry) => entry.gzipBytes)),
  }
}

function measureBoot(entry) {
  const program = `const start=performance.now();await import(${JSON.stringify(
    pathToFileURL(entry).href,
  )});console.log(JSON.stringify({milliseconds:performance.now()-start}))`
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", program], {
    cwd: operatorRoot,
    encoding: "utf8",
    timeout: 15_000,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ?? ["postgres", "://measure:measure@127.0.0.1/measure"].join(""),
    },
  })
  if (result.status !== 0) {
    return {
      ok: false,
      milliseconds: null,
      error: (result.stderr || result.error?.message || "unknown boot failure").trim(),
    }
  }
  try {
    const parsed = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1))
    return { ok: true, milliseconds: Math.round(parsed.milliseconds * 10) / 10 }
  } catch {
    return { ok: false, milliseconds: null, error: "boot probe returned invalid JSON" }
  }
}
