import {
  contractTemplateLiquidSnippets,
  contractTemplateVariableCatalog,
} from "@voyant-travel/legal/contracts"

export function useLegalContractTemplateAuthoring() {
  return {
    variableCatalog: contractTemplateVariableCatalog,
    liquidSnippets: contractTemplateLiquidSnippets,
  }
}
