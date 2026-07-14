import { createRequire } from "node:module"

const runtime = createRequire(import.meta.url)(
  "react/jsx-runtime",
) as typeof import("react/jsx-runtime")

export const { Fragment, jsx, jsxs } = runtime
