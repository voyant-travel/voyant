import ts from "typescript"

export function isDurableExpression(
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>,
  seen: Set<string> = new Set(),
): boolean {
  const value = unwrapExpression(expression)
  if (
    ts.isStringLiteralLike(value) ||
    ts.isNumericLiteral(value) ||
    value.kind === ts.SyntaxKind.TrueKeyword ||
    value.kind === ts.SyntaxKind.FalseKeyword ||
    value.kind === ts.SyntaxKind.NullKeyword ||
    ts.isNoSubstitutionTemplateLiteral(value)
  )
    return true
  if (ts.isPrefixUnaryExpression(value)) {
    return value.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(value.operand)
  }
  if (ts.isArrayLiteralExpression(value)) {
    return value.elements.every(
      (element) => !ts.isSpreadElement(element) && isDurableExpression(element, constants, seen),
    )
  }
  if (ts.isObjectLiteralExpression(value)) {
    return value.properties.every((property) => {
      if (ts.isPropertyAssignment(property))
        return isDurableExpression(property.initializer, constants, seen)
      if (ts.isShorthandPropertyAssignment(property)) {
        return isDurableIdentifier(property.name.text, constants, seen)
      }
      return false
    })
  }
  if (ts.isIdentifier(value)) return isDurableIdentifier(value.text, constants, seen)
  return false
}

export function stringProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
  constants: ReadonlyMap<string, ts.Expression>,
): string | undefined {
  const property = object.properties.find((item) =>
    ts.isPropertyAssignment(item)
      ? propertyName(item.name) === name
      : ts.isShorthandPropertyAssignment(item) && item.name.text === name,
  )
  if (!property) return undefined
  const value = resolveExpression(
    ts.isPropertyAssignment(property) ? property.initializer : property.name,
    constants,
  )
  return ts.isStringLiteralLike(value) && value.text.length > 0 ? value.text : undefined
}

export function resolveExpression(
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>,
): ts.Expression {
  let current = unwrapExpression(expression)
  const seen = new Set<string>()
  while (ts.isIdentifier(current) && constants.has(current.text) && !seen.has(current.text)) {
    seen.add(current.text)
    current = unwrapExpression(constants.get(current.text)!)
  }
  return current
}

export function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  )
    current = current.expression
  return current
}

function isDurableIdentifier(
  name: string,
  constants: ReadonlyMap<string, ts.Expression>,
  seen: Set<string>,
): boolean {
  if (seen.has(name)) return false
  const initializer = constants.get(name)
  if (!initializer) return false
  const nextSeen = new Set(seen)
  nextSeen.add(name)
  return isDurableExpression(initializer, constants, nextSeen)
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined
}
