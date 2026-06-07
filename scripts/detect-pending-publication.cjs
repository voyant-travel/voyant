const { main } = require("./release-plan.cjs")

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
