import { Elysia } from "elysia";
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

        let isValid = false;
        try {
            isValid = await Bun.password.verify(password, user[0]!.password_hash);
        } catch {
            // Fallback: plain text comparison for legacy/demo data
            isValid = user[0]!.password_hash === password;
        }

        if (!isValid) {
            setFlash(cookie, "Identifiants incorrects.");
            set.redirect = "/login";
            return;
        }

        // Update last_active
        await db.update(users).set({ last_active: new Date().toISOString() }).where(eq(users.id, user[0]!.id));

        cookie.auth.set({
            value: await jwt.sign({ id: user[0]!.id, username: user[0]!.username, role: user[0]!.role ?? 'user' }),
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
                role: "user",
                last_active: new Date().toISOString()
            });

            setFlash(cookie, "Compte cree avec succes ! Connecte-toi.");
            set.redirect = "/login";
        } catch (error) {
            setFlash(cookie, "Ce nom d'utilisateur est deja pris.");
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
            setFlash(cookie, "Le nom d'utilisateur ne peut pas etre vide.");
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

            setFlash(cookie, "Profil mis a jour !");
            set.redirect = "/";
        } catch (error) {
            setFlash(cookie, "Ce nom d'utilisateur est deja pris par quelqu'un d'autre.");
            set.redirect = "/edit_profile";
        }
    });
