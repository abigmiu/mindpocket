import type { NoteSyncPayload } from "./note-model"

export interface SyncStateEntry {
  sourceKey: string
  hash: string
  mtime: number
  relativePath: string
}

export interface MindPocketSyncState {
  notes: Record<string, SyncStateEntry>
}

export function createEmptySyncState(): MindPocketSyncState {
  return { notes: {} }
}

function toSyncStateEntry(note: NoteSyncPayload): SyncStateEntry {
  return {
    sourceKey: note.sourceKey,
    hash: note.hash,
    mtime: note.mtime,
    relativePath: note.relativePath,
  }
}

export function buildSyncState(notes: NoteSyncPayload[]): MindPocketSyncState {
  return {
    notes: Object.fromEntries(notes.map((note) => [note.sourceKey, toSyncStateEntry(note)])),
  }
}

export function computeSyncPlan(
  previousState: MindPocketSyncState,
  currentNotes: NoteSyncPayload[]
) {
  const toUpsert = currentNotes.filter((note) => {
    const previous = previousState.notes[note.sourceKey]
    return !previous || previous.hash !== note.hash || previous.mtime !== note.mtime
  })

  const currentKeys = new Set(currentNotes.map((note) => note.sourceKey))
  const toDelete = Object.keys(previousState.notes).filter(
    (sourceKey) => !currentKeys.has(sourceKey)
  )

  return { toUpsert, toDelete }
}

export function upsertSyncStateEntry(state: MindPocketSyncState, note: NoteSyncPayload) {
  return {
    notes: {
      ...state.notes,
      [note.sourceKey]: toSyncStateEntry(note),
    },
  }
}

export function removeSyncStateEntry(state: MindPocketSyncState, sourceKey: string) {
  const nextNotes = { ...state.notes }
  delete nextNotes[sourceKey]

  return { notes: nextNotes }
}
