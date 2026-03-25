import type { IngestResult } from "@repo/types"
import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { bookmark } from "@/db/schema/bookmark"
import { embedding as embeddingTable } from "@/db/schema/embedding"
import { extractDescription } from "./converter"

const OBSIDIAN_TITLE_REGEX = /^#\s+(.+)$/m
const FILE_EXTENSION_REGEX = /\.[^.]+$/

export interface ObsidianUpsertInput {
  vaultName: string
  relativePath: string
  markdown: string
  title?: string
  hash: string
  mtime: number
  frontmatter?: Record<string, unknown>
  tags?: string[]
  aliases?: string[]
  wikilinks?: string[]
  clientSource?: "obsidian"
}

export interface NormalizedObsidianPayload {
  vaultName: string
  relativePath: string
  markdown: string
  title: string
  description: string
  sourceKey: string
  url: string
  metadata: {
    vaultName: string
    relativePath: string
    hash: string
    mtime: number
    frontmatter: Record<string, unknown>
    tags: string[]
    aliases: string[]
    wikilinks: string[]
  }
}

type BookmarkInsert = typeof bookmark.$inferInsert
type BookmarkUpdate = Omit<BookmarkInsert, "id">

export interface ObsidianRepository {
  findBySourceKey(userId: string, sourceKey: string): Promise<{ id: string } | null>
  createBookmark(values: BookmarkInsert): Promise<{ id: string }>
  updateBookmark(bookmarkId: string, values: Partial<BookmarkUpdate>): Promise<void>
  deleteBySourceKey(userId: string, sourceKey: string): Promise<boolean>
  refreshEmbeddings(bookmarkId: string, content: string, userId: string): Promise<void>
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.replaceAll("\\", "/").trim()
}

function normalizeValues(values: string[] | undefined) {
  return values?.map((value) => value.trim()).filter(Boolean) ?? []
}

function getFileName(relativePath: string) {
  const normalizedPath = normalizeRelativePath(relativePath)
  return normalizedPath.split("/").at(-1) ?? normalizedPath
}

function getTitleFromMarkdown(markdown: string) {
  return markdown.match(OBSIDIAN_TITLE_REGEX)?.[1]?.trim()
}

function getTitleFromPath(relativePath: string) {
  return getFileName(relativePath).replace(FILE_EXTENSION_REGEX, "")
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

export function normalizeObsidianPayload(input: ObsidianUpsertInput): NormalizedObsidianPayload {
  const relativePath = normalizeRelativePath(input.relativePath)
  const title =
    input.title?.trim() || getTitleFromMarkdown(input.markdown) || getTitleFromPath(relativePath)

  return {
    vaultName: input.vaultName.trim(),
    relativePath,
    markdown: input.markdown,
    title,
    description: extractDescription(input.markdown),
    sourceKey: buildObsidianSourceKey(input.vaultName, relativePath),
    url: buildObsidianUrl(input.vaultName, relativePath),
    metadata: {
      vaultName: input.vaultName.trim(),
      relativePath,
      hash: input.hash,
      mtime: input.mtime,
      frontmatter: input.frontmatter ?? {},
      tags: normalizeValues(input.tags),
      aliases: normalizeValues(input.aliases),
      wikilinks: normalizeValues(input.wikilinks),
    },
  }
}

const defaultRepository: ObsidianRepository = {
  async findBySourceKey(userId, sourceKey) {
    const { db } = await import("@/db/client")
    const existing = await db
      .select({ id: bookmark.id })
      .from(bookmark)
      .where(and(eq(bookmark.userId, userId), eq(bookmark.sourceKey, sourceKey)))
      .limit(1)

    return existing[0] ?? null
  },
  async createBookmark(values) {
    const { db } = await import("@/db/client")
    const inserted = await db.insert(bookmark).values(values).returning({ id: bookmark.id })
    return inserted[0]!
  },
  async updateBookmark(bookmarkId, values) {
    const { db } = await import("@/db/client")
    await db.update(bookmark).set(values).where(eq(bookmark.id, bookmarkId))
  },
  async deleteBySourceKey(userId, sourceKey) {
    const { db } = await import("@/db/client")
    const deleted = await db
      .delete(bookmark)
      .where(and(eq(bookmark.userId, userId), eq(bookmark.sourceKey, sourceKey)))
      .returning({ id: bookmark.id })

    return deleted.length > 0
  },
  async refreshEmbeddings(bookmarkId, content, userId) {
    const [{ db }, { getDefaultProvider }, { generateEmbeddings }, { getEmbeddingModel }] =
      await Promise.all([
        import("@/db/client"),
        import("@/db/queries/ai-provider"),
        import("@/lib/ai/embedding"),
        import("@/lib/ai/provider"),
      ])
    const config = await getDefaultProvider(userId, "embedding")
    if (!config) {
      return
    }

    const model = getEmbeddingModel(config)
    await db.delete(embeddingTable).where(eq(embeddingTable.bookmarkId, bookmarkId))
    const embeddings = await generateEmbeddings(bookmarkId, content, model)
    if (embeddings.length > 0) {
      await db.insert(embeddingTable).values(embeddings)
    }
  },
}

export async function upsertObsidianNote(
  userId: string,
  input: ObsidianUpsertInput,
  repository: ObsidianRepository = defaultRepository
): Promise<IngestResult> {
  const normalized = normalizeObsidianPayload(input)
  const values: BookmarkUpdate = {
    userId,
    folderId: null,
    type: "document",
    title: normalized.title,
    description: normalized.description,
    url: normalized.url,
    content: normalized.markdown,
    metadata: normalized.metadata,
    sourceType: "obsidian",
    sourceKey: normalized.sourceKey,
    clientSource: input.clientSource ?? "obsidian",
    ingestStatus: "completed",
    ingestError: null,
    platform: null,
  }

  const existing = await repository.findBySourceKey(userId, normalized.sourceKey)
  const bookmarkId = existing?.id ?? nanoid()

  if (existing) {
    await repository.updateBookmark(bookmarkId, values)
  } else {
    await repository.createBookmark({
      id: bookmarkId,
      ...values,
    })
  }

  await repository.refreshEmbeddings(bookmarkId, normalized.markdown, userId)

  return {
    bookmarkId,
    title: normalized.title,
    markdown: null,
    type: "document",
    status: "completed",
  }
}

export function deleteObsidianNote(
  userId: string,
  sourceKey: string,
  repository: ObsidianRepository = defaultRepository
) {
  return repository.deleteBySourceKey(userId, sourceKey)
}
