const fs = require("node:fs/promises")
const path = require("node:path")
const { spawn } = require("node:child_process")

// ===== Import configuration =====
// 目标站点地址，必须是你已经登录并能正常访问的部署地址。
// 示例:
//   macOS / Linux: https://your-site.vercel.app
//   Windows:      https://your-site.vercel.app
const BASE_URL = ""
// 直接填写浏览器里当前有效的完整 Cookie 请求头内容。
// 示例:
//   "__Secure-better-auth.session_token=xxxx"
// 如果站点需要多个 cookie，可以直接用完整 Cookie 头:
//   "a=1; b=2; __Secure-better-auth.session_token=xxxx"
const COOKIE_HEADER = ""
// 浏览器导出的 Netscape Bookmark HTML 文件路径。
// 示例:
//   macOS / Linux: "/Users/yourname/Downloads/bookmarks.html"
//   Windows:      "C:\\Users\\yourname\\Downloads\\bookmarks.html"
const BOOKMARK_HTML_PATH = ""
// true: 只预演，不真正写入；false: 真正导入。
const DRY_RUN = false
// true: 导入前清空当前账号下的全部书签和文件夹；false: 保留现有数据。
const PURGE_EXISTING_BEFORE_IMPORT = false
// true: 打印每次 API 的请求和响应；排障时打开，平时建议关闭。
const DEBUG_API = false
// 如果当前网络需要代理才能访问部署地址，在这里填写代理地址；不需要就留空。
// 示例:
//   "http://127.0.0.1:7897"
//   "socks5://127.0.0.1:7897"
const CURL_PROXY = ""
// 导入并发数。过大容易触发站点超时或代理拥塞。
const CONCURRENCY = 3
const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 1000
const REQUEST_TIMEOUT_MS = 30_000
const PAGE_LIMIT = 100
const DEFAULT_FOLDER_EMOJI = "📁"
// 浏览器自带容器目录不导入为业务文件夹，只用来辅助解析路径。
const CONTAINER_FOLDER_NAMES = ["收藏夹栏", "Bookmarks bar", "书签栏"]
const TOKEN_REGEX =
  /<DT><H3\b[^>]*>([\s\S]*?)<\/H3>|<DT><A\b([^>]*)>([\s\S]*?)<\/A>|<DL><p>|<\/DL><p>/gi
const HREF_REGEX = /HREF="([^"]+)"/i
const TRAILING_SLASH_REGEX = /\/$/

function decodeHtmlEntities(input) {
  if (!input) {
    return ""
  }

  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)))
}

function stripTags(input) {
  return input.replace(/<[^>]+>/g, "")
}

function normalizeText(input) {
  return String(input || "").trim()
}

function normalizeFolderKey(input) {
  return normalizeText(input).toLocaleLowerCase("zh-CN")
}

async function validateConfig() {
  const errors = []

  if (!normalizeText(BASE_URL)) {
    errors.push('BASE_URL 未填写，例如: "https://your-site.vercel.app"')
  }

  if (!normalizeText(COOKIE_HEADER)) {
    errors.push('COOKIE_HEADER 未填写，请填入浏览器里复制出来的完整 Cookie')
  }

  if (!normalizeText(BOOKMARK_HTML_PATH)) {
    errors.push(
      'BOOKMARK_HTML_PATH 未填写，例如 macOS: "/Users/yourname/Downloads/bookmarks.html"，Windows: "C:\\\\Users\\\\yourname\\\\Downloads\\\\bookmarks.html"'
    )
  }

  if (errors.length > 0) {
    throw new Error(`配置不完整:\n- ${errors.join("\n- ")}`)
  }

  const absoluteBookmarkPath = path.resolve(BOOKMARK_HTML_PATH)
  await fs.access(absoluteBookmarkPath).catch(() => {
    throw new Error(`BOOKMARK_HTML_PATH 指向的文件不存在: ${absoluteBookmarkPath}`)
  })
}

function isContainerFolder(name) {
  const normalized = normalizeFolderKey(name)
  return CONTAINER_FOLDER_NAMES.some((item) => normalizeFolderKey(item) === normalized)
}

