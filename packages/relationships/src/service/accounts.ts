import { accountMergeService } from "./accounts-merge.js"
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
  ...accountMergeService,
  findPersonByContactPoint,
  upsertPersonFromContact,
}

export { accountMergeService, RelationshipsMergeError } from "./accounts-merge.js"
export type {
  PersonContactInput,
  UpsertPersonFromContactOptions,
} from "./accounts-resolve.js"
export { findPersonByContactPoint, personNameFromContact, upsertPersonFromContact }
