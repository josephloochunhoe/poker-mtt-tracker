"use client";
import { useState } from "react";
import { Tournament } from "./LiveTournament";
import { Search, Trash2, Loader2 } from "lucide-react";

export default function HistoryTable({
    tournaments,
    onDelete,
}: {
    tournaments: Tournament[];
    onDelete?: () => void;
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const completedTournaments = tournaments.filter(t => t.status === "Completed");

    const filtered = completedTournaments.filter(t =>
        t.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id.includes(searchTerm)
    );

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/tournaments?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Server responded with ${res.status}`);
            }
            setConfirmDeleteId(null);
            if (onDelete) onDelete();
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
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-600"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950/50 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4 text-center">Bullets</th>
                            <th className="px-6 py-4 text-center">Pos</th>
                            <th className="px-6 py-4 text-right">Invested</th>
                            <th className="px-6 py-4 text-right">Cashed</th>
                            <th className="px-6 py-4 text-right">Profit</th>
                            <th className="px-6 py-4 text-right">ROI</th>
                            <th className="px-6 py-4 text-center">Delete</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                    No completed sessions found. Play some tournaments!
                                </td>
                            </tr>
                        ) : filtered.map((t) => {
                            const totalInvested = t.bullets.reduce((sum, b) => sum + b.cost, 0);
                            const totalCashed = (t.cashWon || 0) + (t.bountiesWon || 0);
                            const profit = totalCashed - totalInvested;
                            const roi = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
                            const isProfit = profit > 0;
                            const isLoss = profit < 0;
                            const isConfirming = confirmDeleteId === t.id;
                            const isDeleting = deletingId === t.id;

                            return (
                                <tr key={t.id} className="hover:bg-slate-800/40 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                                        {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-white font-medium">
                                        WPT {t.type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className="bg-slate-800 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-700">{t.bullets.length}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-300">
                                        {t.finishPosition ? (
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${t.finishPosition <= 3 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 border border-slate-700'}`}>
                                                {t.finishPosition}{t.fieldSize ? `/${t.fieldSize}` : ''}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">
                                        ${totalInvested.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">
                                        ${totalCashed.toFixed(2)}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-right font-bold ${isProfit ? 'text-green-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {profit > 0 ? '+' : ''}${profit.toFixed(2)}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${isProfit ? 'text-green-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {roi > 0 ? '+' : ''}{roi.toFixed(1)}%
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {isConfirming ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleDelete(t.id)}
                                                    disabled={isDeleting}
                                                    className="text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {isDeleting ? <Loader2 size={12} className="animate-spin" /> : null}
                                                    Yes
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    disabled={isDeleting}
                                                    className="text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDeleteId(t.id)}
                                                title="Delete record"
                                                className="text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-400/10"
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
            </div>
        </div>
    );
}
