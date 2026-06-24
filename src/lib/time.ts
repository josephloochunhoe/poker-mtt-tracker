const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

export function nowUTC8(): string {
    const now = new Date();
    const utc8 = new Date(now.getTime() + UTC8_OFFSET_MS);
    return utc8.toISOString().replace("Z", "+08:00");
}

export function todayUTC8(): string {
    return nowUTC8().split("T")[0];
}
