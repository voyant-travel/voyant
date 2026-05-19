import { composeLocaleMessageDefinitions, type LocaleMessageDefinitions } from "../runtime.js"
import { type AdminAuthMessages, adminAuthMessages } from "./auth.js"
import { type AdminAvailabilityMessages, adminAvailabilityMessages } from "./availability.js"
import { type AdminBookingsMessages, adminBookingsMessages } from "./bookings.js"
import { type AdminChromeMessages, adminChromeMessages } from "./chrome.js"
import { type OperatorAdminCoreMessages, operatorAdminCoreMessages } from "./core-operator.js"
import { type OperatorAdminCrmMessages, operatorAdminCrmMessages } from "./crm-operator.js"
import {
  type OperatorAdminDashboardMessages,
  operatorAdminDashboardMessages,
} from "./dashboard-operator.js"
import { type AdminFinanceMessages, adminFinanceMessages } from "./finance.js"
import { type OperatorAdminNavMessages, operatorAdminNavMessages } from "./operator-nav.js"
import {
  type OperatorAdminPricingMessages,
  operatorAdminPricingMessages,
} from "./pricing-operator.js"
import {
  type OperatorAdminProductsMessages,
  operatorAdminProductsMessages,
} from "./products-operator.js"
import { type AdminResourcesMessages, adminResourcesMessages } from "./resources.js"
import {
  type OperatorAdminSettingsMessages,
  operatorAdminSettingsMessages,
} from "./settings-operator.js"
import {
  type OperatorAdminSuppliersMessages,
  operatorAdminSuppliersMessages,
} from "./suppliers-operator.js"
import { type AdminTeamMessages, adminTeamMessages } from "./team.js"
import { type AdminTripsMessages, adminTripsMessages } from "./trips.js"

export type OperatorAdminMessages = AdminChromeMessages & {
  auth: AdminAuthMessages
} & OperatorAdminCoreMessages &
  AdminTeamMessages &
  AdminAvailabilityMessages &
  AdminBookingsMessages &
  AdminFinanceMessages &
  AdminResourcesMessages &
  OperatorAdminDashboardMessages &
  OperatorAdminSettingsMessages &
  OperatorAdminPricingMessages &
  OperatorAdminCrmMessages &
  OperatorAdminProductsMessages &
  OperatorAdminSuppliersMessages &
  AdminTripsMessages & {
    nav: OperatorAdminNavMessages
  }

export const operatorAdminMessageDefinitions =
  composeLocaleMessageDefinitions<OperatorAdminMessages>(
    adminChromeMessages,
    adminAuthMessages,
    operatorAdminCoreMessages,
    adminTeamMessages,
    adminAvailabilityMessages,
    adminBookingsMessages,
    operatorAdminDashboardMessages,
    operatorAdminPricingMessages,
    operatorAdminSettingsMessages,
    operatorAdminCrmMessages,
    operatorAdminProductsMessages,
    operatorAdminSuppliersMessages,
    adminTripsMessages,
    adminFinanceMessages,
    adminResourcesMessages,
    operatorAdminNavMessages,
  ) satisfies LocaleMessageDefinitions<OperatorAdminMessages>