function normalizeUrl(input) {
  const trimmed = normalizeText(input)
  if (!trimmed) {
    return null
  }

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return null
  }

  parsed.protocol = parsed.protocol.toLowerCase()
  parsed.hostname = parsed.hostname.toLowerCase()
  parsed.hash = ""

  if (!parsed.pathname) {
    parsed.pathname = "/"
  }

  return parsed.toString()
}

// MindPocket 只有单层 folder，这里把多级浏览器目录折叠成“真实顶级目录”。
function extractTopLevelFolder(pathSegments) {
  const filtered = pathSegments.map(normalizeText).filter(Boolean).filter((item) => !isContainerFolder(item))
  return filtered[0] || null
}

// 解析浏览器导出的 Netscape Bookmark HTML。
function parseBookmarksHtml(html) {
  TOKEN_REGEX.lastIndex = 0
  const root = { name: null, kind: "root" }
  const stack = [root]
  let pendingFolderName = null
  const bookmarks = []

  for (let match = TOKEN_REGEX.exec(html); match !== null; match = TOKEN_REGEX.exec(html)) {
    const token = match[0]

    if (token.startsWith("<DT><H3")) {
      pendingFolderName = normalizeText(decodeHtmlEntities(stripTags(match[1])))
      continue
    }

    if (token.startsWith("<DT><A")) {
      const attrs = match[2] || ""
      const title = normalizeText(decodeHtmlEntities(stripTags(match[3] || "")))
      const hrefMatch = attrs.match(HREF_REGEX)
      const rawUrl = hrefMatch ? decodeHtmlEntities(hrefMatch[1]) : ""
      const pathSegments = stack.map((entry) => entry.name).filter(Boolean)
      const topLevelFolder = extractTopLevelFolder(pathSegments)

      bookmarks.push({
        title: title || rawUrl,
        rawUrl,
        sourcePath: pathSegments,
        targetFolderName: topLevelFolder,
      })
      continue
    }

    if (token === "<DL><p>") {
      if (pendingFolderName) {
        stack.push({ name: pendingFolderName, kind: "folder" })
        pendingFolderName = null
      } else {
        stack.push({ name: null, kind: "group" })
      }
      continue
    }

    if (token === "</DL><p>") {
      if (stack.length > 1) {
        stack.pop()
      }
      pendingFolderName = null
    }
  }

  return bookmarks
}

async function parseBookmarkFile(filePath) {
  const absolutePath = path.resolve(filePath)
  const html = await fs.readFile(absolutePath, "utf8")
  return parseBookmarksHtml(html)
}

function createHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders }
  if (COOKIE_HEADER) {
    headers.Cookie = COOKIE_HEADER
  }

  return headers
}

