import { realpathSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RESULT_MARKER = "VOYANT_PACKED_MANIFEST_RESULT="

const input = JSON.parse(await readFile(process.argv[2], "utf8"))
const problems = []
const descriptors = []

function packageSpecifier(entry) {
  if (entry === input.packageName) return entry
  if (entry.startsWith(`${input.packageName}/`)) return entry
  if (entry.startsWith("./")) return `${input.packageName}/${entry.slice(2)}`
  return null
}

function collectRuntimeDescriptors(value, descriptors, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return
  seen.add(value)

  if (typeof value.entry === "string" && typeof value.export === "string") {
    const specifier = packageSpecifier(value.entry)
    if (specifier)
      descriptors.set(`${specifier}\0${value.export}`, { specifier, export: value.export })
  }

  for (const nestedValue of Object.values(value)) {
    collectRuntimeDescriptors(nestedValue, descriptors, seen)
  }
}

try {
  const manifestSpecifier = packageSpecifier(input.manifestExport)
  if (!manifestSpecifier) {
    problems.push(`${input.manifestExport} is not a package-owned manifest export`)
  } else {
    const manifestNamespace = await import(manifestSpecifier)
    const runtimeDescriptors = new Map()
    collectRuntimeDescriptors(input.packageRuntime, runtimeDescriptors)

    for (const exportedValue of Object.values(manifestNamespace)) {
      if (
        exportedValue &&
        typeof exportedValue === "object" &&
        typeof exportedValue.schemaVersion === "string" &&
        exportedValue.schemaVersion.startsWith("voyant.")
      ) {
        collectRuntimeDescriptors(exportedValue, runtimeDescriptors)
      }
    }

    for (const descriptor of runtimeDescriptors.values()) {
      try {
        const targetUrl = import.meta.resolve(descriptor.specifier)
        if (!targetUrl.startsWith("file:")) {
          problems.push(`runtime entry ${descriptor.specifier} resolves outside the package`)
          continue
        }
        const target = path.relative(
          realpathSync(input.packageRoot),
          realpathSync(fileURLToPath(targetUrl)),
        )
        if (
          !target ||
          target === ".." ||
          target.startsWith(`..${path.sep}`) ||
          path.isAbsolute(target)
        ) {
          problems.push(`runtime entry ${descriptor.specifier} resolves outside the package`)
          continue
        }
        descriptors.push({ ...descriptor, target: target.split(path.sep).join("/") })
      } catch (error) {
        problems.push(
          `runtime entry ${descriptor.specifier} cannot be imported (${error.code ?? error.message})`,
        )
      }
    }
  }
} catch (error) {
  problems.push(
    `manifest export ${input.manifestExport} cannot be imported (${error.code ?? error.message})`,
  )
}

console.log(`${RESULT_MARKER}${JSON.stringify({ problems, descriptors })}`)
