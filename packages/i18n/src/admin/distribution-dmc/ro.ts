import { distributionRoPart1 } from "./ro/part-1.js"
import { distributionRoPart2 } from "./ro/part-2.js"
import { distributionRoPart3 } from "./ro/part-3.js"

export const distributionRo = {
  distribution: {
    ...distributionRoPart1,
    ...distributionRoPart2,
    ...distributionRoPart3,
  },
}