function parseResponseBody(_contentType, text) {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function truncateForLog(value, maxLength = 800) {
  const text =
    typeof value === "string"
      ? value
      : (() => {
          try {
            return JSON.stringify(value)
          } catch {
            return String(value)
          }
        })()

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`
}

function logApiDebug(stage, payload) {
  if (!DEBUG_API) {
    return
  }

  console.log(`\n🔎 [API ${stage}]`)
  for (const [key, value] of Object.entries(payload)) {
    console.log(`${key}: ${truncateForLog(value)}`)
  }
}

// 脚本统一通过 curl 发请求，复用当前机器已经验证可用的代理和 TLS 链路。
function runCurl(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", args, {
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8")
    })

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8")
    })

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `curl exited with code ${code}`))
        return
      }

      resolve(stdout)
    })
  })
}

function buildCurlArgs(url, method, headers, body) {
  const curlArgs = ["-sS"]

  if (normalizeText(CURL_PROXY)) {
    curlArgs.push("--proxy", CURL_PROXY)
  }

  curlArgs.push(
    "--connect-timeout",
    String(Math.ceil(REQUEST_TIMEOUT_MS / 1000)),
    "--max-time",
    String(Math.ceil(REQUEST_TIMEOUT_MS / 1000)),
    "-X",
    method,
    "-o",
    "-",
    "-w",
    "\n__CURL_STATUS__:%{http_code}",
  )

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) {
      continue
    }

    curlArgs.push("-H", `${key}: ${value}`)
  }

  if (body) {
    curlArgs.push("--data-raw", body)
  }

  curlArgs.push(url.toString())
  return curlArgs
}

function parseCurlResponse(rawResponse, url) {
  const marker = "\n__CURL_STATUS__:"
  const markerIndex = rawResponse.lastIndexOf(marker)
  if (markerIndex === -1) {
    throw new Error(`请求 ${url.toString()} 失败: 无法解析 curl 输出`)
  }

  const bodyText = rawResponse.slice(0, markerIndex)
  const statusCode = Number.parseInt(rawResponse.slice(markerIndex + marker.length).trim(), 10)
  if (Number.isNaN(statusCode)) {
    throw new Error(`请求 ${url.toString()} 失败: 无法解析 curl 状态码`)
  }

  return { statusCode, bodyText }
}

async function apiRequest(endpoint, options = {}) {
  const baseUrl = normalizeText(BASE_URL)
  if (!baseUrl) {
    throw new Error("BASE_URL is empty. Fill it in before running the import.")
  }

  const url = new URL(`${baseUrl.replace(TRAILING_SLASH_REGEX, "")}${endpoint}`)
  const method = options.method || "GET"
  const headers = createHeaders(options.headers)
  const body = options.body
  const curlArgs = buildCurlArgs(url, method, headers, body)

  logApiDebug("REQUEST", {
    endpoint,
    method,
    url: url.toString(),
    headers: {
      ...headers,
      Cookie: headers.Cookie ? "[redacted]" : undefined,
    },
    body: body || "",
  })

  let rawResponse = ""
  let bodyText = ""
  rawResponse = await runCurl(curlArgs).catch((error) => {
    throw new Error(`请求 ${url.toString()} 失败: ${error.message}`)
  })

  const { statusCode, bodyText: parsedBodyText } = parseCurlResponse(rawResponse, url)
  bodyText = parsedBodyText
  const data = parseResponseBody("", bodyText)

  logApiDebug("RESPONSE", {
    endpoint,
    statusCode,
    body: data ?? bodyText,
  })

  if (statusCode < 200 || statusCode >= 300) {
    const message =
      (data && typeof data === "object" && (data.error || data.message)) ||
      `Request failed with status ${statusCode}`
    const error = new Error(`${endpoint}: ${message}`)
    error.status = statusCode
    error.data = data
    throw error
  }

  return data
}

async function verifySession() {
  if (!normalizeText(COOKIE_HEADER)) {
    throw new Error("COOKIE_HEADER is empty. Fill it in with your browser session cookie.")
  }

  const data = await apiRequest("/api/user", { method: "GET" })
  console.log(`👤 当前登录用户: ${data.email || data.name || "unknown"}`)
  return data
}

async function fetchFolders() {
  const data = await apiRequest("/api/folders", { method: "GET" })
  return Array.isArray(data.folders) ? data.folders : []
}

function createFolder(name) {
  return apiRequest("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      emoji: DEFAULT_FOLDER_EMOJI,
    }),
  })
}

function deleteFolder(folderId) {
  return apiRequest("/api/folders", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: folderId }),
  })
}

function deleteBookmark(bookmarkId) {
  return apiRequest(`/api/bookmarks/${bookmarkId}`, {
    method: "DELETE",
  })
}

function updateBookmarkFolder(bookmarkId, folderId) {
  return apiRequest(`/api/bookmarks/${bookmarkId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId }),
  })
}

async function fetchExistingBookmarks() {
  const bookmarks = []
  let offset = 0

  for (;;) {
    const data = await apiRequest(`/api/bookmarks?limit=${PAGE_LIMIT}&offset=${offset}`, {
      method: "GET",
    })
    const items = Array.isArray(data.bookmarks) ? data.bookmarks : []

    for (const item of items) {
      bookmarks.push({
        id: item.id,
        url: item.url,
        folderId: item.folderId ?? null,
      })
    }

    if (!data.hasMore || items.length < PAGE_LIMIT) {
      break
    }

    offset += PAGE_LIMIT
  }

  return bookmarks
}

