const assembleReleasePlan = require("@changesets/assemble-release-plan").default
const readChangesets = require("@changesets/read").default
const { readPreState } = require("@changesets/pre")
const semver = require("semver")

function getPublishablePackages(packages, config) {
  return packages.packages.filter((pkg) => {
    const { name, private: isPrivate } = pkg.packageJson

    return (
      typeof name === "string" &&
      name.startsWith("@voyant-travel/") &&
      !isPrivate &&
      !config.ignore.includes(name)
    )
  })
}

function sortPackageNames(packageNames) {
  return [...packageNames].sort((left, right) => left.localeCompare(right))
}

function formatRepeatedArg(flag, values) {
  return values.map((value) => `${flag}=${value}`).join(" ")
}

function normalizeZeroMajorChangesetReleases(changesets, packages) {
  const packagesByName = new Map(
    packages.packages.map((pkg) => [pkg.packageJson.name, pkg]).filter(([name]) => name),
  )

  return changesets.map((changeset) => ({
    ...changeset,
    releases: changeset.releases.map((release) => {
      const pkg = packagesByName.get(release.name)

      if (release.type !== "major" || !pkg || semver.major(pkg.packageJson.version) !== 0) {
        return release
      }

      return {
        ...release,
        type: "minor",
      }
    }),
  }))
}

function normalizeZeroMajorRelease(release) {
  if (release.type !== "major" || semver.major(release.oldVersion) !== 0) {
    return release
  }

  const newVersion = semver.inc(release.oldVersion, "minor")
  if (!newVersion) {
    throw new Error(`Could not derive 0.x minor version for ${release.name}`)
  }

  return {
    ...release,
    type: "minor",
    newVersion,
  }
}

async function getVoyantReleasePlan(cwd, packages, config) {
  const changesets = await readChangesets(cwd)
  const preState = await readPreState(packages.root.dir)
  const releasePlan = assembleReleasePlan(
    normalizeZeroMajorChangesetReleases(changesets, packages),
    packages,
    config,
    preState,
  )

  return {
    ...releasePlan,
    releases: releasePlan.releases.map(normalizeZeroMajorRelease),
  }
}

module.exports = {
  formatRepeatedArg,
  getPublishablePackages,
  getVoyantReleasePlan,
  sortPackageNames,
}
