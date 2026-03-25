import type { App, TFile } from "obsidian"
import { deleteRemoteNote, upsertRemoteNote } from "./api-client"
import { buildSourceKey, type NoteSyncPayload, readVaultNote } from "./note-model"
import { buildPluginSettings, type MindPocketPluginSettings } from "./settings"
import {
  buildSyncState,
  computeSyncPlan,
  createEmptySyncState,
  type MindPocketSyncState,
  removeSyncStateEntry,
  upsertSyncStateEntry,
} from "./sync-state"

interface SyncEngineDeps {
  deleteRemoteNote: (serverUrl: string, token: string, sourceKey: string) => Promise<void>
  upsertRemoteNote: (serverUrl: string, token: string, note: NoteSyncPayload) => Promise<void>
}

const defaultDeps: SyncEngineDeps = {
  deleteRemoteNote,
  upsertRemoteNote,
}

function assertReadyForSync(settings: MindPocketPluginSettings) {
  if (!settings.serverUrl.trim()) {
    throw new Error("MindPocket server URL is required")
  }

  if (!settings.token.trim()) {
    throw new Error("MindPocket token is required")
  }
}

function isMarkdownFile(file: TFile) {
  return file.extension.toLowerCase() === "md"
}

export async function syncEntireVault(
  app: App,
  settings: MindPocketPluginSettings,
  state: MindPocketSyncState = createEmptySyncState(),
  deps: SyncEngineDeps = defaultDeps
) {
  assertReadyForSync(settings)

  const notes = await Promise.all(
    app.vault.getMarkdownFiles().map((file) => readVaultNote(app, file))
  )
  const plan = computeSyncPlan(state, notes)

  for (const note of plan.toUpsert) {
    await deps.upsertRemoteNote(settings.serverUrl, settings.token, note)
  }

  for (const sourceKey of plan.toDelete) {
    await deps.deleteRemoteNote(settings.serverUrl, settings.token, sourceKey)
  }

  return buildSyncState(notes)
}

export async function syncMarkdownFile(
  app: App,
  file: TFile,
  settings: MindPocketPluginSettings = buildPluginSettings(),
  state: MindPocketSyncState = createEmptySyncState(),
  deps: SyncEngineDeps = defaultDeps
) {
  if (!isMarkdownFile(file)) {
    return state
  }

  assertReadyForSync(settings)
  const note = await readVaultNote(app, file)
  const previous = state.notes[note.sourceKey]
  if (previous && previous.hash === note.hash && previous.mtime === note.mtime) {
    return state
  }

  await deps.upsertRemoteNote(settings.serverUrl, settings.token, note)
  return upsertSyncStateEntry(state, note)
}

export async function deleteMarkdownFile(
  vaultName: string,
  filePath: string,
  settings: MindPocketPluginSettings = buildPluginSettings(),
  state: MindPocketSyncState = createEmptySyncState(),
  deps: SyncEngineDeps = defaultDeps
) {
  assertReadyForSync(settings)

  const sourceKey = buildSourceKey(vaultName, filePath)
  if (!state.notes[sourceKey]) {
    return state
  }

  await deps.deleteRemoteNote(settings.serverUrl, settings.token, sourceKey)
  return removeSyncStateEntry(state, sourceKey)
}
