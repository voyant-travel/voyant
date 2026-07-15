const { writeFileSync } = require("node:fs")
const { EOL } = require("node:os")

const { read } = require("@changesets/config")
const { getPackages } = require("@manypkg/get-packages")
const semver = require("semver")

const {
  formatRepeatedArg,
  getPublishablePackages,
  getVoyantReleasePlan,
  sortPackageNames,
} = require("./release-utils.cjs")

const NPM_FETCH_CONCURRENCY = Number(process.env.VOYANT_RELEASE_NPM_FETCH_CONCURRENCY) || 8
const NPM_FETCH_RETRIES = Number(process.env.VOYANT_RELEASE_NPM_FETCH_RETRIES) || 3

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchLatestVersion(packageName, attempt = 1) {
  let response

  try {
    response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
      headers: {
        Accept: "application/json",
      },
    })
  } catch (error) {
    if (attempt < NPM_FETCH_RETRIES) {
      await wait(250 * attempt)
      return fetchLatestVersion(packageName, attempt + 1)
    }
    throw error
  }

  if (response.status === 404) {
    return null
  }

  if (response.status >= 500 && attempt < NPM_FETCH_RETRIES) {
    await wait(250 * attempt)
    return fetchLatestVersion(packageName, attempt + 1)
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch npm metadata for ${packageName}: ${response.status}`)
  }

  const payload = await response.json()
  return payload?.["dist-tags"]?.latest ?? null
}

async function getPublishedVersions(packageNames) {
  const publishedVersions = new Map()
  const queue = [...packageNames]
  const workers = Array.from(
    { length: Math.min(NPM_FETCH_CONCURRENCY, queue.length) },
    async () => {
      while (queue.length > 0) {
        const packageName = queue.shift()
        if (!packageName) break
        publishedVersions.set(packageName, await fetchLatestVersion(packageName))
      }
    },
  )

  await Promise.all(workers)

  return publishedVersions
}

function getPendingPackages(publishablePackages, publishedVersions) {
  return publishablePackages
    .map((pkg) => {
      const name = pkg.packageJson.name
      const version = pkg.packageJson.version
      const latestPublishedVersion = publishedVersions.get(name) ?? null

      if (!semver.valid(version)) {
        throw new Error(`${name} has invalid local version: ${version}`)
      }

      if (latestPublishedVersion !== null && !semver.valid(latestPublishedVersion)) {
        throw new Error(`${name} has invalid npm latest version: ${latestPublishedVersion}`)
      }

      return {
        name,
        dir: pkg.dir,
        version,
        latestPublishedVersion,
      }
    })
    .filter(
      ({ version, latestPublishedVersion }) =>
        latestPublishedVersion === null || semver.gt(version, latestPublishedVersion),
    )
    .sort((left, right) => left.name.localeCompare(right.name))
}

function appendGithubOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) {
    return
  }

  writeFileSync(outputPath, `${key}=${value}${EOL}`, { flag: "a" })
}

function getReleaseMode(hasReleasableChangesets, pendingPublication) {
  if (hasReleasableChangesets) {
    return "version"
  }

  return pendingPublication ? "publish" : "none"
}

async function getReleaseState() {
  const cwd = process.cwd()
  const packages = await getPackages(cwd)
  const config = await read(cwd, packages)
  const releasePlan = await getVoyantReleasePlan(cwd, packages, config)
  const plannedReleases = releasePlan.releases.filter((release) => release.type !== "none")
  const publishablePackages = getPublishablePackages(packages, config)

  if (publishablePackages.length === 0) {
    throw new Error("No publishable packages found for release planning.")
  }

  const publishedVersions = await getPublishedVersions(
    publishablePackages.map((pkg) => pkg.packageJson.name),
  )
  const pendingPackages = getPendingPackages(publishablePackages, publishedVersions)
  const pendingPackageNames = sortPackageNames(pendingPackages.map((pkg) => pkg.name))

  return {
    hasReleasableChangesets: plannedReleases.length > 0,
    pendingPackages,
    pendingPackageNames,
    plannedReleases: plannedReleases.map((release) => ({
      name: release.name,
      type: release.type,
      oldVersion: release.oldVersion,
      newVersion: release.newVersion,
    })),
  }
}

async function main() {
  const state = await getReleaseState()
  const pendingPublication = state.pendingPackageNames.length > 0
  const releaseMode = getReleaseMode(state.hasReleasableChangesets, pendingPublication)
  const turboFilters = formatRepeatedArg("--filter", state.pendingPackageNames)
  const packageFilters = formatRepeatedArg("--package", state.pendingPackageNames)

  console.log(
    JSON.stringify(
      {
        hasReleasableChangesets: state.hasReleasableChangesets,
        pendingPackages: state.pendingPackages,
        pendingPublication,
        releaseMode,
        plannedReleases: state.plannedReleases,
      },
      null,
      2,
    ),
  )

  appendGithubOutput("has_releasable_changesets", state.hasReleasableChangesets ? "true" : "false")
  appendGithubOutput("pending", pendingPublication ? "true" : "false")
  appendGithubOutput("publish_pending", releaseMode === "publish" ? "true" : "false")
  appendGithubOutput("release_mode", releaseMode)
  appendGithubOutput("pending_count", String(state.pendingPackageNames.length))
  appendGithubOutput("pending_package_names", state.pendingPackageNames.join(" "))
  appendGithubOutput("pending_packages_json", JSON.stringify(state.pendingPackages))
  appendGithubOutput("turbo_filters", turboFilters)
  appendGithubOutput("package_filters", packageFilters)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = {
  getPendingPackages,
  getReleaseMode,
  getReleaseState,
  main,
}
