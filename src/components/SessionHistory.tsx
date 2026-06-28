"use client";
import { useState } from "react";
import { Tournament, Session } from "./LiveTournament";
import { getEventFinancials, getMttMetrics } from "@/lib/analytics";
import { ChevronDown, ChevronRight, Trash2, Loader2, Link2, Briefcase, Sparkles } from "lucide-react";
import { formatTimeFromISO, formatShortDateFromISO, formatSessionStart } from "@/lib/time";
import SessionDetailModal from "./SessionDetailModal";
import AIReviewModal from "./AIReviewModal";

const TOURNAMENT_TYPES = ["All", "Standard", "PKO", "Mystery Bounty", "Satellite"];
const PAGE_SIZE = 8;

export default function SessionHistory({
    sessions,
    allTournaments,
    onChange,
}: {
    sessions: Session[];
    allTournaments: Tournament[];
    onChange?: () => void;
}) {
    const [typeFilter, setTypeFilter] = useState("All");
    const [page, setPage] = useState(1);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [detailId, setDetailId] = useState<string | null>(null);
    const [showAIReview, setShowAIReview] = useState(false);

    // Completed sessions, newest first.
    const completedSessions = [...sessions]
        .filter(s => s.status === "Completed")
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const totalPages = Math.max(1, Math.ceil(completedSessions.length / PAGE_SIZE));
    const paginated = completedSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const matchesType = (t: Tournament) => typeFilter === "All" || t.type === typeFilter;

    const selectedTournaments = allTournaments.filter(t => selectedIds.has(t.id));
    const detail = detailId
        ? completedSessions.flatMap(s => s.tournaments.map(t => ({ t, sessionId: s.id }))).find(x => x.t.id === detailId)
        : null;

    const toggleExpand = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleTournament = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const sessionSelectionState = (s: Session): "none" | "partial" | "all" => {
        const ids = s.tournaments.filter(matchesType).map(t => t.id);
        if (ids.length === 0) return "none";
        const selectedCount = ids.filter(id => selectedIds.has(id)).length;
        if (selectedCount === 0) return "none";
        return selectedCount === ids.length ? "all" : "partial";
    };

    const toggleSession = (s: Session) => {
        const ids = s.tournaments.filter(matchesType).map(t => t.id);
        const state = sessionSelectionState(s);
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (state === "all") ids.forEach(id => next.delete(id));
            else ids.forEach(id => next.add(id));
            return next;
        });
    };

    const handleDeleteTournament = async (sessionId: string, tournamentId: string) => {
        setDeletingId(tournamentId);
        try {
            const res = await fetch("/api/sessions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "DELETE_TOURNAMENT", sessionId, tournamentId }),
            });
            if (!res.ok) throw new Error(`Server responded with ${res.status}`);
            setConfirmDelete(null);
            if (onChange) onChange();
        } catch (err) {
            console.error("Failed to delete tournament:", err);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden ring-1 ring-white/5 mt-8">
            <div className="p-6 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-xl font-bold tracking-tight text-white">Session History</h3>
                <div className="flex w-full sm:w-auto items-center gap-3">
                    <div className="relative w-full sm:w-52">
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                        <select
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                            className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white"
                        >
                            {TOURNAMENT_TYPES.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowAIReview(true)}
                        disabled={selectedIds.size === 0}
                        title={selectedIds.size === 0 ? "Select sessions or tournaments to review" : `Generate an AI review of ${selectedIds.size} tournament(s)`}
                        className="shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                    >
                        <Sparkles size={15} />
                        <span className="whitespace-nowrap">AI Review{selectedIds.size > 0 ? ` · ${selectedIds.size}` : ""}</span>
                    </button>
                </div>
            </div>

            <div className="p-4 sm:p-6 space-y-3">
                {completedSessions.length === 0 ? (
                    <div className="px-6 py-12 text-center text-slate-500">
                        No completed sessions yet. Start a session and play some tournaments!
                    </div>
                ) : paginated.map(session => {
                    const visibleTournaments = session.tournaments
                        .filter(matchesType)
                        .sort((a, b) => {
                            const aTime = a.bullets.length > 0 ? new Date(a.bullets[0].registeredAt).getTime() : 0;
                            const bTime = b.bullets.length > 0 ? new Date(b.bullets[0].registeredAt).getTime() : 0;
                            return bTime - aTime;
                        });
                    const metrics = getMttMetrics(visibleTournaments);
                    const isOpen = expanded.has(session.id);
                    const selState = sessionSelectionState(session);
                    const title = session.name ?? `Session #${session.sessionNumber ?? "?"}`;
                    const profitColor = metrics.profit > 0 ? "text-green-400" : metrics.profit < 0 ? "text-rose-400" : "text-slate-300";

                    return (
                        <div key={session.id} className="bg-slate-950/40 border border-slate-800/60 rounded-2xl overflow-hidden">
                            {/* Collapsed header */}
                            <div className="flex items-center gap-3 p-4">
                                <input
                                    type="checkbox"
                                    checked={selState === "all"}
                                    ref={el => { if (el) el.indeterminate = selState === "partial"; }}
                                    onChange={() => toggleSession(session)}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Select all tournaments in this session"
                                    className="w-4 h-4 rounded accent-indigo-500 cursor-pointer shrink-0"
                                />
                                <button
                                    onClick={() => toggleExpand(session.id)}
                                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                                >
                                    {isOpen
                                        ? <ChevronDown size={18} className="text-slate-500 shrink-0" />
                                        : <ChevronRight size={18} className="text-slate-500 shrink-0" />}
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{title}</p>
                                        <p className="text-xs text-slate-500">{formatSessionStart(session.startedAt)}</p>
                                    </div>
                                </button>
                                {/* Compact session analytics */}
                                <div className="hidden sm:flex items-center gap-4 shrink-0">
                                    <Stat label="Net" value={`${metrics.profit >= 0 ? "+" : ""}$${metrics.profit.toFixed(2)}`} valueClass={profitColor} />
                                    <Stat label="ROI" value={`${metrics.roi >= 0 ? "+" : ""}${metrics.roi.toFixed(1)}%`} valueClass={profitColor} />
                                    <Stat label="Hours" value={fmtHours(metrics.hours)} />
                                    <Stat label="ABI" value={`$${metrics.abi.toFixed(2)}`} />
                                    <Stat label="Tourneys" value={`${visibleTournaments.length}`} />
                                </div>
                            </div>
                            {/* Mobile analytics row */}
                            <div className="sm:hidden flex items-center justify-between gap-2 px-4 pb-3 -mt-1">
                                <Stat label="Net" value={`${metrics.profit >= 0 ? "+" : ""}$${metrics.profit.toFixed(2)}`} valueClass={profitColor} />
                                <Stat label="ROI" value={`${metrics.roi >= 0 ? "+" : ""}${metrics.roi.toFixed(1)}%`} valueClass={profitColor} />
                                <Stat label="Hours" value={fmtHours(metrics.hours)} />
                                <Stat label="Tourneys" value={`${visibleTournaments.length}`} />
                            </div>

                            {/* Expanded: tournaments within the session */}
                            {isOpen && (
                                <div className="border-t border-slate-800/60 overflow-x-auto">
                                    {visibleTournaments.length === 0 ? (
                                        <p className="px-6 py-6 text-center text-sm text-slate-500">No tournaments match this filter.</p>
                                    ) : (
                                        <table className="w-full text-left text-sm text-slate-400">
                                            <thead className="bg-slate-950/50 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                                                <tr>
                                                    <th className="pl-6 pr-2 py-3"></th>
                                                    <th className="px-4 py-3">Tournament</th>
                                                    <th className="px-4 py-3 text-center">Start</th>
                                                    <th className="px-4 py-3 text-center">Duration</th>
                                                    <th className="px-4 py-3 text-center">Bullets</th>
                                                    <th className="px-4 py-3 text-center">Pos</th>
                                                    <th className="px-4 py-3 text-right">Invested</th>
                                                    <th className="px-4 py-3 text-right">Cashed</th>
                                                    <th className="px-4 py-3 text-right">Profit</th>
                                                    <th className="px-4 py-3 text-right">ROI</th>
                                                    <th className="px-4 py-3 text-center">Del</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {visibleTournaments.map(t => {
                                                    const fin = getEventFinancials(t, allTournaments);
                                                    const isProfit = fin.profit > 0;
                                                    const isLoss = fin.profit < 0;
                                                    const isDay2 = t.phasedStage === "Day 2";
                                                    const isAdvancedDay1 = t.phasedStage === "Day 1" && t.flightStatus === "Advanced";
                                                    const sym = t.currency === "MYR" ? "RM " : "$";
                                                    const firstBulletISO = t.bullets.length > 0 ? t.bullets[0].registeredAt : null;
                                                    const firstStart = firstBulletISO ? new Date(firstBulletISO).getTime() : null;
                                                    const startTimeStr = firstBulletISO ? formatTimeFromISO(firstBulletISO) : "-";
                                                    const startDateStr = firstBulletISO ? formatShortDateFromISO(firstBulletISO) : null;
                                                    const lastBullet = t.bullets[t.bullets.length - 1];
                                                    const lastEnd = lastBullet?.bustedAt ? new Date(lastBullet.bustedAt).getTime() : null;
                                                    const durationMs = firstStart && lastEnd ? lastEnd - firstStart : null;
                                                    const durationStr = durationMs != null
                                                        ? `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m`
                                                        : "-";
                                                    const isConfirming = confirmDelete === t.id;
                                                    const isDeleting = deletingId === t.id;
                                                    const isSelected = selectedIds.has(t.id);

                                                    return (
                                                        <tr
                                                            key={t.id}
                                                            onClick={() => setDetailId(t.id)}
                                                            className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${isSelected ? "bg-indigo-500/5" : ""}`}
                                                        >
                                                            <td className="pl-6 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => toggleTournament(t.id)}
                                                                    className="w-4 h-4 rounded accent-indigo-500 cursor-pointer align-middle"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-white font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="truncate max-w-[200px]">{t.sessionName || t.type}</span>
                                                                    {isDay2 && (
                                                                        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30" title="Combined with Day 1 buy-in & bounties">
                                                                            <Link2 size={10} /> Day 2
                                                                        </span>
                                                                    )}
                                                                    {isAdvancedDay1 && (
                                                                        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/30" title="Bagged & advanced to Day 2">
                                                                            <Briefcase size={10} /> Advanced
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-center text-slate-300">
                                                                {startDateStr && <div className="text-xs text-slate-500">{startDateStr}</div>}
                                                                <div>{startTimeStr}</div>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-center text-slate-300">{durationStr}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                                                <span className="bg-slate-800 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-700">{t.bullets.length}</span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-center text-slate-300">
                                                                {isAdvancedDay1 ? (
                                                                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">ADV</span>
                                                                ) : t.finishPosition ? (
                                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${t.finishPosition <= 3 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-slate-800 border border-slate-700"}`}>
                                                                        {t.finishPosition}{t.fieldSize ? `/${t.fieldSize}` : ""}
                                                                    </span>
                                                                ) : "-"}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-right text-slate-300">{sym}{fin.invested.toFixed(2)}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-right text-slate-300">{sym}{fin.cashed.toFixed(2)}</td>
                                                            <td className={`px-4 py-3 whitespace-nowrap text-right font-bold ${isProfit ? "text-green-400" : isLoss ? "text-rose-400" : "text-slate-400"}`}>
                                                                {fin.profit > 0 ? "+" : ""}{sym}{fin.profit.toFixed(2)}
                                                            </td>
                                                            <td className={`px-4 py-3 whitespace-nowrap text-right font-medium ${isProfit ? "text-green-400" : isLoss ? "text-rose-400" : "text-slate-400"}`}>
                                                                {fin.roi > 0 ? "+" : ""}{fin.roi.toFixed(1)}%
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                                {isConfirming ? (
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button
                                                                            onClick={() => handleDeleteTournament(session.id, t.id)}
                                                                            disabled={isDeleting}
                                                                            className="text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                                                                        >
                                                                            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : null}
                                                                            Yes
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setConfirmDelete(null)}
                                                                            disabled={isDeleting}
                                                                            className="text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
                                                                        >
                                                                            No
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setConfirmDelete(t.id)}
                                                                        title="Delete record"
                                                                        className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-400/10"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80">
                    <span className="text-xs text-slate-500">
                        Page {page} of {totalPages} &nbsp;·&nbsp; {completedSessions.length} sessions
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {detail && (
                <SessionDetailModal
                    tournament={detail.t}
                    sessionId={detail.sessionId}
                    allTournaments={allTournaments}
                    onClose={() => setDetailId(null)}
                    onUpdated={() => { if (onChange) onChange(); }}
                />
            )}

            {showAIReview && (
                <AIReviewModal
                    sessions={selectedTournaments}
                    allTournaments={allTournaments}
                    onClose={() => setShowAIReview(false)}
                />
            )}
        </div>
    );
}

function Stat({ label, value, valueClass = "text-slate-300" }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
            <p className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</p>
        </div>
    );
}

function fmtHours(h: number): string {
    const totalMins = Math.round(h * 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
}
