"use client";
import { useState } from "react";
import { X, Loader2, Link2, Briefcase, Save, Check } from "lucide-react";
import { Tournament } from "./LiveTournament";
import { getEventFinancials } from "@/lib/analytics";
import { formatDateFromISO, formatTimeFromISO } from "@/lib/time";

interface Props {
    tournament: Tournament;
    allTournaments: Tournament[];
    onClose: () => void;
    onUpdated: () => void;
}

export default function SessionDetailModal({ tournament: initialTournament, allTournaments, onClose, onUpdated }: Props) {
    const [tournament, setTournament] = useState(initialTournament);
    const [reviewText, setReviewText] = useState(tournament.review ?? "");
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const fin = getEventFinancials(tournament, allTournaments);
    const isProfit = fin.profit > 0;
    const isLoss = fin.profit < 0;
    const sym = tournament.currency === "MYR" ? "RM " : "$";
    const isDay2 = tournament.phasedStage === "Day 2";
    const isDay1 = tournament.phasedStage === "Day 1";

    const firstBullet = tournament.bullets[0];
    const lastBullet = tournament.bullets[tournament.bullets.length - 1];
    const firstStart = firstBullet ? new Date(firstBullet.registeredAt).getTime() : null;
    const lastEnd = lastBullet?.bustedAt ? new Date(lastBullet.bustedAt).getTime() : null;
    const durationMs = firstStart && lastEnd ? lastEnd - firstStart : null;
    const durationStr = durationMs != null
        ? `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m`
        : "—";

    const saveReview = async () => {
        setIsSaving(true);
        try {
            await fetch("/api/tournaments", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "SET_REVIEW", id: tournament.id, review: reviewText }),
            });
            setTournament(t => ({ ...t, review: reviewText }));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            onUpdated();
        } catch (err) {
            console.error("Failed to save review:", err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
            <div className="relative z-10 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl ring-1 ring-white/5">
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-slate-800/80">
                    <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-white truncate">
                                {tournament.sessionName || tournament.type}
                            </h2>
                            {isDay2 && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                    <Link2 size={10} /> Day 2
                                </span>
                            )}
                            {isDay1 && tournament.flightStatus === "Advanced" && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                                    <Briefcase size={10} /> Advanced
                                </span>
                            )}
                        </div>
                        {tournament.sessionName && tournament.sessionName !== tournament.type && (
                            <p className="text-xs text-slate-500 mt-0.5">{tournament.type} · {tournament.speed}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Key stats grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <StatCell label="Date" value={formatDateFromISO(firstBullet ? firstBullet.registeredAt : tournament.date)} />
                        <StatCell label="Duration" value={durationStr} />
                        <StatCell label="Type" value={`${tournament.type} · ${tournament.speed}`} />
                        <StatCell label="Currency" value={tournament.currency || "USD"} />
                        {tournament.finishPosition != null && (
                            <StatCell
                                label="Finish Position"
                                value={`${tournament.finishPosition}${tournament.fieldSize ? ` / ${tournament.fieldSize}` : ""}`}
                                highlight={tournament.finishPosition <= 3 ? "amber" : undefined}
                            />
                        )}
                        {tournament.fieldSize != null && tournament.finishPosition == null && (
                            <StatCell label="Field Size" value={String(tournament.fieldSize)} />
                        )}
                    </div>

                    {/* Late registration insight */}
                    {tournament.lateRegPercentage != null && (
                        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400/70 mb-1">Late Registration</p>
                            <p className="text-sm text-slate-300 leading-snug">
                                You entered{" "}
                                <span className="font-bold text-indigo-300">{tournament.lateRegPercentage}%</span>{" "}
                                into the late registration window
                                {tournament.lateRegMinutesRemaining != null && tournament.lateRegMinutesRemaining > 0 && (
                                    <>, with{" "}
                                        <span className="font-semibold text-slate-200">{tournament.lateRegMinutesRemaining} min</span>{" "}
                                        remaining before lock
                                    </>
                                )}
                                .
                            </p>
                        </div>
                    )}

                    {/* Bullets breakdown */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Bullets ({tournament.bullets.length})</p>
                        <div className="space-y-1.5">
                            {tournament.bullets.map((b, i) => (
                                <div key={i} className="flex items-center justify-between bg-slate-950/60 border border-slate-800/60 rounded-xl px-4 py-2.5 text-xs">
                                    <span className="text-slate-400">
                                        Bullet {b.bulletNumber} &nbsp;·&nbsp;
                                        <span className="text-slate-300">{formatTimeFromISO(b.registeredAt)}</span>
                                        {b.bustedAt && <> → <span className="text-slate-300">{formatTimeFromISO(b.bustedAt)}</span></>}
                                    </span>
                                    <span className="font-semibold text-white">{sym}{b.cost.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financials */}
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Financials{fin.linked ? " (incl. Day 1)" : ""}</p>
                        <FinRow label="Invested" value={`${sym}${fin.invested.toFixed(2)}`} />
                        <FinRow label="Cash Won" value={`${sym}${fin.cashWon.toFixed(2)}`} />
                        <FinRow label="Bounties" value={`${sym}${fin.bounties.toFixed(2)}`} />
                        <div className="border-t border-slate-800/60 pt-2 mt-2 flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-400">Profit / ROI</span>
                            <span className={`text-sm font-bold ${isProfit ? "text-green-400" : isLoss ? "text-rose-400" : "text-slate-400"}`}>
                                {fin.profit > 0 ? "+" : ""}{sym}{fin.profit.toFixed(2)}&nbsp;
                                <span className="text-xs font-medium">({fin.roi > 0 ? "+" : ""}{fin.roi.toFixed(1)}%)</span>
                            </span>
                        </div>
                    </div>

                    {/* Review section */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Session Review / Notes</p>
                        <textarea
                            rows={4}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-600 resize-none"
                            placeholder="What busted you? Key hands, mistakes, reads, anything to review later…"
                            value={reviewText}
                            onChange={(e) => { setReviewText(e.target.value); setSaved(false); }}
                        />
                        <button
                            onClick={saveReview}
                            disabled={isSaving || reviewText === (tournament.review ?? "")}
                            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
                            {isSaving ? "Saving…" : saved ? "Saved" : "Save Review"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: "amber" }) {
    return (
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
            <p className={`text-sm font-semibold ${highlight === "amber" ? "text-amber-400" : "text-slate-200"}`}>{value}</p>
        </div>
    );
}

function FinRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{label}</span>
            <span className="text-xs font-medium text-slate-300">{value}</span>
        </div>
    );
}
