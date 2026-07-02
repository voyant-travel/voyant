export { AddressDialog, type AddressDialogProps } from "./components/address-dialog.js"
export {
  ContactPointDialog,
  type ContactPointDialogProps,
} from "./components/contact-point-dialog.js"
export { EntityRefPicker, type EntityRefPickerProps } from "./components/entity-ref-picker.js"
export {
  AddressesTab,
  ContactPointsTab,
  type IdentityEntityTabProps,
  NamedContactsTab,
} from "./components/identity-entity-tabs.js"
export {
  IdentityPage,
  type IdentityPageProps,
  type IdentityTab,
} from "./components/identity-page.js"
export {
  NamedContactDialog,
  type NamedContactDialogProps,
} from "./components/named-contact-dialog.js"
export {
  getIdentityUiI18n,
  type IdentityUiMessageOverrides,
  type IdentityUiMessages,
  IdentityUiMessagesProvider,
  identityUiEn,
  identityUiMessageDefinitions,
  identityUiRo,
  resolveIdentityUiMessages,
  useIdentityUiI18n,
  useIdentityUiI18nOrDefault,
  useIdentityUiMessages,
  useIdentityUiMessagesOrDefault,
} from "./i18n/index.js"
