import * as i18nExports from "../packages/i18n/src/index.ts"
import { collectLocaleDefinitionExports, validateLocaleDefinitions } from "./lib/i18n-parity.mjs"

const definitions = collectLocaleDefinitionExports("packages/i18n/src/index.ts", i18nExports)
const errors = validateLocaleDefinitions(definitions)

if (errors.length > 0) {
  console.error("i18n locale parity check failed:\n")
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`i18n locale parity check passed for ${definitions.length} definition sets.`)
