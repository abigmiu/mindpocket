import { relations } from "drizzle-orm"
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { folder } from "./folder"
import { bookmarkTag } from "./tag"

export const bookmark = pgTable(
  "bookmark",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => folder.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull().default("link"),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url"),
    content: text("content"),
    coverImage: text("cover_image"),
    faviconUrl: text("favicon_url"),
    metadata: jsonb("metadata"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    sourceType: text("source_type"),
    clientSource: text("client_source").notNull().default("web"),
    fileUrl: text("file_url"),
    fileExtension: text("file_extension"),
    fileSize: integer("file_size"),
    ingestStatus: text("ingest_status").notNull().default("pending"),
    ingestError: text("ingest_error"),
    platform: text("platform"),
    author: text("author"),
    language: text("language"),
    sourceCreatedAt: timestamp("source_created_at"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bookmark_userId_idx").on(table.userId),
    index("bookmark_folderId_idx").on(table.folderId),
    index("bookmark_type_idx").on(table.type),
    index("bookmark_createdAt_idx").on(table.createdAt),
  ]
)

export const bookmarkRelations = relations(bookmark, ({ one, many }) => ({
  user: one(user, {
    fields: [bookmark.userId],
    references: [user.id],
  }),
  folder: one(folder, {
    fields: [bookmark.folderId],
    references: [folder.id],
  }),
  bookmarkTags: many(bookmarkTag),
}))
