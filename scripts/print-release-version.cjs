const { read } = require("@changesets/config")
const { getPackages } = require("@manypkg/get-packages")
const semver = require("semver")

const { getPublishablePackages, getSharedTrainVersion } = require("./release-train-utils.cjs")

async function main() {
  const cwd = process.cwd()
  const packages = await getPackages(cwd)
  const config = await read(cwd, packages)
  const publishablePackages = getPublishablePackages(packages, { ...config, fixed: [] })
  const version = getSharedTrainVersion(publishablePackages)

  if (!semver.valid(version)) {
    throw new Error(`Invalid release version: ${version}`)
  }

  console.log(version)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
