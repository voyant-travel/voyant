import type { RegistryAuthMessages } from "./messages"

export const registryAuthRo: RegistryAuthMessages = {
  common: {
    roleLabels: {
      owner: "Owner",
      admin: "Admin",
      member: "Membru",
    },
  },
  organizationMemberManagement: {
    errors: {
      noOrganizationSelected: "Nu este selectata nicio organizatie activa.",
      emailRequired: "Emailul este obligatoriu.",
      inviteFailed: "Invitatia nu a putut fi trimisa.",
    },
    title: "Membrii echipei",
    description:
      "Administreaza membrii organizatiei si invitatiile in asteptare din contractul comun de autentificare.",
    inviteByEmail: "Invita prin email",
    emailPlaceholder: "coleg@example.com",
    role: "Rol",
    invite: "Invita",
    emptyOrganization: "Selecteaza o organizatie pentru a administra membrii.",
    members: {
      member: "Membru",
      role: "Rol",
      joined: "Adaugat",
      none: "Nu exista membri.",
      removeConfirm: "Elimini acest membru din organizatie?",
    },
    invitations: {
      title: "Invitatii in asteptare",
      role: "Rol",
      expires: "Expira",
      none: "Nu exista invitatii in asteptare.",
    },
  },
}
