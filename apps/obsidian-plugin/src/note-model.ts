import type { App, CachedMetadata, TFile } from "obsidian"

const FILE_EXTENSION_REGEX = /\.[^.]+$/
const TITLE_HEADING_REGEX = /^#\s+(.+)$/m
const LEADING_TAG_HASH_REGEX = /^#/

export interface NoteSyncPayload {
  sourceKey: string
  clientSource: "obsidian"
  vaultName: string
  relativePath: string
  markdown: string
  title: string
  hash: string
  mtime: number
  frontmatter: Record<string, unknown>
  tags: string[]
  aliases: string[]
  wikilinks: string[]
}

interface CreateNoteSyncPayloadInput {
  vaultName: string
  relativePath: string
  markdown: string
  mtime: number
  title?: string
  frontmatter?: Record<string, unknown>
  tags?: string[]
  aliases?: string[]
  wikilinks?: string[]
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.replaceAll("\\", "/").trim()
}

function uniqueStrings(values: string[] | undefined) {
  return Array.from(new Set(values?.map((value) => value.trim()).filter(Boolean) ?? []))
}

function getTitleFromPath(relativePath: string) {
  const fileName = normalizeRelativePath(relativePath).split("/").at(-1) ?? relativePath
  return fileName.replace(FILE_EXTENSION_REGEX, "")
}

function getTitleFromMarkdown(markdown: string) {
  return markdown.match(TITLE_HEADING_REGEX)?.[1]?.trim()
}

function getFrontmatterString(
  frontmatter: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = frontmatter?.[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function getFrontmatterStringArray(frontmatter: Record<string, unknown> | undefined, key: string) {
  const value = frontmatter?.[key]
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export function buildSourceKey(vaultName: string, relativePath: string) {
  return `obsidian:${vaultName}:${normalizeRelativePath(relativePath)}`
}

async function sha256Hex(input: string) {
  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(hashBuffer), (value) =>
    value.toString(16).padStart(2, "0")
  ).join("")
}

function extractWikiLinks(cache: CachedMetadata | null) {
  return uniqueStrings(cache?.links?.map((link) => link.link))
}

function extractTags(cache: CachedMetadata | null) {
  return uniqueStrings([
    ...(cache?.tags?.map((tag) => tag.tag.replace(LEADING_TAG_HASH_REGEX, "")) ?? []),
    ...getFrontmatterStringArray(cache?.frontmatter as Record<string, unknown> | undefined, "tags"),
  ])
}

function extractAliases(cache: CachedMetadata | null) {
  return uniqueStrings(
    getFrontmatterStringArray(cache?.frontmatter as Record<string, unknown> | undefined, "aliases")
  )
}

export async function createNoteSyncPayload(
  input: CreateNoteSyncPayloadInput
): Promise<NoteSyncPayload> {
  const relativePath = normalizeRelativePath(input.relativePath)
  const title =
    input.title?.trim() ||
    getFrontmatterString(input.frontmatter, "title") ||
    getTitleFromMarkdown(input.markdown) ||
    getTitleFromPath(relativePath)

  return {
    sourceKey: buildSourceKey(input.vaultName, relativePath),
    clientSource: "obsidian",
    vaultName: input.vaultName,
    relativePath,
    markdown: input.markdown,
    title,
    hash: await sha256Hex(input.markdown),
    mtime: input.mtime,
    frontmatter: input.frontmatter ?? {},
    tags: uniqueStrings(input.tags),
    aliases: uniqueStrings(input.aliases),
    wikilinks: uniqueStrings(input.wikilinks),
  }
}

export async function readVaultNote(app: App, file: TFile): Promise<NoteSyncPayload> {
  const markdown = await app.vault.cachedRead(file)
  const cache = app.metadataCache.getFileCache(file)
  const frontmatter = (cache?.frontmatter as Record<string, unknown> | undefined) ?? {}

  return createNoteSyncPayload({
    vaultName: app.vault.getName(),
    relativePath: file.path,
    markdown,
    mtime: file.stat.mtime,
    frontmatter,
    tags: extractTags(cache),
    aliases: extractAliases(cache),
    wikilinks: extractWikiLinks(cache),
  })
}
