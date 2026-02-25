import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users, posts, comments, likes, messages, friends, blocks, conversationSettings } from "../db/schema";
import { eq, desc, and, or, sql, inArray } from "drizzle-orm";
import { renderTemplate } from "../utils/nunjucks";
import { getFlashes } from "../utils/flash";

function getUserStatus(lastActive: string | null) {
    if (!lastActive) return { label: 'Deconnecte', color: 'offline' };
    const now = new Date();
    const dt = new Date(lastActive);
    if (isNaN(dt.getTime())) return { label: 'Deconnecte', color: 'offline' };
    const diffMins = (now.getTime() - dt.getTime()) / 60000;
    if (diffMins < 5) return { label: 'En ligne', color: 'online' };
    if (diffMins <= 60) return { label: 'En veille', color: 'idle' };
    return { label: 'Deconnecte', color: 'offline' };
}

function statusEmoji(status: { color: string }) {
    if (status.color === 'online') return '🟢';
    if (status.color === 'idle') return '🟡';
    return '🔴';
}

export const pagesRoutes = new Elysia()
    .use(jwt({
        name: "jwt",
        secret: process.env.JWT_SECRET || "y2k_myspace_super_secret_key"
    }))
    .derive(async ({ jwt, cookie }) => {
        let user = null;
        if (cookie.auth && cookie.auth.value) {
            try {
                const token = await jwt.verify(cookie.auth.value);
                if (token) user = { id: token.id as number, username: token.username as string, role: token.role as string };
            } catch (e) { }
        }
        return { user, flashes: getFlashes(cookie) };
    })
    .get("/", async ({ user, flashes, set }) => {
        let unread = 0;
        let profileUser: any = null;

        if (user) {
            // Update last_active
            await db.update(users).set({ last_active: new Date().toISOString() }).where(eq(users.id, user.id));
            
            const reqUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
            if (reqUser.length > 0) profileUser = reqUser[0];
            const unreadRes = await db.select({ count: sql<number>`count(*)` })
                .from(messages).where(and(eq(messages.receiverId, user.id), eq(messages.isRead, false)));
            unread = Number(unreadRes[0]?.count ?? 0);
        } else {
            const admins = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
            if (admins.length > 0) profileUser = admins[0];
        }

        let postsData;
        if (user) {
            postsData = await db.select({
                id: posts.id,
                content: posts.content,
                post_type: posts.postType,
                visibility: posts.visibility,
                image_url: posts.imageUrl,
                created_at: posts.createdAt,
                author_id: posts.authorId,
                username: users.username,
                display_name: users.display_name,
                profile_picture: users.profile_picture
            }).from(posts)
                .innerJoin(users, eq(posts.authorId, users.id))
                .orderBy(desc(posts.createdAt));

            const friendsRes = await db.select().from(friends).where(or(
                eq(friends.senderId, user.id), eq(friends.receiverId, user.id)
            ));
            const acceptedFriends = friendsRes.filter(f => f.status === 'accepted').map(f => f.senderId === user.id ? f.receiverId : f.senderId);

            postsData = postsData.filter(p => {
                if (p.visibility === 'public') return true;
                if (p.author_id === user.id) return true;
                if (p.visibility === 'friends' && acceptedFriends.includes(p.author_id)) return true;
                return false;
            });
        } else {
            postsData = await db.select({
                id: posts.id,
                content: posts.content,
                post_type: posts.postType,
                visibility: posts.visibility,
                image_url: posts.imageUrl,
                created_at: posts.createdAt,
                author_id: posts.authorId,
                username: users.username,
                display_name: users.display_name,
                profile_picture: users.profile_picture
            }).from(posts)
                .innerJoin(users, eq(posts.authorId, users.id))
                .where(eq(posts.visibility, 'public'))
                .orderBy(desc(posts.createdAt));
        }

        const buildPosts = await Promise.all(postsData.map(async (p) => {
            const authorData = await db.select({ last_active: users.last_active }).from(users).where(eq(users.id, p.author_id)).limit(1);
            const authorStatus = getUserStatus(authorData[0]?.last_active ?? null);

            const likesData = await db.select().from(likes).where(and(eq(likes.itemType, 'post'), eq(likes.itemId, p.id)));
            const currentUserLiked = user ? likesData.some(l => l.userId === user.id) : false;

            const commentsData = await db.select({
                id: comments.id,
                content: comments.content,
                created_at: comments.createdAt,
                author_id: comments.authorId,
                username: users.username,
                display_name: users.display_name,
                profile_picture: users.profile_picture
            }).from(comments).innerJoin(users, eq(comments.authorId, users.id)).where(eq(comments.postId, p.id)).orderBy(comments.createdAt);

            const mappedComments = await Promise.all(commentsData.map(async (c) => {
                const cmAuthor = await db.select({ last_active: users.last_active }).from(users).where(eq(users.id, c.author_id)).limit(1);
                const cmLikes = await db.select().from(likes).where(and(eq(likes.itemType, 'comment'), eq(likes.itemId, c.id)));
                const cmStatus = getUserStatus(cmAuthor[0]?.last_active ?? null);
                return {
                    ...c,
                    author_status: { ...cmStatus, color: statusEmoji(cmStatus) },
                    likes: cmLikes.length,
                    current_user_liked: user ? cmLikes.some(l => l.userId === user.id) : false
                };
            }));

            return {
                ...p,
                likes: likesData.length,
                current_user_liked: currentUserLiked,
                comments: mappedComments,
                author_status: { ...authorStatus, color: statusEmoji(authorStatus) }
            };
        }));

        const profileStatus = profileUser ? getUserStatus(profileUser.last_active) : null;

        set.headers = { "Content-Type": "text/html; charset=utf-8" };
        return renderTemplate("index.html", {
            user, flashes, unread_messages_count: unread,
            posts: buildPosts,
            profile_user: profileUser,
            profile_status: profileStatus ? { ...profileStatus, color: statusEmoji(profileStatus) } : null
        });
    })
    .get("/login", ({ user, flashes, set }) => {
        set.headers = { "Content-Type": "text/html; charset=utf-8" };
        return renderTemplate("login.html", { user, flashes });
    })
    .get("/register", ({ user, flashes, set }) => {
        set.headers = { "Content-Type": "text/html; charset=utf-8" };
        return renderTemplate("register.html", { user, flashes });
    })
    .get("/edit_profile", async ({ user, flashes, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        const fullUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
        set.headers = { "Content-Type": "text/html; charset=utf-8" };
        return renderTemplate("edit_profile.html", { user: fullUser[0], original_user: user, flashes });
    })
    .get("/user/:username", async ({ user, flashes, params: { username }, set }) => {
        const targetResult = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (targetResult.length === 0) {
            set.redirect = "/"; return;
        }
        const target = targetResult[0];

        let relationship = 'none';
        if (user && user.id !== target.id) {
            const blockedMe = await db.select().from(blocks).where(and(eq(blocks.blockerId, target.id), eq(blocks.blockedId, user.id))).limit(1);
            if (blockedMe.length > 0) {
                set.headers = { "Content-Type": "text/html; charset=utf-8" };
                return renderTemplate("public_profile.html", { flashes: ["Vous ne pouvez pas voir ce profil."], user: null });
            }

            const iBlocked = await db.select().from(blocks).where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, target.id))).limit(1);
            if (iBlocked.length > 0) relationship = 'blocked';
            else {
                const friendReq = await db.select().from(friends).where(or(
                    and(eq(friends.senderId, user.id), eq(friends.receiverId, target.id)),
                    and(eq(friends.senderId, target.id), eq(friends.receiverId, user.id))
                )).limit(1);

                if (friendReq.length > 0) {
                    if (friendReq[0].status === 'accepted') relationship = 'friends';
                    else if (friendReq[0].senderId === user.id) relationship = 'request_sent';
                    else relationship = 'request_received';
                }
            }
        }

        let postsData;
        if (relationship === 'friends' || (user && user.id === target.id)) {
            postsData = await db.select({
                id: posts.id, content: posts.content, post_type: posts.postType, visibility: posts.visibility, image_url: posts.imageUrl, created_at: posts.createdAt, author_id: posts.authorId, username: users.username, display_name: users.display_name, profile_picture: users.profile_picture
            }).from(posts).innerJoin(users, eq(posts.authorId, users.id)).where(eq(posts.authorId, target.id)).orderBy(desc(posts.createdAt));
            postsData = postsData.filter(p => p.visibility === 'public' || p.visibility === 'friends');
        } else {
            postsData = await db.select({
                id: posts.id, content: posts.content, post_type: posts.postType, visibility: posts.visibility, image_url: posts.imageUrl, created_at: posts.createdAt, author_id: posts.authorId, username: users.username, display_name: users.display_name, profile_picture: users.profile_picture
            }).from(posts).innerJoin(users, eq(posts.authorId, users.id)).where(eq(posts.authorId, target.id)).orderBy(desc(posts.createdAt));
            postsData = postsData.filter(p => p.visibility === 'public');
        }

        const targetStatus = getUserStatus(target.last_active);

        set.headers = { "Content-Type": "text/html; charset=utf-8" };
        return renderTemplate("public_profile.html", {
            user: { ...target, status: { ...targetStatus, color: statusEmoji(targetStatus) } },
            posts: postsData, relationship, flashes,
            session: user ? { user_id: user.id, username: user.username, role: user.role, get: (k: string) => { if (k === 'user_id') return user.id; if (k === 'username') return user.username; if (k === 'role') return user.role; return undefined; } } : null
        });
    })
    .get("/messages", async ({ user, flashes, set }) => {
        if (!user) { set.redirect = "/login"; return; }

        const userFriends = await db.select().from(friends).where(and(or(eq(friends.senderId, user.id), eq(friends.receiverId, user.id)), eq(friends.status, 'accepted')));
        const friendIds = userFriends.map(f => f.senderId === user.id ? f.receiverId : f.senderId);
        let friendsList: any[] = [];
        if (friendIds.length > 0) {
            const fUsers = await db.select().from(users).where(inArray(users.id, friendIds));
            friendsList = await Promise.all(fUsers.map(async (u) => {
                const msgs = await db.select().from(messages).where(or(
                    and(eq(messages.senderId, user.id), eq(messages.receiverId, u.id)),
                    and(eq(messages.senderId, u.id), eq(messages.receiverId, user.id))
                )).orderBy(desc(messages.createdAt));

                const unreadCount = msgs.filter(m => m.receiverId === user.id && !m.isRead).length;
                const fStatus = getUserStatus(u.last_active);

                return {
                    id: u.id, username: u.username, display_name: u.display_name, profile_picture: u.profile_picture, last_active: u.last_active,
                    status: { ...fStatus, color: statusEmoji(fStatus) },
                    last_message: msgs.length > 0 ? msgs[0]?.content : null,
                    last_activity: msgs.length > 0 ? msgs[0]?.createdAt : null,
                    unread_count: unreadCount
                };
            }));
            friendsList.sort((a, b) => {
                const aTime = a.last_activity ? new Date(a.last_activity).getTime() : 0;
                const bTime = b.last_activity ? new Date(b.last_activity).getTime() : 0;
                return bTime - aTime;
            });
        }

        const unreadRes = await db.select({ count: sql<number>`count(*)` })
            .from(messages).where(and(eq(messages.receiverId, user.id), eq(messages.isRead, false)));
        const unread_messages_count = Number(unreadRes[0]?.count ?? 0);

        set.headers = { "Content-Type": "text/html; charset=utf-8" };
        return renderTemplate("messages.html", { user, flashes, friends: friendsList, unread_messages_count });
    })
    .get("/messages/:chat_username", async ({ user, flashes, params: { chat_username }, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        const targetRes = await db.select().from(users).where(eq(users.username, chat_username)).limit(1);
        if (targetRes.length === 0) { set.redirect = "/messages"; return; }
        const active_chat_user_row = targetRes[0];

        await db.update(messages).set({ isRead: true }).where(and(eq(messages.senderId, active_chat_user_row.id), eq(messages.receiverId, user.id), eq(messages.isRead, false)));

        let my_settings = await db.select().from(conversationSettings).where(and(eq(conversationSettings.userId, user.id), eq(conversationSettings.friendId, active_chat_user_row.id))).limit(1);
        if (my_settings.length === 0) {
            await db.insert(conversationSettings).values({ userId: user.id, friendId: active_chat_user_row.id });
            my_settings = await db.select().from(conversationSettings).where(and(eq(conversationSettings.userId, user.id), eq(conversationSettings.friendId, active_chat_user_row.id))).limit(1);
        }
        let their_settings = await db.select().from(conversationSettings).where(and(eq(conversationSettings.userId, active_chat_user_row.id), eq(conversationSettings.friendId, user.id))).limit(1);
        if (their_settings.length === 0) {
            await db.insert(conversationSettings).values({ userId: active_chat_user_row.id, friendId: user.id });
            their_settings = await db.select().from(conversationSettings).where(and(eq(conversationSettings.userId, active_chat_user_row.id), eq(conversationSettings.friendId, user.id))).limit(1);
        }

        const chatUserStatus = getUserStatus(active_chat_user_row.last_active);
        const active_chat_user: any = {
            ...active_chat_user_row,
            status: { ...chatUserStatus, color: statusEmoji(chatUserStatus) }
        };
        if (my_settings[0]?.nickname) active_chat_user.display_name = my_settings[0].nickname;

        let chat = await db.select({
            id: messages.id, content: messages.content, is_read: messages.isRead, created_at: messages.createdAt,
            sender_id: messages.senderId, receiver_id: messages.receiverId,
            sender_name: users.username, sender_pfp: users.profile_picture
        }).from(messages).innerJoin(users, eq(messages.senderId, users.id)).where(or(
            and(eq(messages.senderId, user.id), eq(messages.receiverId, active_chat_user.id)),
            and(eq(messages.senderId, active_chat_user.id), eq(messages.receiverId, user.id))
        )).orderBy(messages.createdAt);

        const ephemeral = my_settings[0]?.ephemeralMode || their_settings[0]?.ephemeralMode;
        if (ephemeral) {
            const hr24 = 24 * 60 * 60 * 1000;
            const now = new Date().getTime();
            chat = chat.filter(m => {
                const msgTime = m.created_at ? new Date(m.created_at).getTime() : 0;
                return (now - msgTime) < hr24;
            });
        }

        // build friend list
        const userFriends = await db.select().from(friends).where(and(or(eq(friends.senderId, user.id), eq(friends.receiverId, user.id)), eq(friends.status, 'accepted')));
        const friendIds = userFriends.map(f => f.senderId === user.id ? f.receiverId : f.senderId);
        let friendsList: any[] = [];
        if (friendIds.length > 0) {
            const fUsers = await db.select().from(users).where(inArray(users.id, friendIds));
            friendsList = await Promise.all(fUsers.map(async (u) => {
                const msgs = await db.select().from(messages).where(or(
                    and(eq(messages.senderId, user.id), eq(messages.receiverId, u.id)),
                    and(eq(messages.senderId, u.id), eq(messages.receiverId, user.id))
                )).orderBy(desc(messages.createdAt));

                const fStatus = getUserStatus(u.last_active);

                return {
                    id: u.id, username: u.username, display_name: u.display_name, profile_picture: u.profile_picture, last_active: u.last_active,
                    status: { ...fStatus, color: statusEmoji(fStatus) },
                    last_message: msgs.length > 0 ? msgs[0]?.content : null,
                    last_activity: msgs.length > 0 ? msgs[0]?.createdAt : null,
                    unread_count: msgs.filter(m => m.receiverId === user.id && !m.isRead).length
                };
            }));
            friendsList.sort((a, b) => {
                const aTime = a.last_activity ? new Date(a.last_activity).getTime() : 0;
                const bTime = b.last_activity ? new Date(b.last_activity).getTime() : 0;
                return bTime - aTime;
            });
        }

        const unreadRes = await db.select({ count: sql<number>`count(*)` })
            .from(messages).where(and(eq(messages.receiverId, user.id), eq(messages.isRead, false)));
        const unread_messages_count = Number(unreadRes[0]?.count ?? 0);

        set.headers = { "Content-Type": "text/html; charset=utf-8" };
        return renderTemplate("messages.html", {
            user, flashes, unread_messages_count, friends: friendsList,
            active_chat_user, chat_messages: chat, messages: chat,
            my_settings: my_settings[0] ?? {}, their_settings: their_settings[0] ?? {},
            search_query: ''
        });
    });
