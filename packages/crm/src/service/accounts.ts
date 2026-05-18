import { organizationAccountsService } from "./accounts-organizations.js"
import { peopleAccountsService } from "./accounts-people.js"
import {
  findPersonByContactPoint,
  personNameFromContact,
  upsertPersonFromContact,
} from "./accounts-resolve.js"

export const accountsService = {
  ...organizationAccountsService,
  ...peopleAccountsService,
  findPersonByContactPoint,
  upsertPersonFromContact,
}

export type {
  PersonContactInput,
  UpsertPersonFromContactOptions,
} from "./accounts-resolve.js"
export { findPersonByContactPoint, personNameFromContact, upsertPersonFromContact }
