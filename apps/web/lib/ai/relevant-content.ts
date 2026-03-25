export interface RelevantContentRow {
  content: string
  bookmarkId: string
  similarity: number
  sourceType: string | null
  title: string
  url: string | null
}

export function mapRelevantContentRow(row: RelevantContentRow) {
  return {
    content: row.content,
    bookmarkId: row.bookmarkId,
    similarity: row.similarity,
    sourceType: row.sourceType,
    title: row.title,
    url: row.url,
  }
}
