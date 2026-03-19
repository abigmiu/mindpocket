export type BookmarkSiteVisual =
  | { kind: "platform"; platform: string }
  | { kind: "favicon"; faviconUrl: string }
  | { kind: "domain" }

export function getBookmarkSiteVisual({
  platform,
  faviconUrl,
}: {
  platform: string | null
  faviconUrl: string | null
}): BookmarkSiteVisual {
  if (platform) {
    return { kind: "platform", platform }
  }

  const normalizedFaviconUrl = faviconUrl?.trim()
  if (normalizedFaviconUrl) {
    return { kind: "favicon", faviconUrl: normalizedFaviconUrl }
  }

  return { kind: "domain" }
}
