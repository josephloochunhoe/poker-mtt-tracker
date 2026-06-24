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
