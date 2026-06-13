import { distributionEnPart1 } from "./en/part-1.js"
import { distributionEnPart2 } from "./en/part-2.js"
import { distributionEnPart3 } from "./en/part-3.js"

export const distributionEn = {
  distribution: {
    ...distributionEnPart1,
    ...distributionEnPart2,
    ...distributionEnPart3,
  },
}
