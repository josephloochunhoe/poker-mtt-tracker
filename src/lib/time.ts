const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

export function nowUTC8(): string {
    const now = new Date();
    const utc8 = new Date(now.getTime() + UTC8_OFFSET_MS);
    return utc8.toISOString().replace("Z", "+08:00");
}

export function todayUTC8(): string {
    return nowUTC8().split("T")[0];
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function splitISO(isoStr: string): { year: number; month: number; day: number; hour: number; minute: number } {
    const [datePart, timePart = "00:00"] = isoStr.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    return { year, month, day, hour, minute };
}

/** "Jun 24, 2026" — parses directly from the ISO string, no timezone conversion */
export function formatDateFromISO(isoStr: string): string {
    const { year, month, day } = splitISO(isoStr);
    return `${MONTH_SHORT[month - 1]} ${day}, ${year}`;
}

/** "Wed, Jun 24" — parses directly from the ISO string, no timezone conversion */
export function formatShortDateFromISO(isoStr: string): string {
    const { year, month, day } = splitISO(isoStr);
    const weekday = WEEKDAY_SHORT[new Date(Date.UTC(year, month - 1, day)).getDay()];
    return `${weekday}, ${MONTH_SHORT[month - 1]} ${day}`;
}

/** "5:45 PM" — parses directly from the ISO string, no timezone conversion */
export function formatTimeFromISO(isoStr: string): string {
    if (!isoStr.includes("T")) return "-";
    const { hour, minute } = splitISO(isoStr);
    const period = hour >= 12 ? "PM" : "AM";
    const h = hour % 12 || 12;
    const m = String(minute).padStart(2, "0");
    return `${h}:${m} ${period}`;
}

/** "17:45" — parses directly from the ISO string, no timezone conversion */
export function formatShortTimeFromISO(isoStr: string): string {
    if (!isoStr.includes("T")) return "-";
    const { hour, minute } = splitISO(isoStr);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
