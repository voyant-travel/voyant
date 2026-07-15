const dependencyFields = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "devDependencies",
]

const internalProtocols = ["catalog:", "workspace:"]

export function collectPackedManifestProtocolDependencies(pkg) {
  const problems = []

  for (const field of dependencyFields) {
    const dependencies = pkg[field]
    if (!dependencies || typeof dependencies !== "object") continue

    for (const [name, version] of Object.entries(dependencies)) {
      if (
        typeof version === "string" &&
        internalProtocols.some((protocol) => version.startsWith(protocol))
      ) {
        problems.push(`${field}.${name}=${version}`)
      }
    }
  }

  return problems
}
