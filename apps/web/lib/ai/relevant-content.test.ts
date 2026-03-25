import assert from "node:assert/strict"
import test from "node:test"
import { mapRelevantContentRow } from "./relevant-content"

const OBSIDIAN_URL_REGEX = /^obsidian:\/\//

test("findRelevantContent returns source metadata for citations", () => {
  const result = mapRelevantContentRow({
    content: "Obsidian note body",
    bookmarkId: "bookmark-1",
    similarity: 0.91,
    sourceType: "obsidian",
    title: "RAG Plan",
    url: "obsidian://open?vault=Vault&file=Inbox%2FPlan.md",
  })

  assert.equal(result.sourceType, "obsidian")
  assert.equal(result.title, "RAG Plan")
  assert.match(result.url ?? "", OBSIDIAN_URL_REGEX)
})