function toUrlSet(bookmarks) {
  const urls = new Set()
  for (const item of bookmarks) {
    const normalized = normalizeUrl(item.url)
    if (normalized) {
      urls.add(normalized)
    }
  }
  return urls
}

function toUrlMap(bookmarks) {
  const map = new Map()
  for (const item of bookmarks) {
    const normalized = normalizeUrl(item.url)
    if (normalized && !map.has(normalized)) {
      map.set(normalized, item)
    }
  }
  return map
}

function buildImportList(parsedBookmarks) {
  const results = {
    ready: [],
    skippedInvalid: [],
    skippedDuplicateInFile: [],
  }

  const seenUrls = new Set()

  for (const entry of parsedBookmarks) {
    const normalized = normalizeUrl(entry.rawUrl)

    if (!normalized) {
      results.skippedInvalid.push(entry)
      continue
    }

    if (seenUrls.has(normalized)) {
      results.skippedDuplicateInFile.push({ ...entry, normalizedUrl: normalized })
      continue
    }

    seenUrls.add(normalized)
    results.ready.push({
      ...entry,
      normalizedUrl: normalized,
    })
  }

  return results
}

async function ensureFolders(bookmarks, stats) {
  const folderNames = Array.from(
    new Set(bookmarks.map((item) => item.targetFolderName).filter(Boolean).map(normalizeText))
  )

  const existingFolders = await fetchFolders()
  const folderMap = new Map()

  for (const folder of existingFolders) {
    folderMap.set(normalizeFolderKey(folder.name), folder)
  }

  for (const folderName of folderNames) {
    const key = normalizeFolderKey(folderName)
    if (folderMap.has(key)) {
      stats.reusedFolders += 1
      continue
    }

    if (DRY_RUN) {
      stats.createdFolders += 1
      folderMap.set(key, { id: `dry-run:${folderName}`, name: folderName })
      continue
    }

    const data = await createFolder(folderName)
    folderMap.set(key, data.folder)
    stats.createdFolders += 1
    console.log(`📁 创建文件夹: ${folderName}`)
  }

  return folderMap
}

async function purgeExistingData(stats) {
  const [existingBookmarks, existingFolders] = await Promise.all([fetchExistingBookmarks(), fetchFolders()])

  stats.deletedBookmarks = existingBookmarks.length
  stats.deletedFolders = existingFolders.length

  console.log(`🗑️ 准备删除现有书签: ${existingBookmarks.length}`)
  console.log(`🗑️ 准备删除现有文件夹: ${existingFolders.length}`)

  if (DRY_RUN) {
    console.log("🧪 Dry-run 模式下不会真的删除现有数据。")
    return { existingBookmarks, existingFolders }
  }

  const bookmarkDeleteResults = await runWithConcurrency(
    existingBookmarks,
    CONCURRENCY,
    (item) => deleteBookmark(item.id)
  )
  const failedBookmarkDeletes = bookmarkDeleteResults.filter((item) => item.status === "rejected")
  if (failedBookmarkDeletes.length > 0) {
    throw new Error(`删除现有书签失败 ${failedBookmarkDeletes.length} 条，请先处理后再重试。`)
  }

  const folderDeleteResults = await runWithConcurrency(
    existingFolders,
    CONCURRENCY,
    (item) => deleteFolder(item.id)
  )
  const failedFolderDeletes = folderDeleteResults.filter((item) => item.status === "rejected")
  if (failedFolderDeletes.length > 0) {
    throw new Error(`删除现有文件夹失败 ${failedFolderDeletes.length} 个，请先处理后再重试。`)
  }

  console.log("✅ 已清空现有书签和文件夹")
  return { existingBookmarks: [], existingFolders: [] }
}

