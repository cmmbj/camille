import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users, friends, blocks } from "../db/schema";
import { eq, and, or } from "drizzle-orm";
import { setFlash } from "../utils/flash";

export const usersRoutes = new Elysia({ prefix: "/api" })
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
    .get("/user/:username", async ({ user, params: { username } }) => {
        const targetResult = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (targetResult.length === 0) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        const target = targetResult[0];

        let relationship = 'none';
        if (user && user.id !== target.id) {
            const blockedMe = await db.select().from(blocks).where(and(eq(blocks.blockerId, target.id), eq(blocks.blockedId, user.id))).limit(1);
            if (blockedMe.length > 0) return new Response(JSON.stringify({ error: "Blocked" }), { status: 403 });

            const iBlocked = await db.select().from(blocks).where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, target.id))).limit(1);
            if (iBlocked.length > 0) {
                relationship = 'blocked';
            } else {
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

        return { user: target, relationship };
    })
    .post("/add_friend/:target_id", async ({ user, params: { target_id }, cookie, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        const tid = parseInt(target_id);
        const existing = await db.select().from(friends).where(or(
            and(eq(friends.senderId, user.id), eq(friends.receiverId, tid)),
            and(eq(friends.senderId, tid), eq(friends.receiverId, user.id))
        )).limit(1);

        if (existing.length === 0) {
            await db.insert(friends).values({ senderId: user.id, receiverId: tid });
            setFlash(cookie, "Demande d'ami envoyée ! 💌");
        }

        const target = await db.select().from(users).where(eq(users.id, tid)).limit(1);
        set.redirect = target.length > 0 ? `/user/${target[0].username}` : "/";
    })
    .post("/accept_friend/:target_id", async ({ user, params: { target_id }, cookie, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        await db.update(friends).set({ status: 'accepted' }).where(and(
            eq(friends.senderId, parseInt(target_id)),
            eq(friends.receiverId, user.id)
        ));
        setFlash(cookie, "Demande d'ami acceptée ! 💖");
        const target = await db.select().from(users).where(eq(users.id, parseInt(target_id))).limit(1);
        set.redirect = target.length > 0 ? `/user/${target[0].username}` : "/";
    })
    .post("/remove_friend/:target_id", async ({ user, params: { target_id }, cookie, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        const tid = parseInt(target_id);
        await db.delete(friends).where(or(
            and(eq(friends.senderId, user.id), eq(friends.receiverId, tid)),
            and(eq(friends.senderId, tid), eq(friends.receiverId, user.id))
        ));
        setFlash(cookie, "Ami(e) supprimé(e).");
        const target = await db.select().from(users).where(eq(users.id, tid)).limit(1);
        set.redirect = target.length > 0 ? `/user/${target[0].username}` : "/";
    })
    .post("/block_user/:target_id", async ({ user, params: { target_id }, cookie, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        const tid = parseInt(target_id);

        await db.delete(friends).where(or(
            and(eq(friends.senderId, user.id), eq(friends.receiverId, tid)),
            and(eq(friends.senderId, tid), eq(friends.receiverId, user.id))
        ));

        const existing = await db.select().from(blocks).where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, tid))).limit(1);
        if (existing.length === 0) {
            await db.insert(blocks).values({ blockerId: user.id, blockedId: tid });
        }
        setFlash(cookie, "Utilisateur bloqué. 🛑");
        set.redirect = "/";
    })
    .post("/unblock_user/:target_id", async ({ user, params: { target_id }, cookie, set }) => {
        if (!user) { set.redirect = "/login"; return; }
        const tid = parseInt(target_id);
        await db.delete(blocks).where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, tid)));
        setFlash(cookie, "Utilisateur débloqué.");
        const target = await db.select().from(users).where(eq(users.id, tid)).limit(1);
        set.redirect = target.length > 0 ? `/user/${target[0].username}` : "/";
    });
