"use client"

import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  Loader2,
  Monitor,
  Pencil,
  Puzzle,
  Save,
  Tag,
  User,
} from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useState } from "react"
import { hasPlatformIcon, PlatformIcon } from "@/components/icons/platform-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })
const MDPreview = dynamic(() => import("@uiw/react-md-editor").then((m) => m.default.Markdown), {
  ssr: false,
})

interface BookmarkTag {
  id: string
  name: string
  color: string | null
}

interface BookmarkDetail {
  id: string
  type: string
  title: string
  description: string | null
  url: string | null
  content: string | null
  coverImage: string | null
  faviconUrl: string | null
  isFavorite: boolean
  sourceType: string | null
  fileUrl: string | null
  fileExtension: string | null
  ingestStatus: string
  ingestError: string | null
  platform: string | null
  author: string | null
  language: string | null
  sourceCreatedAt: Date | null
  createdAt: Date
  updatedAt: Date
  folderId: string | null
  folderName: string | null
  folderEmoji: string | null
  tags: BookmarkTag[]
}

export function BookmarkDetailClient({ bookmark }: { bookmark: BookmarkDetail }) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(bookmark.content ?? "")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        setIsEditing(false)
      }
    } finally {
      setIsSaving(false)
    }
  }, [bookmark.id, content])

  return (
    <SidebarInset className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex h-full flex-col">
        <Header
          bookmark={bookmark}
          isEditing={isEditing}
          isSaving={isSaving}
          onEdit={() => setIsEditing(true)}
          onSave={handleSave}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-6">
            <MetadataSection bookmark={bookmark} />
            <Separator className="my-6" />
            <ContentSection content={content} isEditing={isEditing} onContentChange={setContent} />
          </div>
        </div>
      </div>
    </SidebarInset>
  )
}

function Header({
  bookmark,
  isEditing,
  isSaving,
  onEdit,
  onSave,
}: {
  bookmark: BookmarkDetail
  isEditing: boolean
  isSaving: boolean
  onEdit: () => void
  onSave: () => void
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background">
      <div className="flex flex-1 items-center gap-2 px-3">
        <SidebarTrigger />
        <Separator className="mr-2 data-[orientation=vertical]:h-4" orientation="vertical" />
        <Link
          className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          href="/"
        >
          <ArrowLeft className="size-4" />
          返回
        </Link>
        <Separator className="mx-2 data-[orientation=vertical]:h-4" orientation="vertical" />
        <span className="line-clamp-1 flex-1 text-sm font-medium">{bookmark.title}</span>
      </div>
      <div className="flex items-center gap-2 px-3">
        {bookmark.url && (
          <Button asChild size="sm" variant="ghost">
            <a href={bookmark.url} rel="noopener noreferrer" target="_blank">
              <ExternalLink className="mr-1 size-3.5" />
              原始链接
            </a>
          </Button>
        )}
        {isEditing ? (
          <Button disabled={isSaving} onClick={onSave} size="sm">
            {isSaving ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 size-3.5" />
            )}
            保存
          </Button>
        ) : (
          <Button onClick={onEdit} size="sm" variant="outline">
            <Pencil className="mr-1 size-3.5" />
            编辑
          </Button>
        )}
      </div>
    </header>
  )
}

function getSourceLabel(sourceType: string | null) {
  switch (sourceType) {
    case "url":
      return { label: "Web", icon: Monitor }
    case "extension":
      return { label: "Extension", icon: Puzzle }
    case "file":
      return { label: "File", icon: FileText }
    default:
      return { label: "Web", icon: Monitor }
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case "link":
      return "链接"
    case "article":
      return "文章"
    case "video":
      return "视频"
    case "image":
      return "图片"
    default:
      return type
  }
}

function MetadataSection({ bookmark }: { bookmark: BookmarkDetail }) {
  const source = getSourceLabel(bookmark.sourceType)
  const SourceIcon = source.icon

  return (
    <div className="space-y-5">
      {/* 标题 */}
      <h1 className="text-2xl font-bold leading-tight">{bookmark.title}</h1>

      {/* 描述 */}
      {bookmark.description && (
        <p className="text-muted-foreground leading-relaxed">{bookmark.description}</p>
      )}

      {/* 属性列表 - 竖向排列 */}
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        {/* 平台 */}
        {bookmark.platform && (
          <>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="size-3.5" />
              平台
            </span>
            <span className="flex items-center gap-1.5">
              {hasPlatformIcon(bookmark.platform) ? (
                <PlatformIcon className="size-4" platform={bookmark.platform} />
              ) : (
                <Globe className="size-4 text-muted-foreground" />
              )}
              <span className="capitalize">{bookmark.platform}</span>
            </span>
          </>
        )}

        {/* 来源 */}
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <SourceIcon className="size-3.5" />
          来源
        </span>
        <span>
          <Badge className="text-xs" variant="outline">
            {source.label}
          </Badge>
        </span>

        {/* 类型 */}
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <FileText className="size-3.5" />
          类型
        </span>
        <span>{getTypeLabel(bookmark.type)}</span>

        {/* 作者 */}
        {bookmark.author && (
          <>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <User className="size-3.5" />
              作者
            </span>
            <span>{bookmark.author}</span>
          </>
        )}

        {/* 文件夹 */}
        {bookmark.folderName && (
          <>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <FolderOpen className="size-3.5" />
              文件夹
            </span>
            <span className="flex items-center gap-1.5">
              <span>{bookmark.folderEmoji || "📁"}</span>
              {bookmark.folderName}
            </span>
          </>
        )}

        {/* 收藏时间 */}
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="size-3.5" />
          收藏时间
        </span>
        <span>
          {new Date(bookmark.createdAt).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>

        {/* 原始发布时间 */}
        {bookmark.sourceCreatedAt && (
          <>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="size-3.5" />
              发布时间
            </span>
            <span>
              {new Date(bookmark.sourceCreatedAt).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </>
        )}

        {/* 标签 */}
        {bookmark.tags.length > 0 && (
          <>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="size-3.5" />
              标签
            </span>
            <div className="flex flex-wrap gap-1.5">
              {bookmark.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ContentSection({
  content,
  isEditing,
  onContentChange,
}: {
  content: string
  isEditing: boolean
  onContentChange: (v: string) => void
}) {
  if (!(content || isEditing)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>暂无内容</p>
      </div>
    )
  }

  if (isEditing) {
    return (
      <MDEditor
        height="100%"
        onChange={(v) => onContentChange(v ?? "")}
        preview="live"
        style={{ minHeight: 500 }}
        value={content}
      />
    )
  }

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <MDPreview source={content} />
    </div>
  )
}
