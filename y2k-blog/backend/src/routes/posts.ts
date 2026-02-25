import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users, posts, comments, likes, friends } from "../db/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { setFlash } from "../utils/flash";

function parseMentions(text: string) {
    const pattern = /@(\w+)/g;
    return text.replace(pattern, '<span class="mention">@$1</span>');
}

function processContent(rawContent: string) {
    const contentWithMentions = parseMentions(rawContent);
    const html = marked.parse(contentWithMentions) as string;
    return sanitizeHtml(html, {
        allowedTags: [
            'a', 'abbr', 'acronym', 'b', 'blockquote', 'code', 'em', 'i', 'li', 'ol', 'strong',
            'ul', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'hr', 'span'
        ],
        allowedAttributes: {
            'a': ['href', 'title', 'target'],
            'img': ['src', 'alt', 'title'],
            'span': ['class', 'style']
        }
    });
}

export const postsRoutes = new Elysia({ prefix: "/api" })
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
    .get("/posts", async ({ user }) => {
        // Build base feed query logic
        // Simplified basic version for now, filters should match Flask logic
        const feed = await db.select({
            id: posts.id,
            content: posts.content,
            postType: posts.postType,
            visibility: posts.visibility,
            imageUrl: posts.imageUrl,
            createdAt: posts.createdAt,
            authorId: posts.authorId,
            username: users.username,
            displayName: users.display_name,
            profilePicture: users.profile_picture
        })
            .from(posts)
            .innerJoin(users, eq(posts.authorId, users.id))
            .orderBy(desc(posts.createdAt))
            .limit(50);
        // Note: For a complete translation, we should filter by friends here.
        // Doing this in JS runtime or via raw SQL view might be easier for complex auth rules.

        return feed;
    })
    .post("/post/new", async ({ user, body, cookie, set }) => {
        if (!user) {
            setFlash(cookie, "Vous devez être connecté pour poster.");
            set.redirect = "/login";
            return;
        }
        const { content, visibility, imageUrl } = body as any;

        if (!content && !imageUrl) {
            setFlash(cookie, "Le contenu ou une image est requis!");
            set.redirect = "/";
            return;
        }

        const cleanContent = content ? processContent(content) : "";

        await db.insert(posts).values({
            authorId: user.id,
            content: cleanContent,
            visibility: visibility || "public",
            imageUrl: imageUrl || null
        });

        setFlash(cookie, "Post publié avec succès ! ✨");
        set.redirect = "/";
    })
    .post("/comment/:post_id", async ({ user, params: { post_id }, body, cookie, set, request }) => {
        if (!user) {
            setFlash(cookie, "Connecte-toi pour commenter !");
            set.redirect = "/login";
            return;
        }
        const { content } = body as any;
        if (content) {
            const cleanContent = processContent(content);
            await db.insert(comments).values({
                postId: parseInt(post_id),
                authorId: user.id,
                content: cleanContent
            });
        }

        const referer = request.headers.get("referer") || "/";
        set.redirect = referer.split('#')[0] + `#post-${post_id}`;
    })
    .post("/like/:item_type/:item_id", async ({ user, params: { item_type, item_id }, set, request }) => {
        if (!user) { set.redirect = "/login"; return; }
        if (item_type !== 'post' && item_type !== 'comment') {
            set.redirect = "/";
            return;
        }

        const parsedId = parseInt(item_id);
        const existing = await db.select().from(likes).where(and(
            eq(likes.userId, user.id),
            eq(likes.itemType, item_type),
            eq(likes.itemId, parsedId)
        )).limit(1);

        if (existing.length > 0) {
            await db.delete(likes).where(eq(likes.id, existing[0].id));
        } else {
            await db.insert(likes).values({
                userId: user.id,
                itemType: item_type,
                itemId: parsedId
            });
        }

        const referer = request.headers.get("referer") || "/";
        let targetId = parsedId;
        if (item_type === 'comment') {
            const c = await db.select().from(comments).where(eq(comments.id, parsedId)).limit(1);
            if (c.length > 0) targetId = c[0].postId;
        }
        set.redirect = referer.split('#')[0] + `#post-${targetId}`;
    })
    .post("/delete_post/:post_id", async ({ user, params: { post_id }, cookie, set, request }) => {
        if (!user || user.role !== 'admin') { set.redirect = "/login"; return; }
        const pId = parseInt(post_id);

        // cascade deletes simplified
        await db.delete(likes).where(and(eq(likes.itemType, 'post'), eq(likes.itemId, pId)));
        const postComments = await db.select().from(comments).where(eq(comments.postId, pId));
        for (const c of postComments) {
            await db.delete(likes).where(and(eq(likes.itemType, 'comment'), eq(likes.itemId, c.id)));
        }
        await db.delete(comments).where(eq(comments.postId, pId));
        await db.delete(posts).where(eq(posts.id, pId));

        setFlash(cookie, "Post supprimé 🗑️");
        set.redirect = request.headers.get('referer') || "/";
    })
    .post("/delete_comment/:comment_id", async ({ user, params: { comment_id }, cookie, set, request }) => {
        if (!user || user.role !== 'admin') { set.redirect = "/login"; return; }
        const cId = parseInt(comment_id);
        const c = await db.select().from(comments).where(eq(comments.id, cId)).limit(1);

        if (c.length > 0) {
            const pId = c[0].postId;
            await db.delete(likes).where(and(eq(likes.itemType, 'comment'), eq(likes.itemId, cId)));
            await db.delete(comments).where(eq(comments.id, cId));
            setFlash(cookie, "Commentaire supprimé 🗑️");
            const referer = request.headers.get("referer") || "/";
            set.redirect = referer.split('#')[0] + `#post-${pId}`;
        } else {
            set.redirect = request.headers.get("referer") || "/";
        }
    });
