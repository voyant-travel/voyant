import type { LocaleMessageSchema } from "../runtime.js"
import { distributionEn } from "./distribution-dmc/en.js"
import { distributionRo } from "./distribution-dmc/ro.js"

export type DmcAdminDistributionMessages = (typeof distributionEn)["distribution"]
export type DmcAdminDistributionModuleMessages = LocaleMessageSchema<typeof distributionEn>

export const adminDmcDistributionMessages = {
  en: distributionEn,
  ro: distributionRo,
}
