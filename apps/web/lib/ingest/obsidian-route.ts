import type { IngestResult } from "@repo/types"
import type { ZodFlattenedError } from "zod"
import { deleteObsidianNote, type ObsidianUpsertInput, upsertObsidianNote } from "./obsidian"
import { obsidianDeleteSchema, obsidianUpsertSchema } from "./types"

type ObsidianUpsertHandler = (userId: string, input: ObsidianUpsertInput) => Promise<IngestResult>
type ObsidianDeleteHandler = (userId: string, sourceKey: string) => Promise<boolean>

function createInvalidRequestResponse(details: ZodFlattenedError<unknown>) {
  return Response.json({ error: "Invalid request", details }, { status: 400 })
}

export function createUnauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}

export async function handleObsidianSyncPost(
  userId: string,
  body: unknown,
  upsert: ObsidianUpsertHandler = upsertObsidianNote
) {
  const parsed = obsidianUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return createInvalidRequestResponse(parsed.error.flatten())
  }

  const result = await upsert(userId, parsed.data)
  return Response.json(result, { status: 201 })
}

export async function handleObsidianSyncDelete(
  userId: string,
  body: unknown,
  remove: ObsidianDeleteHandler = deleteObsidianNote
) {
  const parsed = obsidianDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return createInvalidRequestResponse(parsed.error.flatten())
  }

  const deleted = await remove(userId, parsed.data.sourceKey)
  return Response.json({ deleted }, { status: 200 })
}
