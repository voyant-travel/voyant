import type { IdentityUiMessages } from "./messages.js"

export const identityUiEn = {
  common: {
    cancel: "Cancel",
    saveChanges: "Save changes",
    primary: "Primary",
    addressLabelLabels: {
      primary: "Primary",
      billing: "Billing",
      shipping: "Shipping",
      mailing: "Mailing",
      meeting: "Meeting",
      service: "Service",
      legal: "Legal",
      other: "Other",
    },
    contactPointKindLabels: {
      email: "Email",
      phone: "Phone",
      mobile: "Mobile",
      whatsapp: "WhatsApp",
      website: "Website",
      sms: "SMS",
      fax: "Fax",
      social: "Social",
      other: "Other",
    },
    namedContactRoleLabels: {
      general: "General",
      primary: "Primary",
      reservations: "Reservations",
      operations: "Operations",
      front_desk: "Front desk",
      sales: "Sales",
      emergency: "Emergency",
      accounting: "Accounting",
      legal: "Legal",
      other: "Other",
    },
  },
  identityPage: {
    title: "Identity",
    description: "Manage phone numbers, addresses, and contacts for any record.",
    fields: {
      entityType: "Record type",
      entity: "Record",
      customEntityType: "Other record type",
    },
    placeholders: {
      entityType: "person, organization, supplier...",
      entity: "Paste a reference for custom record types",
    },
    entityTypeLabels: {
      person: "Person",
      organization: "Organization",
      supplier: "Supplier",
      booking: "Booking",
      product: "Product",
    },
    emptyScope: "Choose a record above to see its contacts and addresses.",
    tabs: {
      contactPoints: "Contact details",
      addresses: "Addresses",
      namedContacts: "Named contacts",
    },
  },
  contactPointsTab: {
    description: "Phone numbers, emails and other communication channels for this record.",
    add: "Add contact detail",
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
    description: "Physical and postal addresses associated with this record.",
    add: "Add address",
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
    description: "Named people associated with this record.",
    add: "Add named contact",
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
  addressDialog: {
    titles: {
      create: "Add address",
      edit: "Edit address",
    },
    fields: {
      label: "Label",
      line1: "Line 1",
      line2: "Line 2",
      city: "City",
      region: "Region",
      postalCode: "Postal code",
      country: "Country",
      timezone: "Timezone",
      latitude: "Latitude",
      longitude: "Longitude",
      notes: "Notes",
    },
    placeholders: {
      timezone: "Europe/Istanbul",
    },
    actions: {
      create: "Add address",
    },
  },
  contactPointDialog: {
    titles: {
      create: "Add contact detail",
      edit: "Edit contact detail",
    },
    fields: {
      kind: "Kind",
      label: "Label",
      value: "Value",
      notes: "Notes",
    },
    placeholders: {
      label: "work, personal...",
      value: "name@example.com",
    },
    actions: {
      create: "Add contact detail",
    },
    validation: {
      valueRequired: "Value is required",
    },
  },
  namedContactDialog: {
    titles: {
      create: "Add named contact",
      edit: "Edit named contact",
    },
    fields: {
      role: "Role",
      name: "Name",
      title: "Title",
      email: "Email",
      phone: "Phone",
      notes: "Notes",
    },
    placeholders: {
      name: "Jane Doe",
      title: "Director of Sales",
      email: "jane@example.com",
    },
    actions: {
      create: "Add named contact",
    },
    validation: {
      nameRequired: "Name is required",
    },
  },
} satisfies IdentityUiMessages
