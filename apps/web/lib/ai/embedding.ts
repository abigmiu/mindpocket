import { embed, embedMany } from "ai"
import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "@/db/client"
import { getDefaultProvider } from "@/db/queries/ai-provider"
import { bookmark } from "@/db/schema/bookmark"
import { embedding } from "@/db/schema/embedding"
import { getEmbeddingModel } from "@/lib/ai/provider"
import { mapRelevantContentRow } from "./relevant-content"

const CHUNK_SPLIT_REGEX = /[。.!\n]+/

export function generateChunks(input: string): string[] {
  return input
    .trim()
    .split(CHUNK_SPLIT_REGEX)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export async function generateEmbedding(
  value: string,
  model: ReturnType<typeof getEmbeddingModel>
): Promise<number[]> {
  const { embedding: vector } = await embed({ model, value })
  return vector
}

const EMBED_BATCH_SIZE = 10

export async function generateEmbeddings(
  bookmarkId: string,
  content: string,
  model: ReturnType<typeof getEmbeddingModel>
): Promise<Array<{ id: string; bookmarkId: string; content: string; embedding: number[] }>> {
  const chunks = generateChunks(content)
  if (chunks.length === 0) {
    return []
  }

  const allEmbeddings: number[][] = []

  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE)
    const { embeddings } = await embedMany({ model, values: batch })
    allEmbeddings.push(...embeddings)
  }

  return allEmbeddings.map((vector, i) => ({
    id: nanoid(),
    bookmarkId,
    content: chunks[i]!,
    embedding: vector,
  }))
}

export async function findRelevantContent(userId: string, userQuery: string) {
  const config = await getDefaultProvider(userId, "embedding")
  if (!config) {
    return []
  }

  const model = getEmbeddingModel(config)
  const userQueryEmbedded = await generateEmbedding(userQuery, model)

  const similarity = sql<number>`1 - (${cosineDistance(embedding.embedding, userQueryEmbedded)})`

  const results = await db
    .select({
      content: embedding.content,
      bookmarkId: embedding.bookmarkId,
      similarity,
      sourceType: bookmark.sourceType,
      title: bookmark.title,
      url: bookmark.url,
    })
    .from(embedding)
    .innerJoin(bookmark, eq(embedding.bookmarkId, bookmark.id))
    .where(and(eq(bookmark.userId, userId), eq(bookmark.isArchived, false), gt(similarity, 0.3)))
    .orderBy((t) => desc(t.similarity))
    .limit(6)

  return results.map((result) =>
    mapRelevantContentRow({
      ...result,
      similarity: Number(result.similarity),
    })
  )
}
