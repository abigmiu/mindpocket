import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { corsPreflight, withCors } from "@/lib/cors"
import {
  createUnauthorizedResponse,
  handleObsidianSyncDelete,
  handleObsidianSyncPost,
} from "@/lib/ingest/obsidian-route"

async function getAuthenticatedUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export function OPTIONS(req: Request) {
  return corsPreflight(req)
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return withCors(req, createUnauthorizedResponse())
  }

  const body = await parseJsonBody(req)
  const response = await handleObsidianSyncPost(userId, body)
  return withCors(req, response)
}

export async function DELETE(req: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return withCors(req, createUnauthorizedResponse())
  }

  const body = await parseJsonBody(req)
  const response = await handleObsidianSyncDelete(userId, body)
  return withCors(req, response)
}
