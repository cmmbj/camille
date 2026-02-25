import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users, messages, conversationSettings } from "../db/schema";
import { eq, and, or } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import { setFlash } from "../utils/flash";

export const messagesRoutes = new Elysia({ prefix: "/api" })
    .use(jwt({
        name: "jwt",
        secret: process.env.JWT_SECRET || "y2k_myspace_super_secret_key"
    }))
    .derive(async ({ jwt, cookie: { auth } }) => {
        if (!auth.value) return { user: null };
        const token = await jwt.verify(auth.value);
        if (!token) return { user: null };
        return { user: { id: token.id as number, username: token.username as string, role: token.role as string } };
    })
    .get("/messages", async ({ user, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        return { conversations: [] };
    })
    .get("/messages/:username", async ({ user, params: { username }, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        const targetRes = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (targetRes.length === 0) { set.redirect = "/messages"; return; }
        const target = targetRes[0]!;

        await db.update(messages).set({ isRead: true })
            .where(and(eq(messages.senderId, target.id), eq(messages.receiverId, user.id), eq(messages.isRead, false)));

        const chat = await db.select().from(messages).where(or(
            and(eq(messages.senderId, user.id), eq(messages.receiverId, target.id)),
            and(eq(messages.senderId, target.id), eq(messages.receiverId, user.id))
        )).orderBy(messages.createdAt);

        return chat;
    })
    .post("/messages/:username", async ({ user, params: { username }, body, cookie, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        const { content } = body as any;
        if (!content) { set.redirect = `/messages/${username}`; return; }

        const targetRes = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (targetRes.length === 0) { set.redirect = "/messages"; return; }
        const target = targetRes[0]!;

        const cleanContent = sanitizeHtml(content);

        await db.insert(messages).values({
            senderId: user.id,
            receiverId: target.id,
            content: cleanContent,
            createdAt: new Date().toISOString()
        });

        set.redirect = `/messages/${username}`;
    })
    .post("/conversation_settings/:chat_username", async ({ user, params: { chat_username }, body, cookie, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        const { nickname, show_read_receipts, ephemeral_mode } = body as any;

        const friendRes = await db.select().from(users).where(eq(users.username, chat_username)).limit(1);
        if (friendRes.length === 0) { set.redirect = "/messages"; return; }
        const friend = friendRes[0]!;

        const settings = await db.select().from(conversationSettings).where(and(eq(conversationSettings.userId, user.id), eq(conversationSettings.friendId, friend.id))).limit(1);

        const showReceipts = show_read_receipts === 'on' || show_read_receipts === 'true';
        const ephemeral = ephemeral_mode === 'on' || ephemeral_mode === 'true';

        if (settings.length > 0) {
            await db.update(conversationSettings).set({
                nickname: nickname || null,
                readReceipts: showReceipts,
                ephemeralMode: ephemeral
            }).where(eq(conversationSettings.id, settings[0]!.id));
        } else {
            await db.insert(conversationSettings).values({
                userId: user.id,
                friendId: friend.id,
                nickname: nickname || null,
                readReceipts: showReceipts,
                ephemeralMode: ephemeral
            });
        }

        setFlash(cookie, "Parametres de discussion mis a jour !");
        set.redirect = `/messages/${chat_username}`;
    });
