import nunjucks from "nunjucks";
import path from "path";

const templatesDir = path.resolve(import.meta.dir, "../../../templates");
const env = nunjucks.configure(templatesDir, { autoescape: true });

env.addFilter('timeago', function (dateStr: string | Date | null) {
    if (!dateStr) return "";
    const dt = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - dt.getTime()) / 1000);
    const days = Math.floor(diffSeconds / 86400);

    if (days === 0) {
        if (diffSeconds < 60) return "à l'instant";
        if (diffSeconds < 3600) return `il y a ${Math.floor(diffSeconds / 60)} min`;
        return `il y a ${Math.floor(diffSeconds / 3600)}h`;
    } else if (days === 1) {
        return "hier";
    } else if (days < 7) {
        return `il y a ${days} jours`;
    } else if (days < 30) {
        const weeks = Math.floor(days / 7);
        if (weeks <= 1) return `il y a 1 semaine`;
        return `il y a ${weeks} semaines`;
    } else if (days < 365) {
        const months = Math.floor(days / 30);
        if (months <= 1) return `il y a 1 mois`;
        return `il y a ${months} mois`;
    } else {
        const years = Math.floor(days / 365);
        if (years <= 1) return `il y a 1 an`;
        return `il y a ${years} ans`;
    }
});

env.addGlobal('url_for', function (endpoint: string, kwargs: Record<string, any> = {}) {
    if (endpoint === 'static') return `/static/${kwargs.filename}`;
    if (endpoint === 'index') return `/`;
    if (endpoint === 'login') return `/login`;
    if (endpoint === 'register') return `/register`;
    if (endpoint === 'logout') return `/api/logout`;
    if (endpoint === 'edit_profile') return `/edit_profile`;
    if (endpoint === 'public_profile') return `/user/${kwargs.username}`;
    if (endpoint === 'messages') return kwargs.chat_username ? `/messages/${kwargs.chat_username}` : `/messages`;
    if (endpoint === 'add_friend') return `/api/add_friend/${kwargs.target_id}`;
    if (endpoint === 'accept_friend') return `/api/accept_friend/${kwargs.target_id}`;
    if (endpoint === 'remove_friend') return `/api/remove_friend/${kwargs.target_id}`;
    if (endpoint === 'block_user') return `/api/block_user/${kwargs.target_id}`;
    if (endpoint === 'unblock_user') return `/api/unblock_user/${kwargs.target_id}`;
    if (endpoint === 'delete_post') return `/api/delete_post/${kwargs.post_id}`;
    if (endpoint === 'delete_comment') return `/api/delete_comment/${kwargs.comment_id}`;
    if (endpoint === 'toggle_like') return `/api/like/${kwargs.item_type}/${kwargs.item_id}`;
    if (endpoint === 'add_comment') return `/api/comment/${kwargs.post_id}`;
    if (endpoint === 'update_conversation_settings') return `/api/conversation_settings/${kwargs.chat_username}`;
    if (endpoint === 'new_post') return `/api/post/new`;
    return `/${endpoint}`;
});

export function renderTemplate(template: string, ctx: any = {}) {
    const context = {
        ...ctx,
        get_flashed_messages: () => ctx.flashes || [],
        session: {
            get: (key: string) => {
                if (key === 'user_id') return ctx.user?.id;
                if (key === 'username') return ctx.user?.username;
                if (key === 'role') return ctx.user?.role;
                return undefined;
            },
            role: ctx.user?.role,
            user_id: ctx.user?.id,
            username: ctx.user?.username,
        }
    };
    return env.render(template, context);
}
