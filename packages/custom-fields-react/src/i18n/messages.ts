export const customFieldTypes = [
  "varchar",
  "text",
  "double",
  "monetary",
  "date",
  "boolean",
  "enum",
  "set",
  "json",
  "address",
  "phone",
] as const

export type CustomFieldType = (typeof customFieldTypes)[number]

export type CustomFieldsUiMessages = {
  navigation: {
    title: string
    label: string
  }
  page: {
    title: string
    description: string
    addField: string
    entity: string
    allEntities: string
    owner: string
    allOwners: string
    operatorOwned: string
    appOwned: string
    platformOwned: string
    namespace: string
    readOnly: string
    loadFailed: string
    requestFailed: string
    emptyTitle: string
    emptyDescription: string
    required: string
    searchable: string
    exportable: string
    invoiceable: string
    optionsCount: string
    edit: string
    delete: string
    cancel: string
    paginationSummary: string
    previous: string
    paginationPage: string
    next: string
    deleteTitle: string
    deleteDescription: string
  }
  sheet: {
    editTitle: string
    newTitle: string
    entity: string
    fieldType: string
    label: string
    labelPlaceholder: string
    key: string
    keyPlaceholder: string
    searchable: string
    searchableDescription: string
    exportable: string
    exportableDescription: string
    invoiceable: string
    invoiceableDescription: string
    options: string
    optionsDescription: string
    optionLabelPlaceholder: string
    optionValuePlaceholder: string
    addOption: string
    cancel: string
    saveChanges: string
    createField: string
    labelRequired: string
    keyRequired: string
    optionsRequired: string
    fieldTypeLabels: Record<CustomFieldType, string>
  }
}
