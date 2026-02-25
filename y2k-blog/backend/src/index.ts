import { Elysia } from "elysia";
import { staticPlugin } from '@elysiajs/static';
import { authRoutes } from "./routes/auth";
import { postsRoutes } from "./routes/posts";
import { usersRoutes } from "./routes/users";
import { messagesRoutes } from "./routes/messages";
import { pagesRoutes } from "./routes/pages";

const app = new Elysia()
    .use(staticPlugin({
        assets: '../static',
        prefix: '/static'
    }))
    .use(pagesRoutes)
    .use(authRoutes)
    .use(postsRoutes)
    .use(usersRoutes)
    .use(messagesRoutes)
    .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
