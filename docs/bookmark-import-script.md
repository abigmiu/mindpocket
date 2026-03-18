# Bookmark Import Script

使用根目录脚本 [import-browser-bookmarks.js](/Users/ikaros/Documents/code/mindpocket/import-browser-bookmarks.js) 将浏览器导出的书签 HTML 导入到你部署的 MindPocket 实例。

## 适用场景

- 导入浏览器导出的 Netscape Bookmark HTML 文件
- 自动创建 MindPocket 文件夹
- 按浏览器真实顶级目录映射到单层 folder
- 支持重复 URL 跳过
- 支持已有书签 folder 归属自动修正

## 使用前准备

1. 从浏览器导出书签 HTML 文件
2. 登录你部署的 MindPocket 站点
3. 从浏览器 DevTools 里复制有效的 Cookie

## 配置脚本

打开 [import-browser-bookmarks.js](/Users/ikaros/Documents/code/mindpocket/import-browser-bookmarks.js)，修改顶部配置区：

```js
const BASE_URL = "https://your-site.vercel.app"
const COOKIE_HEADER = "__Secure-better-auth.session_token=xxxx"
const BOOKMARK_HTML_PATH = "/Users/yourname/Downloads/bookmarks.html"
const DRY_RUN = false
const PURGE_EXISTING_BEFORE_IMPORT = false
const DEBUG_API = false
const CURL_PROXY = ""
```

### Windows 路径示例

```js
const BOOKMARK_HTML_PATH = "C:\\Users\\yourname\\Downloads\\bookmarks.html"
```

### 代理示例

如果当前网络需要代理访问部署地址：

```js
const CURL_PROXY = "http://127.0.0.1:7897"
```

如果不需要代理：

```js
const CURL_PROXY = ""
```

## 运行方式

在仓库根目录执行：

```bash
node import-browser-bookmarks.js
```

## 常用开关

- `DRY_RUN = true`
  - 只预演，不真正写入
- `DRY_RUN = false`
  - 真正导入
- `PURGE_EXISTING_BEFORE_IMPORT = true`
  - 导入前删除当前账号下所有书签和文件夹，再重新导入
- `PURGE_EXISTING_BEFORE_IMPORT = false`
  - 保留现有数据
- `DEBUG_API = true`
  - 打印 API 请求和响应，便于排查问题

## 文件夹映射规则

MindPocket 当前只有单层 folder，所以脚本会把多级浏览器目录折叠为“真实顶级目录”。

示例：

- 浏览器路径：`收藏夹栏 / 教程 / office / ppt / 某书签`
- 导入后 folder：`教程`

浏览器容器目录如：

- `收藏夹栏`
- `Bookmarks bar`
- `书签栏`

不会被导入为业务文件夹。

## 注意事项

- `COOKIE_HEADER` 必须是当前仍然有效的登录态
- 如果导入时网络不稳定，脚本会自动对部分失败请求重试
- 如果导入后发现已有书签 folder 不对，脚本会自动补一次 `folderId`
