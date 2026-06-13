import { currenciesPart1 } from "./currencies/part-1.js"
import { currenciesPart2 } from "./currencies/part-2.js"
import { currenciesPart3 } from "./currencies/part-3.js"

export const currencies = {
  ...currenciesPart1,
  ...currenciesPart2,
  ...currenciesPart3,
}
