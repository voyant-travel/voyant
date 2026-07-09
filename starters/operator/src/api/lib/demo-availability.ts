export function isDemoInstalled(specifier: string): boolean {
  try {
    import.meta.resolve(specifier)
    return true
  } catch {
    return false
  }
}
