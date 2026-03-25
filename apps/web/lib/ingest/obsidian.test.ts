import assert from "node:assert/strict"
import test from "node:test"
import {
  buildObsidianSourceKey,
  buildObsidianUrl,
  deleteObsidianNote,
  normalizeObsidianPayload,
  type ObsidianRepository,
  upsertObsidianNote,
} from "./obsidian"

test("buildObsidianSourceKey normalizes vault path separators", () => {
  assert.equal(
    buildObsidianSourceKey("Vault", "Projects\\RAG\\Plan.md"),
    "obsidian:Vault:Projects/RAG/Plan.md"
  )
})

test("buildObsidianUrl creates a valid obsidian deep link", () => {
  assert.equal(
    buildObsidianUrl("Vault", "Projects/RAG/Plan.md"),
    "obsidian://open?vault=Vault&file=Projects%2FRAG%2FPlan.md"
  )
})

test("normalizeObsidianPayload derives title from heading or file name", () => {
  const payload = normalizeObsidianPayload({
    vaultName: "Vault",
    relativePath: "Inbox/Untitled.md",
    markdown: "# Final title\n\nBody",
    hash: "hash-1",
    mtime: 123,
  })

  assert.equal(payload.title, "Final title")
  assert.equal(payload.metadata.relativePath, "Inbox/Untitled.md")
})

test("upsertObsidianNote creates a bookmark when sourceKey is new", async () => {
  const calls = createRepositoryDouble()

  const result = await upsertObsidianNote(
    "user-1",
    {
      vaultName: "Vault",
      relativePath: "Inbox/Plan.md",
      markdown: "# Plan\n\nBody",
      hash: "hash-1",
      mtime: 1000,
    },
    calls.repository
  )

  assert.equal(result.title, "Plan")
  assert.equal(calls.created.length, 1)
  assert.equal(calls.updated.length, 0)
  assert.equal(calls.refreshed.length, 1)
  assert.equal(calls.created[0]?.sourceType, "obsidian")
  assert.equal(calls.created[0]?.sourceKey, "obsidian:Vault:Inbox/Plan.md")
})

test("upsertObsidianNote updates an existing bookmark by sourceKey", async () => {
  const calls = createRepositoryDouble({
    existing: { id: "bookmark-1" },
  })

  const result = await upsertObsidianNote(
    "user-1",
    {
      vaultName: "Vault",
      relativePath: "Inbox/Plan.md",
      markdown: "# Plan\n\nUpdated body",
      hash: "hash-2",
      mtime: 2000,
    },
    calls.repository
  )

  assert.equal(result.bookmarkId, "bookmark-1")
  assert.equal(calls.created.length, 0)
  assert.equal(calls.updated.length, 1)
  assert.equal(calls.updated[0]?.bookmarkId, "bookmark-1")
  assert.equal(calls.updated[0]?.values.sourceKey, "obsidian:Vault:Inbox/Plan.md")
})

test("deleteObsidianNote removes bookmark and embeddings by sourceKey", async () => {
  const calls = createRepositoryDouble()

  const deleted = await deleteObsidianNote(
    "user-1",
    "obsidian:Vault:Inbox/Old.md",
    calls.repository
  )

  assert.equal(deleted, true)
  assert.deepEqual(calls.deleted, [{ userId: "user-1", sourceKey: "obsidian:Vault:Inbox/Old.md" }])
})

function createRepositoryDouble(options?: { existing?: { id: string } | null }) {
  const created: Record<string, unknown>[] = []
  const updated: { bookmarkId: string; values: Record<string, unknown> }[] = []
  const deleted: { userId: string; sourceKey: string }[] = []
  const refreshed: { bookmarkId: string; content: string; userId: string }[] = []

  const repository: ObsidianRepository = {
    findBySourceKey() {
      return Promise.resolve(options?.existing ?? null)
    },
    createBookmark(values) {
      created.push(values as Record<string, unknown>)
      return Promise.resolve({ id: values.id as string })
    },
    updateBookmark(bookmarkId, values) {
      updated.push({ bookmarkId, values: values as Record<string, unknown> })
      return Promise.resolve()
    },
    deleteBySourceKey(userId, sourceKey) {
      deleted.push({ userId, sourceKey })
      return Promise.resolve(true)
    },
    refreshEmbeddings(bookmarkId, content, userId) {
      refreshed.push({ bookmarkId, content, userId })
      return Promise.resolve()
    },
  }

  return {
    created,
    updated,
    deleted,
    refreshed,
    repository,
  }
}