// 对已经存在的 URL，不重新导入，只把 folder 归属补齐到期望值。
async function reconcileExistingBookmarks(bookmarksWithFolders, existingBookmarkMap, stats) {
  const updates = []

  for (const item of bookmarksWithFolders) {
    const existing = existingBookmarkMap.get(item.normalizedUrl)
    if (!existing) {
      continue
    }

    const expectedFolderId = item.folderId ?? null
    const currentFolderId = existing.folderId ?? null

    if (expectedFolderId === currentFolderId) {
      continue
    }

    updates.push({
      bookmarkId: existing.id,
      folderId: expectedFolderId,
      title: item.title,
      normalizedUrl: item.normalizedUrl,
    })
  }

  stats.folderFixesPlanned = updates.length

  if (updates.length === 0) {
    return
  }

  console.log(`🩹 准备修正已有书签 folder 归属: ${updates.length}`)

  if (DRY_RUN) {
    console.log("🧪 Dry-run 模式下不会真的修正已有书签 folder。")
    return
  }

  const results = await runWithConcurrency(updates, CONCURRENCY, (item) =>
    updateBookmarkFolder(item.bookmarkId, item.folderId)
  )
  const failed = results.filter((item) => item.status === "rejected")
  stats.folderFixesApplied = updates.length - failed.length
  stats.folderFixesFailed = failed.length

  if (failed.length > 0) {
    console.log(`⚠️ 书签 folder 修正失败: ${failed.length}`)
  }
}

function attachFolderIds(bookmarks, folderMap) {
  return bookmarks.map((item) => {
    if (!item.targetFolderName) {
      return { ...item, folderId: null }
    }

    const folder = folderMap.get(normalizeFolderKey(item.targetFolderName))
    return {
      ...item,
      folderId: folder ? folder.id : null,
    }
  })
}

function getRetryDelay(attempt) {
  return RETRY_BASE_DELAY_MS * 2 ** attempt
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ingestBookmark(item) {
  return apiRequest("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: item.normalizedUrl,
      title: item.title,
      folderId: item.folderId || undefined,
      clientSource: "web",
    }),
  })
}

async function ingestWithRetry(item) {
  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await ingestBookmark(item)
      if (item.folderId && result?.bookmarkId) {
        await updateBookmarkFolder(result.bookmarkId, item.folderId)
      }
      return result
    } catch (error) {
      lastError = error
      const status = error && typeof error === "object" ? error.status : undefined
      const canRetry = status === 429 || (typeof status === "number" && status >= 500)

      if (!canRetry || attempt === MAX_RETRIES) {
        throw error
      }

      await sleep(getRetryDelay(attempt))
    }
  }

  throw lastError
}

