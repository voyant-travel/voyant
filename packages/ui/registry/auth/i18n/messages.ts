export type RegistryAuthMessages = {
  common: {
    roleLabels: {
      owner: string
      admin: string
      member: string
    }
  }
  organizationMemberManagement: {
    errors: {
      noOrganizationSelected: string
      emailRequired: string
      inviteFailed: string
    }
    title: string
    description: string
    inviteByEmail: string
    emailPlaceholder: string
    role: string
    invite: string
    emptyOrganization: string
    members: {
      member: string
      role: string
      joined: string
      none: string
      removeConfirm: string
    }
    invitations: {
      title: string
      role: string
      expires: string
      none: string
    }
  }
}
