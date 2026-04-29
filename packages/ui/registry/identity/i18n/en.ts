import type { RegistryIdentityMessages } from "./messages"

export const registryIdentityEn = {
  page: {
    title: "Identity",
    description: "Manage contact points, addresses and named contacts attached to any entity.",
    fields: {
      entityType: "Entity type",
      entityId: "Entity ID",
    },
    placeholders: {
      entityType: "person, organization, supplier...",
      entityId: "pers_... / org_... / supp_...",
    },
    emptyScope: "Enter an entity type and ID above to browse its identity records.",
    tabs: {
      contactPoints: "Contact Points",
      addresses: "Addresses",
      namedContacts: "Named Contacts",
    },
  },
  contactPointsTab: {
    description: "Phone numbers, emails and other communication channels for this entity.",
    add: "Add Contact Point",
    empty: {
      loading: "Loading contact points...",
      none: "No contact points yet.",
    },
    columns: {
      kind: "Kind",
      value: "Value",
      label: "Label",
      primary: "Primary",
    },
    actions: {
      deleteConfirm: "Delete contact point?",
    },
  },
  addressesTab: {
    description: "Physical and postal addresses associated with this entity.",
    add: "Add Address",
    empty: {
      loading: "Loading addresses...",
      none: "No addresses yet.",
    },
    columns: {
      label: "Label",
      street: "Street",
      city: "City",
      country: "Country",
      primary: "Primary",
    },
    actions: {
      deleteConfirm: "Delete address?",
    },
  },
  namedContactsTab: {
    description: "Named people associated with this entity.",
    add: "Add Named Contact",
    empty: {
      loading: "Loading named contacts...",
      none: "No named contacts yet.",
    },
    columns: {
      role: "Role",
      name: "Name",
      title: "Title",
      email: "Email",
      phone: "Phone",
      primary: "Primary",
    },
    actions: {
      deleteConfirm: "Delete named contact?",
    },
  },
} satisfies RegistryIdentityMessages
