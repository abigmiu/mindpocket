const FAVICON_SERVICE_URL = "https://favicon.hd.luler.top/api/favicon"

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

interface FaviconServiceResponse {
  faviconUrl?: string | null
}

export async function fetchFaviconUrl(
  url: string,
  fetchImpl: FetchLike = fetch
): Promise<string | null> {
  try {
    const response = await fetchImpl(FAVICON_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
      cache: "no-store",
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as FaviconServiceResponse | null
    const faviconUrl = data?.faviconUrl?.trim()
    return faviconUrl ? faviconUrl : null
  } catch (error) {
    console.warn("[favicon] Failed to fetch favicon:", error)
    return null
  }
}