async function runWithConcurrency(items, concurrency, handler) {
  const results = new Array(items.length)
  let index = 0

  async function worker() {
    for (;;) {
      const currentIndex = index
      index += 1

      if (currentIndex >= items.length) {
        return
      }

      try {
        results[currentIndex] = { status: "fulfilled", value: await handler(items[currentIndex]) }
      } catch (error) {
        results[currentIndex] = { status: "rejected", reason: error }
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

function printSample(title, items, formatter) {
  if (items.length === 0) {
    return
  }

  console.log(title)
  for (const item of items.slice(0, 5)) {
    console.log(`  - ${formatter(item)}`)
  }
  if (items.length > 5) {
    console.log(`  - ... 共 ${items.length} 条`)
  }
}

async function main() {
  console.log("📥 开始导入浏览器书签...")
  await validateConfig()

  const parsedBookmarks = await parseBookmarkFile(BOOKMARK_HTML_PATH)
  const prepared = buildImportList(parsedBookmarks)

  const stats = {
    sourceBookmarks: parsedBookmarks.length,
    readyBookmarks: prepared.ready.length,
    createdFolders: 0,
    reusedFolders: 0,
    deletedBookmarks: 0,
    deletedFolders: 0,
    folderFixesPlanned: 0,
    folderFixesApplied: 0,
    folderFixesFailed: 0,
    skippedInvalid: prepared.skippedInvalid.length,
    skippedDuplicateInFile: prepared.skippedDuplicateInFile.length,
    skippedDuplicateExisting: 0,
    imported: 0,
    failed: 0,
  }

  console.log(`📚 源书签数: ${stats.sourceBookmarks}`)
  console.log(`🧹 过滤后待处理: ${stats.readyBookmarks}`)

  printSample("⚠️ 跳过的非法 URL 示例:", prepared.skippedInvalid, (item) => `${item.title} -> ${item.rawUrl}`)
  printSample(
    "♻️ 文件内重复 URL 示例:",
    prepared.skippedDuplicateInFile,
    (item) => `${item.title} -> ${item.normalizedUrl}`
  )

  await verifySession()

  let existingBookmarks = await fetchExistingBookmarks()
  if (PURGE_EXISTING_BEFORE_IMPORT) {
    const purgeResult = await purgeExistingData(stats)
    existingBookmarks = purgeResult.existingBookmarks
  }

  const folderMap = await ensureFolders(prepared.ready, stats)
  const bookmarksWithFolders = attachFolderIds(prepared.ready, folderMap)
  const existingUrls = PURGE_EXISTING_BEFORE_IMPORT ? new Set() : toUrlSet(existingBookmarks)
  const existingBookmarkMap = PURGE_EXISTING_BEFORE_IMPORT ? new Map() : toUrlMap(existingBookmarks)

  await reconcileExistingBookmarks(bookmarksWithFolders, existingBookmarkMap, stats)

  const importQueue = []
  for (const item of bookmarksWithFolders) {
    if (existingUrls.has(item.normalizedUrl)) {
      stats.skippedDuplicateExisting += 1
      continue
    }

    importQueue.push(item)
  }

  console.log(`📁 复用文件夹: ${stats.reusedFolders}`)
  console.log(`🆕 创建文件夹: ${stats.createdFolders}`)
  console.log(`🗑️ 删除旧书签: ${stats.deletedBookmarks}`)
  console.log(`🗑️ 删除旧文件夹: ${stats.deletedFolders}`)
  console.log(`🩹 计划修正 folder: ${stats.folderFixesPlanned}`)
  console.log(`🩹 已修正 folder: ${stats.folderFixesApplied}`)
  console.log(`🩹 修正失败 folder: ${stats.folderFixesFailed}`)
  console.log(`♻️ 目标站点已存在 URL，跳过: ${stats.skippedDuplicateExisting}`)
  console.log(`🚀 实际准备导入: ${importQueue.length}`)

  if (DRY_RUN) {
    printSample(
      "🧪 Dry-run 导入示例:",
      importQueue,
      (item) => `${item.targetFolderName || "无文件夹"} | ${item.title} -> ${item.normalizedUrl}`
    )
    console.log("✅ Dry-run 完成，未执行任何写入请求。")
    return
  }

  const results = await runWithConcurrency(importQueue, CONCURRENCY, ingestWithRetry)

  const failures = []
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i]
    if (result.status === "fulfilled") {
      stats.imported += 1
      existingUrls.add(importQueue[i].normalizedUrl)
      continue
    }

    stats.failed += 1
    failures.push({
      item: importQueue[i],
      error: result.reason,
    })
  }

  if (failures.length > 0) {
    printSample(
      "❌ 导入失败示例:",
      failures,
      ({ item, error }) => `${item.title} -> ${item.normalizedUrl} | ${error.message}`
    )
  }

  console.log("📊 导入完成")
  console.log(`  - 源书签: ${stats.sourceBookmarks}`)
  console.log(`  - 成功导入: ${stats.imported}`)
  console.log(`  - 创建文件夹: ${stats.createdFolders}`)
  console.log(`  - 复用文件夹: ${stats.reusedFolders}`)
  console.log(`  - 删除旧书签: ${stats.deletedBookmarks}`)
  console.log(`  - 删除旧文件夹: ${stats.deletedFolders}`)
  console.log(`  - 计划修正 folder: ${stats.folderFixesPlanned}`)
  console.log(`  - 已修正 folder: ${stats.folderFixesApplied}`)
  console.log(`  - 修正失败 folder: ${stats.folderFixesFailed}`)
  console.log(`  - 跳过非法 URL: ${stats.skippedInvalid}`)
  console.log(`  - 跳过文件内重复: ${stats.skippedDuplicateInFile}`)
  console.log(`  - 跳过目标站点重复: ${stats.skippedDuplicateExisting}`)
  console.log(`  - 失败: ${stats.failed}`)

  if (stats.failed > 0) {
    process.exitCode = 1
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ 导入失败:", error)
    process.exit(1)
  })
}

module.exports = {
  parseBookmarksHtml,
  parseBookmarkFile,
  normalizeUrl,
  extractTopLevelFolder,
}
