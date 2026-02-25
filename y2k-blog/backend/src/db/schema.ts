import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    display_name: text("display_name").notNull(),
    password_hash: text("password_hash").notNull(),
    profile_picture: text("profile_picture").default("https://i.pinimg.com/736x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg"),
    bio: text("bio"),
    music_link: text("music_link"),
    role: text("role").default("user"),
    status_note: text("status_note"),
    last_active: text("last_active"),
});

export const posts = sqliteTable("posts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: integer("author_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    postType: text("post_type").default("message"),
    visibility: text("visibility").default("public"),
    imageUrl: text("image_url"),
    createdAt: text("created_at"),
});

export const comments = sqliteTable("comments", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id").references(() => posts.id).notNull(),
    authorId: integer("author_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at"),
});

export const likes = sqliteTable("likes", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id).notNull(),
    itemType: text("item_type").notNull(),
    itemId: integer("item_id").notNull(),
});

export const messages = sqliteTable("messages", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    senderId: integer("sender_id").references(() => users.id).notNull(),
    receiverId: integer("receiver_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    isRead: integer("is_read", { mode: "boolean" }).default(false),
    createdAt: text("created_at"),
});

export const friends = sqliteTable("friends", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    senderId: integer("sender_id").references(() => users.id).notNull(),
    receiverId: integer("receiver_id").references(() => users.id).notNull(),
    status: text("status").default("pending"),
    createdAt: text("created_at"),
});

export const blocks = sqliteTable("blocks", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    blockerId: integer("blocker_id").references(() => users.id).notNull(),
    blockedId: integer("blocked_id").references(() => users.id).notNull(),
    createdAt: text("created_at"),
});

export const conversationSettings = sqliteTable("conversation_settings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id).notNull(),
    friendId: integer("friend_id").references(() => users.id).notNull(),
    nickname: text("nickname"),
    readReceipts: integer("read_receipts", { mode: "boolean" }).default(true),
    ephemeralMode: integer("ephemeral_mode", { mode: "boolean" }).default(false),
});
