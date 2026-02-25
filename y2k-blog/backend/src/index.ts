import { Elysia } from "elysia";
import { staticPlugin } from '@elysiajs/static';
import { initDatabase } from "./db/init";
import { seedDatabase } from "./db/seed";
import { authRoutes } from "./routes/auth";
import { postsRoutes } from "./routes/posts";
import { usersRoutes } from "./routes/users";
import { messagesRoutes } from "./routes/messages";
import { pagesRoutes } from "./routes/pages";
import path from "path";

// Initialize database tables
initDatabase();

// Seed with demo data if empty
seedDatabase();

const staticDir = path.resolve(import.meta.dir, "../../static");

const app = new Elysia()
    .use(staticPlugin({
        assets: staticDir,
        prefix: '/static'
    }))
    .use(pagesRoutes)
    .use(authRoutes)
    .use(postsRoutes)
    .use(usersRoutes)
    .use(messagesRoutes)
    .listen(3000);

console.log(`Server is running at http://${app.server?.hostname}:${app.server?.port}`);
