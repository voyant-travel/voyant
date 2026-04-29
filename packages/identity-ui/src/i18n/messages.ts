import type {
  AddressRecord,
  ContactPointRecord,
  NamedContactRecord,
} from "@voyantjs/identity-react"

export type AddressLabel = AddressRecord["label"]
export type ContactPointKind = ContactPointRecord["kind"]
export type NamedContactRole = NamedContactRecord["role"]

export type IdentityUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    primary: string
    addressLabelLabels: Record<AddressLabel, string>
    contactPointKindLabels: Record<ContactPointKind, string>
    namedContactRoleLabels: Record<NamedContactRole, string>
  }
  addressDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      label: string
      line1: string
      line2: string
      city: string
      region: string
      postalCode: string
      country: string
      timezone: string
      latitude: string
      longitude: string
      notes: string
    }
    placeholders: {
      timezone: string
    }
    actions: {
      create: string
    }
  }
  contactPointDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      kind: string
      label: string
      value: string
      notes: string
    }
    placeholders: {
      label: string
      value: string
    }
    actions: {
      create: string
    }
    validation: {
      valueRequired: string
    }
  }
  namedContactDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      role: string
      name: string
      title: string
      email: string
      phone: string
      notes: string
    }
    placeholders: {
      name: string
      title: string
      email: string
    }
    actions: {
      create: string
    }
    validation: {
      nameRequired: string
    }
  }
}
