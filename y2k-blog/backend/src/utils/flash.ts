import { Elysia } from "elysia";

export function setFlash(cookie: any, msg: string) {
    let flashes: string[] = [];
    if (cookie.flash && cookie.flash.value) {
        try {
            const parsed = JSON.parse(cookie.flash.value);
            if (Array.isArray(parsed)) flashes = parsed;
        } catch (e) { }
    }
    flashes.push(msg);
    if (cookie.flash) {
        cookie.flash.set({ value: JSON.stringify(flashes), path: '/' });
    }
}

export function getFlashes(cookie: any): string[] {
    if (!cookie.flash || !cookie.flash.value) return [];
    try {
        const f = JSON.parse(cookie.flash.value);
        cookie.flash.remove({ path: '/' });
        return Array.isArray(f) ? f : [];
    } catch (e) {
        cookie.flash.remove({ path: '/' });
        return [];
    }
}
