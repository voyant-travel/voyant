const applyReleasePlan = require("@changesets/apply-release-plan").default
const { read } = require("@changesets/config")
const { getPackages } = require("@manypkg/get-packages")

const { getVoyantReleasePlan } = require("./release-utils.cjs")

async function main() {
  const cwd = process.cwd()
  const packages = await getPackages(cwd)
  const config = await read(cwd, packages)
  const releasePlan = await getVoyantReleasePlan(cwd, packages, config)
  const releasablePackages = releasePlan.releases.filter((release) => release.type !== "none")

  if (releasablePackages.length === 0) {
    console.log("No releasable changesets found.")
    return
  }

  await applyReleasePlan(
    {
      ...releasePlan,
      releases: releasePlan.releases,
    },
    packages,
    config,
  )

  console.log(`Applied release plan to ${releasablePackages.length} packages.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
