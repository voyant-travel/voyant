import {
  contractTemplateLiquidSnippets,
  contractTemplateVariableCatalog,
} from "@voyant-travel/legal/contracts/template-authoring"

export function useLegalContractTemplateAuthoring() {
  return {
    variableCatalog: contractTemplateVariableCatalog,
    liquidSnippets: contractTemplateLiquidSnippets,
  }
}
