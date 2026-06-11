import { authUiEn } from "../i18n/en.js"
import type {
  OrganizationMembersPageMessages,
  PartialOrganizationMembersPageMessages,
} from "../i18n/messages.js"

export interface OrganizationMembersPageRoleOption {
  label: string
  value: string
}

export type {
  OrganizationMembersPageMessages,
  PartialOrganizationMembersPageMessages,
} from "../i18n/messages.js"

export const defaultOrganizationMembersPageMessages = authUiEn.organizationMembersPage

export function mergeOrganizationMembersPageMessages(
  overrides?: PartialOrganizationMembersPageMessages,
  defaults: OrganizationMembersPageMessages = defaultOrganizationMembersPageMessages,
): OrganizationMembersPageMessages {
  return {
    ...defaults,
    ...overrides,
    invite: {
      ...defaults.invite,
      ...overrides?.invite,
      errors: {
        ...defaults.invite.errors,
        ...overrides?.invite?.errors,
      },
    },
    members: {
      ...defaults.members,
      ...overrides?.members,
      actions: {
        ...defaults.members.actions,
        ...overrides?.members?.actions,
      },
      errors: {
        ...defaults.members.errors,
        ...overrides?.members?.errors,
      },
    },
    invitations: {
      ...defaults.invitations,
      ...overrides?.invitations,
      actions: {
        ...defaults.invitations.actions,
        ...overrides?.invitations?.actions,
      },
      errors: {
        ...defaults.invitations.errors,
        ...overrides?.invitations?.errors,
      },
    },
    roles: {
      ...defaults.roles,
      ...overrides?.roles,
    } as Record<string, string>,
    date: {
      ...defaults.date,
      ...overrides?.date,
    },
  }
}
