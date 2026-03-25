function normalizeRelativePath(relativePath: string) {
  return relativePath.replaceAll("\\", "/")
}

export function buildObsidianSourceKey(vaultName: string, relativePath: string) {
  return `obsidian:${vaultName}:${normalizeRelativePath(relativePath)}`
}

export function buildObsidianUrl(vaultName: string, relativePath: string) {
  const normalizedPath = normalizeRelativePath(relativePath)
  const params = new URLSearchParams({
    vault: vaultName,
    file: normalizedPath,
  })

  return `obsidian://open?${params.toString()}`
}
