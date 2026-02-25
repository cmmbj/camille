import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { setFlash } from "../utils/flash";

export const authRoutes = new Elysia({ prefix: "/api" })
    .use(jwt({
        name: "jwt",
        secret: process.env.JWT_SECRET || "y2k_myspace_super_secret_key"
    }))
    .post("/login", async ({ body, jwt, cookie, set }) => {
        const { username, password } = body as any;
        const user = await db.select().from(users).where(eq(users.username, username)).limit(1);

        if (user.length === 0) {
            setFlash(cookie, "Identifiants incorrects.");
            set.redirect = "/login";
            return;
        }

        const isMatch = await Bun.password.verify(password, user[0].password_hash);
        // Note: For simple Flask compatibility fallback, if simple password match then it's valid too
        let isValid = isMatch || user[0].password_hash === password;
        if (!isValid) {
            setFlash(cookie, "Identifiants incorrects.");
            set.redirect = "/login";
            return;
        }

        cookie.auth.set({
            value: await jwt.sign({ id: user[0].id, username: user[0].username, role: user[0].role }),
            httpOnly: true,
            maxAge: 7 * 86400,
            path: '/',
        });

        set.redirect = "/";
    })
    .post("/register", async ({ body, jwt, cookie, set }) => {
        const { username, display_name, password } = body as any;

        if (!username || !password) {
            setFlash(cookie, "Nom d'utilisateur et mot de passe requis.");
            set.redirect = "/register";
            return;
        }

        const hash = await Bun.password.hash(password);

        try {
            await db.insert(users).values({
                username,
                display_name: display_name || username,
                password_hash: hash,
                role: "user"
            }).returning();

            setFlash(cookie, "Compte créé avec succès ! Connecte-toi 💖");
            set.redirect = "/login";
        } catch (error) {
            setFlash(cookie, "Ce nom d'utilisateur est déjà pris.");
            set.redirect = "/register";
        }
    })
    .get("/logout", async ({ cookie, jwt, set }) => {
        const token = await jwt.verify(cookie.auth.value);
        if (token && typeof token.id === 'number') {
            await db.update(users).set({ last_active: null }).where(eq(users.id, token.id));
        }

        cookie.auth.remove();
        set.redirect = "/";
    })
    // Get current user profile edit data
    .get("/profile", async ({ cookie: { auth }, jwt }) => {
        const token = await jwt.verify(auth.value);
        if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

        const user = await db.select().from(users).where(eq(users.id, token.id as number)).limit(1);
        if (user.length === 0) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

        return user[0];
    })
    .post("/edit_profile", async ({ body, cookie, jwt, set }) => {
        const token = await jwt.verify(cookie.auth.value);
        if (!token) {
            set.redirect = "/login";
            return;
        }

        const { username, display_name, bio, profile_picture, music_link, status_note } = body as any;

        if (!username) {
            setFlash(cookie, "Le nom d'utilisateur ne peut pas être vide.");
            set.redirect = "/edit_profile";
            return;
        }

        try {
            await db.update(users).set({
                username,
                display_name,
                bio,
                profile_picture,
                music_link,
                status_note,
            }).where(eq(users.id, token.id as number));

            // update token if username changed? We'll let it be for now since it relies on id
            setFlash(cookie, "Profil mis à jour ! ✨");
            set.redirect = "/";
        } catch (error) {
            setFlash(cookie, "Ce nom d'utilisateur est déjà pris par quelqu'un d'autre.");
            set.redirect = "/edit_profile";
        }
    });
