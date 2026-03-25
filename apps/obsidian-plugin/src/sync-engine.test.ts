import assert from "node:assert/strict"
import test from "node:test"
import { createNoteSyncPayload } from "./note-model"
import { buildPluginSettings } from "./settings"
import { computeSyncPlan, createEmptySyncState } from "./sync-state"

test("buildPluginSettings returns defaults for server sync", () => {
  assert.deepEqual(buildPluginSettings(), {
    serverUrl: "",
    email: "",
    token: "",
    autoSync: true,
  })
})

test("toSyncPayload creates stable sourceKey and deep link metadata", async () => {
  const payload = await createNoteSyncPayload({
    vaultName: "Vault",
    relativePath: "Inbox/Plan.md",
    markdown: "# Plan\n\nBody",
    mtime: 1000,
  })

  assert.equal(payload.sourceKey, "obsidian:Vault:Inbox/Plan.md")
  assert.equal(payload.clientSource, "obsidian")
  assert.equal(payload.title, "Plan")
})

test("computeSyncPlan marks missing local files as remote deletes", async () => {
  const currentNote = await createNoteSyncPayload({
    vaultName: "Vault",
    relativePath: "Inbox/New.md",
    markdown: "# New\n\nBody",
    mtime: 2000,
  })

  const plan = computeSyncPlan(
    {
      notes: {
        "obsidian:Vault:Inbox/Old.md": {
          hash: "old-hash",
          mtime: 1000,
          relativePath: "Inbox/Old.md",
          sourceKey: "obsidian:Vault:Inbox/Old.md",
        },
      },
    },
    [currentNote]
  )

  assert.deepEqual(plan.toDelete, ["obsidian:Vault:Inbox/Old.md"])
  assert.equal(plan.toUpsert.length, 1)
  assert.deepEqual(createEmptySyncState(), { notes: {} })
})
