import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const starterLib = resolve(root, "starters/operator/src/api/lib")
const bindingPath = resolve(starterLib, "owned-booking-handlers.ts")

for (const helper of [
  "product-booking-handler.ts",
  "product-booking-handler-utils.ts",
  "retained-vertical-booking-handlers.ts",
]) {
  if (existsSync(resolve(starterLib, helper))) {
    throw new Error(`Operator must not own package booking behavior: ${helper}`)
  }
}

const binding = readFileSync(bindingPath, "utf8")
const bindingLines = binding.split("\n").length
if (bindingLines > 35) {
  throw new Error(`Operator booking binding grew to ${bindingLines} lines (maximum: 35)`)
}

for (const token of [
  "/schema",
  "/service-content",
  "commitBridge",
  "loadContent",
  "loadPrice",
  "loadProductOptions",
  "bookingPaymentSchedules",
]) {
  if (binding.includes(token)) {
    throw new Error(`Operator booking binding regained product behavior: ${token}`)
  }
}

const packageAuthorities = [
  ["packages/inventory/src/booking-engine/product-runtime.ts", "registerProductBookingHandler"],
  [
    "packages/accommodations/src/booking-engine/operator-runtime.ts",
    "registerAccommodationBookingHandler",
  ],
  ["packages/cruises/src/booking-engine/operator-runtime.ts", "registerCruiseBookingHandler"],
]
for (const [relativePath, registration] of packageAuthorities) {
  const source = readFileSync(resolve(root, relativePath), "utf8")
  if (!source.includes(`export function ${registration}`)) {
    throw new Error(`${relativePath} must own ${registration}`)
  }
  if (source.includes("starters/operator")) {
    throw new Error(`${relativePath} must not depend on the Operator starter`)
  }
}

console.log(
  `Operator product booking backend authority: ${bindingLines}/35 binding lines; 3 package runtimes`,
)
