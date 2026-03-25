import assert from "node:assert/strict"
import test from "node:test"

async function loadFaviconModule() {
  try {
    return await import("./favicon")
  } catch {
    return null
  }
}

test("fetchFaviconUrl returns faviconUrl from the favicon service response", async () => {
  const faviconModule = await loadFaviconModule()
  const fetchFaviconUrl = faviconModule?.fetchFaviconUrl

  assert.equal(
    typeof fetchFaviconUrl,
    "function",
    "expected fetchFaviconUrl to be exported from ./favicon"
  )
  assert.ok(fetchFaviconUrl)

  const faviconUrl = await fetchFaviconUrl(
    "https://sr.deffun.top",
    async () =>
      new Response(
        JSON.stringify({
          faviconUrl: "https://sr.deffun.top/favicon.ico",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
  )

  assert.equal(faviconUrl, "https://sr.deffun.top/favicon.ico")
})

test("fetchFaviconUrl returns null when the favicon service has no faviconUrl", async () => {
  const faviconModule = await loadFaviconModule()
  const fetchFaviconUrl = faviconModule?.fetchFaviconUrl

  assert.equal(
    typeof fetchFaviconUrl,
    "function",
    "expected fetchFaviconUrl to be exported from ./favicon"
  )
  assert.ok(fetchFaviconUrl)

  const faviconUrl = await fetchFaviconUrl(
    "https://sr.deffun.top",
    async () =>
      new Response(JSON.stringify({ title: "拾软" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
  )

  assert.equal(faviconUrl, null)
})

test("fetchFaviconUrl returns null when the favicon service request fails", async () => {
  const faviconModule = await loadFaviconModule()
  const fetchFaviconUrl = faviconModule?.fetchFaviconUrl

  assert.equal(
    typeof fetchFaviconUrl,
    "function",
    "expected fetchFaviconUrl to be exported from ./favicon"
  )
  assert.ok(fetchFaviconUrl)

  const faviconUrl = await fetchFaviconUrl("https://sr.deffun.top", () =>
    Promise.reject(new Error("network failed"))
  )

  assert.equal(faviconUrl, null)
})
