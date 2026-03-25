import type { NoteSyncPayload } from "./note-model"

const TRAILING_SLASH_REGEX = /\/+$/

interface ApiErrorPayload {
  error?: string
  message?: string
}

interface SignInResponse {
  token?: string
  data?: {
    token?: string
  }
  user?: {
    id: string
    name?: string
    email: string
  }
}

function normalizeServerUrl(serverUrl: string) {
  return serverUrl.trim().replace(TRAILING_SLASH_REGEX, "")
}

async function requestJson<T>(
  serverUrl: string,
  path: string,
  init: RequestInit,
  token?: string
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${normalizeServerUrl(serverUrl)}${path}`, {
    ...init,
    headers,
  })

  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | T | null
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && payload.message
        ? payload.message
        : "MindPocket request failed"
    throw new Error(message)
  }

  return payload as T
}

export async function signInToMindPocket(params: {
  serverUrl: string
  email: string
  password: string
}) {
  const result = await requestJson<SignInResponse>(params.serverUrl, "/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      password: params.password,
    }),
  })

  const token = result.token ?? result.data?.token
  if (!token) {
    throw new Error("Sign-in response did not include a bearer token")
  }

  return {
    token,
    user: result.user,
  }
}

export async function upsertRemoteNote(serverUrl: string, token: string, note: NoteSyncPayload) {
  await requestJson(
    serverUrl,
    "/api/obsidian/sync",
    {
      method: "POST",
      body: JSON.stringify(note),
    },
    token
  )
}

export async function deleteRemoteNote(serverUrl: string, token: string, sourceKey: string) {
  await requestJson(
    serverUrl,
    "/api/obsidian/sync",
    {
      method: "DELETE",
      body: JSON.stringify({ sourceKey }),
    },
    token
  )
}
