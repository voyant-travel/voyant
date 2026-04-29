import type { RegistryAuthMessages } from "./messages"

export const registryAuthEn: RegistryAuthMessages = {
  common: {
    roleLabels: {
      owner: "Owner",
      admin: "Admin",
      member: "Member",
    },
  },
  organizationMemberManagement: {
    errors: {
      noOrganizationSelected: "No active organization selected.",
      emailRequired: "Email is required.",
      inviteFailed: "Failed to send invitation.",
    },
    title: "Team members",
    description:
      "Manage organization members and pending invitations from the shared auth contract.",
    inviteByEmail: "Invite by email",
    emailPlaceholder: "teammate@example.com",
    role: "Role",
    invite: "Invite",
    emptyOrganization: "Select an organization to manage members.",
    members: {
      member: "Member",
      role: "Role",
      joined: "Joined",
      none: "No members found.",
      removeConfirm: "Remove this member from the organization?",
    },
    invitations: {
      title: "Pending invitations",
      role: "Role",
      expires: "Expires",
      none: "No pending invitations.",
    },
  },
}
