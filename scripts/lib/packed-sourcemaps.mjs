import fs from "node:fs"
import path from "node:path"

function resolvePackedSourceMapSource(mapPath, sourceRoot, source) {
  const rootedSource = sourceRoot ? path.posix.join(sourceRoot, source) : source
  if (path.posix.isAbsolute(rootedSource) || /^[a-z][a-z0-9+.-]*:/i.test(rootedSource)) {
    return null
  }

  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(mapPath), rootedSource))
  if (resolved === ".." || resolved.startsWith("../")) return null
  return resolved.replace(/^\.\//, "")
}

export function collectPackedSourceMapProblems(extractRoot, packInfo) {
  const problems = []
  const tarballFiles = new Set(packInfo.files.map((file) => file.path))
  const sourceMapFiles = packInfo.files
    .map((file) => file.path)
    .filter((filePath) => filePath.endsWith(".js.map"))

  for (const mapPath of sourceMapFiles) {
    let sourceMap
    try {
      sourceMap = JSON.parse(fs.readFileSync(path.join(extractRoot, mapPath), "utf8"))
    } catch (error) {
      problems.push(`${mapPath} is not a valid source map: ${error.message}`)
      continue
    }

    if (!Array.isArray(sourceMap.sources)) continue

    const missingSources = sourceMap.sources.filter((source, index) => {
      if (typeof sourceMap.sourcesContent?.[index] === "string") return false
      if (typeof source !== "string") return true

      const packedSource = resolvePackedSourceMapSource(mapPath, sourceMap.sourceRoot, source)
      return packedSource === null || !tarballFiles.has(packedSource)
    })

    if (missingSources.length > 0) {
      problems.push(
        `${mapPath} references unavailable sources without sourcesContent: ${missingSources.join(
          ", ",
        )}`,
      )
    }
  }

  return problems
}
