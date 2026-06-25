"use client";
import { useState } from "react";
import { X, Sparkles, Loader2, AlertCircle, FileText } from "lucide-react";
import { Tournament } from "./LiveTournament";
import { getEventFinancials } from "@/lib/analytics";
import { formatDateFromISO } from "@/lib/time";

interface Props {
    sessions: Tournament[];
    allTournaments: Tournament[];
    onClose: () => void;
}

export default function AIReviewModal({ sessions, allTournaments, onClose }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generate = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            const payload = sessions.map(t => {
                const fin = getEventFinancials(t, allTournaments);
                const sym = t.currency === "MYR" ? "RM " : "$";
                return {
                    name: t.sessionName || t.type,
                    type: t.type,
                    speed: t.speed,
                    date: formatDateFromISO(t.bullets[0]?.registeredAt ?? t.date),
                    buyIn: `${sym}${fin.invested.toFixed(2)}`,
                    finishPosition: t.finishPosition ?? null,
                    fieldSize: t.fieldSize ?? null,
                    cashWon: `${sym}${fin.cashWon.toFixed(2)}`,
                    bountiesWon: `${sym}${fin.bounties.toFixed(2)}`,
                    profit: `${fin.profit >= 0 ? "+" : ""}${sym}${fin.profit.toFixed(2)}`,
                    roi: `${fin.roi >= 0 ? "+" : ""}${fin.roi.toFixed(1)}%`,
                    review: t.review ?? "(no review written)",
                };
            });

            const res = await fetch("/api/ai-review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessions: payload }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
            setResult(data.review);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
            <div className="relative z-10 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-white/5">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-800/80 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20">
                            <Sparkles size={18} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">AI Coaching Review</h2>
                            <p className="text-xs text-slate-500">{sessions.length} session{sessions.length !== 1 ? "s" : ""} selected</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
                        <X size={18} />
                    </button>
                </div>

                {/* Session list */}
                <div className="p-6 border-b border-slate-800/40 shrink-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Sessions included</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {sessions.map(t => {
                            const hasReview = !!t.review?.trim();
                            return (
                                <div key={t.id} className="flex items-center justify-between bg-slate-950/60 border border-slate-800/60 rounded-xl px-3 py-2 text-xs">
                                    <span className="text-slate-300 font-medium truncate">{t.sessionName || t.type}</span>
                                    <span className={`shrink-0 ml-2 flex items-center gap-1 ${hasReview ? "text-green-400" : "text-slate-600"}`}>
                                        <FileText size={12} />
                                        {hasReview ? "Has review" : "No review"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    {sessions.some(t => !t.review?.trim()) && (
                        <p className="text-xs text-amber-400/80 mt-2">Tip: sessions without a review give the AI less context. Click a row in the history table to add one.</p>
                    )}
                </div>

                {/* Result area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!result && !error && !isLoading && (
                        <p className="text-sm text-slate-500 text-center py-8">Click Generate to get personalised coaching feedback on your selected sessions.</p>
                    )}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                            <Loader2 size={28} className="animate-spin text-indigo-400" />
                            <p className="text-sm">Analysing your sessions…</p>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <p>{error}</p>
                        </div>
                    )}
                    {result && (
                        <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4">
                            <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{result}</pre>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800/80 shrink-0">
                    <button
                        onClick={generate}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {isLoading ? "Generating…" : result ? "Regenerate" : "Generate Review"}
                    </button>
                </div>
            </div>
        </div>
    );
}
