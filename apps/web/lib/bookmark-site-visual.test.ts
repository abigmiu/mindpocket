import assert from "node:assert/strict"
import test from "node:test"

async function loadBookmarkSiteVisualModule() {
  try {
    return await import("./bookmark-site-visual")
  } catch {
    return null
  }
}

test("getBookmarkSiteVisual prefers platform icons over favicons", async () => {
  const siteVisualModule = await loadBookmarkSiteVisualModule()
  const getBookmarkSiteVisual = siteVisualModule?.getBookmarkSiteVisual

  assert.equal(
    typeof getBookmarkSiteVisual,
    "function",
    "expected getBookmarkSiteVisual to be exported from ./bookmark-site-visual"
  )
  assert.ok(getBookmarkSiteVisual)

  const visual = getBookmarkSiteVisual({
    platform: "github",
    faviconUrl: "https://github.com/favicon.ico",
  })

  assert.deepEqual(visual, {
    kind: "platform",
    platform: "github",
  })
})

test("getBookmarkSiteVisual uses favicon when there is no platform icon", async () => {
  const siteVisualModule = await loadBookmarkSiteVisualModule()
  const getBookmarkSiteVisual = siteVisualModule?.getBookmarkSiteVisual

  assert.equal(
    typeof getBookmarkSiteVisual,
    "function",
    "expected getBookmarkSiteVisual to be exported from ./bookmark-site-visual"
  )
  assert.ok(getBookmarkSiteVisual)

  const visual = getBookmarkSiteVisual({
    platform: null,
    faviconUrl: "https://sr.deffun.top/favicon.ico",
  })

  assert.deepEqual(visual, {
    kind: "favicon",
    faviconUrl: "https://sr.deffun.top/favicon.ico",
  })
})

test("getBookmarkSiteVisual falls back to domain when there is no platform icon or favicon", async () => {
  const siteVisualModule = await loadBookmarkSiteVisualModule()
  const getBookmarkSiteVisual = siteVisualModule?.getBookmarkSiteVisual

  assert.equal(
    typeof getBookmarkSiteVisual,
    "function",
    "expected getBookmarkSiteVisual to be exported from ./bookmark-site-visual"
  )
  assert.ok(getBookmarkSiteVisual)

  const visual = getBookmarkSiteVisual({
    platform: null,
    faviconUrl: null,
  })

  assert.deepEqual(visual, {
    kind: "domain",
  })
})
