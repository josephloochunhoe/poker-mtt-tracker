import { Tournament } from "@/components/LiveTournament";

/** Total amount invested across all bullets fired in a single tournament document. */
export function getTournamentInvested(t: Tournament): number {
    return t.bullets.reduce((sum, b) => sum + b.cost, 0);
}

/** Total returns (cash + bounties) recorded directly on a single tournament document. */
export function getTournamentCashed(t: Tournament): number {
    return (t.cashWon || 0) + (t.bountiesWon || 0);
}

export interface EventFinancials {
    invested: number;
    cashWon: number;
    bounties: number;
    cashed: number;
    profit: number;
    roi: number;
    /** True when this entry was rolled up with a linked parent (Day 1) flight. */
    linked: boolean;
}

/**
 * Computes financials for a tournament entry. For a phased Day 2 entry we step up to
 * the qualifying Day 1 (`parentTournamentId`) so the buy-in paid on Day 1 is counted and
 * the bounty pools from both stages are merged for accurate event-level reporting.
 */
export function getEventFinancials(t: Tournament, all: Tournament[]): EventFinancials {
    let invested = getTournamentInvested(t);
    let cashWon = t.cashWon || 0;
    let bounties = t.bountiesWon || 0;
    let linked = false;

    if (t.parentTournamentId) {
        const parent = all.find(p => p.id === t.parentTournamentId);
        if (parent) {
            invested += getTournamentInvested(parent);
            cashWon += parent.cashWon || 0;
            bounties += parent.bountiesWon || 0;
            linked = true;
        }
    }

    const cashed = cashWon + bounties;
    const profit = cashed - invested;
    const roi = invested > 0 ? (profit / invested) * 100 : 0;
    return { invested, cashWon, bounties, cashed, profit, roi, linked };
}

/**
 * Builds the smart-default session name from the current configurator selections,
 * e.g. type "Mystery Bounty" + speed "Turbo" -> "WPT Turbo Mystery Bounty".
 */
export function defaultSessionName(type: string, speed: string): string {
    return ["WPT", speed && speed !== "Regular" ? speed : null, type]
        .filter(Boolean)
        .join(" ");
}

/**
 * Merges overlapping bullet intervals so concurrently-played tournaments aren't
 * double-counted, then returns the total wall-clock hours covered.
 */
export function calcMergedHours(intervals: { start: number; end: number }[]): number {
    if (intervals.length === 0) return 0;
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const cur = sorted[i];
        const last = merged[merged.length - 1];
        if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
        else merged.push({ ...cur });
    }
    return merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / (1000 * 60 * 60);
}

export interface MttMetrics {
    invested: number;
    cashed: number;
    profit: number;
    roi: number;
    abi: number;
    hours: number;
    hourly: number;
    bullets: number;
}

/**
 * Aggregate MTT metrics over a set of completed tournaments. Sums each tournament's own
 * bullets/cash/bounties (NOT getEventFinancials) so linked Day 1/Day 2 entries are each
 * counted exactly once — meaning the overall dashboard equals the sum of every session.
 * Used for both the overall dashboard and per-session analytics so the numbers match.
 */
export function getMttMetrics(completed: Tournament[]): MttMetrics {
    let invested = 0, cashed = 0, bullets = 0;
    const intervals: { start: number; end: number }[] = [];
    completed.forEach(t => {
        t.bullets.forEach(b => {
            invested += b.cost;
            bullets++;
            if (b.registeredAt && b.bustedAt)
                intervals.push({ start: new Date(b.registeredAt).getTime(), end: new Date(b.bustedAt).getTime() });
        });
        cashed += (t.cashWon || 0) + (t.bountiesWon || 0);
    });
    const hours = calcMergedHours(intervals);
    const profit = cashed - invested;
    return {
        invested,
        cashed,
        profit,
        roi: invested > 0 ? (profit / invested) * 100 : 0,
        abi: bullets > 0 ? invested / bullets : 0,
        hours,
        hourly: hours > 0 ? profit / hours : 0,
        bullets,
    };
}
