import { pgTable, serial, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    display_name: varchar("display_name", { length: 50 }).notNull(),
    password_hash: text("password_hash").notNull(),
    profile_picture: text("profile_picture").default("https://i.pinimg.com/736x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg"),
    bio: text("bio"),
    music_link: text("music_link"),
    role: varchar("role", { length: 20 }).default("user"),
    status_note: varchar("status_note", { length: 50 }),
    last_active: timestamp("last_active", { mode: "date" }).defaultNow(),
});

export const posts = pgTable("posts", {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    postType: varchar("post_type", { length: 20 }).default("message"),
    visibility: varchar("visibility", { length: 20 }).default("public"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const comments = pgTable("comments", {
    id: serial("id").primaryKey(),
    postId: integer("post_id").references(() => posts.id).notNull(),
    authorId: integer("author_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const likes = pgTable("likes", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull(),
    itemType: varchar("item_type", { length: 20 }).notNull(), // 'post' or 'comment'
    itemId: integer("item_id").notNull(),
});

export const messages = pgTable("messages", {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id").references(() => users.id).notNull(),
    receiverId: integer("receiver_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const friends = pgTable("friends", {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id").references(() => users.id).notNull(),
    receiverId: integer("receiver_id").references(() => users.id).notNull(),
    status: varchar("status", { length: 20 }).default("pending"), // 'pending', 'accepted'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const blocks = pgTable("blocks", {
    id: serial("id").primaryKey(),
    blockerId: integer("blocker_id").references(() => users.id).notNull(),
    blockedId: integer("blocked_id").references(() => users.id).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const conversationSettings = pgTable("conversation_settings", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull(),
    friendId: integer("friend_id").references(() => users.id).notNull(),
    nickname: varchar("nickname", { length: 50 }),
    readReceipts: boolean("read_receipts").default(true),
    ephemeralMode: boolean("ephemeral_mode").default(false),
});
