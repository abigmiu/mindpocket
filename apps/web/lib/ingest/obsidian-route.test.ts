import assert from "node:assert/strict"
import test from "node:test"
import {
  createUnauthorizedResponse,
  handleObsidianSyncDelete,
  handleObsidianSyncPost,
} from "./obsidian-route"

test("obsidian sync rejects unauthorized requests", async () => {
  const response = createUnauthorizedResponse()

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: "Unauthorized" })
})

test("obsidian sync accepts a valid obsidian payload", async () => {
  const response = await handleObsidianSyncPost(
    "user-1",
    {
      vaultName: "Vault",
      relativePath: "Inbox/Plan.md",
      markdown: "# Plan\n\nBody",
      hash: "hash-1",
      mtime: 1000,
      clientSource: "obsidian",
    },
    async () => ({
      bookmarkId: "bookmark-1",
      title: "Plan",
      markdown: null,
      type: "document",
      status: "completed",
    })
  )

  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), {
    bookmarkId: "bookmark-1",
    title: "Plan",
    markdown: null,
    type: "document",
    status: "completed",
  })
})

test("obsidian sync delete validates the request body", async () => {
  const response = await handleObsidianSyncDelete("user-1", {}, async () => true)

  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.equal(payload.error, "Invalid request")
})
