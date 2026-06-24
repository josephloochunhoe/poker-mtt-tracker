const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

export function nowUTC8(): string {
    const now = new Date();
    const utc8 = new Date(now.getTime() + UTC8_OFFSET_MS);
    return utc8.toISOString().replace("Z", "+08:00");
}

export function todayUTC8(): string {
    return nowUTC8().split("T")[0];
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Parse date/time directly from the stored ISO string so display is never
// affected by browser timezone (stored values are already in UTC+8).
function parseDateParts(iso: string): { year: number; month: number; day: number } {
    const [year, month, day] = iso.split('T')[0].split('-').map(Number);
    return { year, month, day };
}

function parseTimeParts(iso: string): { hour: number; minute: string } | null {
    if (!iso.includes('T')) return null;
    const timePart = iso.split('T')[1];
    const [hourStr, minuteStr] = timePart.split(':');
    return { hour: parseInt(hourStr), minute: minuteStr.substring(0, 2) };
}

// "Jun 24, 2026"
export function formatDateFromISO(iso: string): string {
    const { year, month, day } = parseDateParts(iso);
    return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// "Tue, Jun 24"
export function formatShortDateFromISO(iso: string): string {
    const { year, month, day } = parseDateParts(iso);
    const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
    return `${weekday}, ${MONTHS[month - 1]} ${day}`;
}

// "5:45 PM" (hour: 'numeric')
export function formatTimeFromISO(iso: string): string {
    const parts = parseTimeParts(iso);
    if (!parts) return '-';
    const { hour, minute } = parts;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${minute} ${ampm}`;
}

// "05:45 PM" (hour: '2-digit')
export function formatShortTimeFromISO(iso: string): string {
    const parts = parseTimeParts(iso);
    if (!parts) return '-';
    const { hour, minute } = parts;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = String(hour % 12 || 12).padStart(2, '0');
    return `${h12}:${minute} ${ampm}`;
}
