"use client";
import { useState } from "react";
import { Search, Trash2, Loader2 } from "lucide-react";
import { CashSession } from "./LiveCashSession";

export default function CashHistoryTable({
    sessions,
    onDelete,
}: {
    sessions: CashSession[];
    onDelete?: () => void;
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const completed = sessions.filter(s => s.status === "Completed");
    const filtered = completed.filter(s =>
        s.venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.stakes.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/tournaments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            setConfirmDeleteId(null);
            if (onDelete) onDelete();
        } catch (err) {
            console.error(err);
        } finally {
            setDeletingId(null);
        }
    };

    const gameLabel = sessions[0]?.gameCategory === "HomeGame" ? "Home Game" : "Cash Game";

    return (
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden ring-1 ring-white/5 mt-8">
            <div className="p-6 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-xl font-bold tracking-tight text-white">{gameLabel} History</h3>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search venue / stakes..."
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
                            <th className="px-6 py-4">Venue</th>
                            <th className="px-6 py-4">Stakes</th>
                            <th className="px-6 py-4 text-center">Duration</th>
                            <th className="px-6 py-4 text-right">Invested</th>
                            <th className="px-6 py-4 text-right">Cash Out</th>
                            <th className="px-6 py-4 text-right">Profit</th>
                            <th className="px-6 py-4 text-right">Hourly</th>
                            <th className="px-6 py-4 text-center">Delete</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                    No completed sessions yet. Get out there and play!
                                </td>
                            </tr>
                        ) : filtered.map((s) => {
                            const invested = s.bullets.reduce((sum, b) => sum + b.cost, 0);
                            const cashOut = s.cashOut || 0;
                            const profit = cashOut - invested;
                            const isProfit = profit > 0;
                            const isLoss = profit < 0;
                            const sym = s.currency === "USD" ? "$" : "RM ";
                            const isConfirming = confirmDeleteId === s.id;
                            const isDeleting = deletingId === s.id;

                            // Calculate session duration from first bullet start to last bullet end
                            const firstStart = new Date(s.bullets[0].registeredAt).getTime();
                            const lastBullet = s.bullets[s.bullets.length - 1];
                            const lastEnd = lastBullet.bustedAt ? new Date(lastBullet.bustedAt).getTime() : null;
                            const durationMs = lastEnd ? lastEnd - firstStart : null;
                            const durationHours = durationMs ? durationMs / (1000 * 60 * 60) : null;
                            const hourly = durationHours && durationHours > 0 ? profit / durationHours : null;

                            const formatDuration = (ms: number) => {
                                const h = Math.floor(ms / (1000 * 60 * 60));
                                const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                                return `${h}h ${m}m`;
                            };

                            return (
                                <tr key={s.id} className="hover:bg-slate-800/40 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                                        {new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-white font-medium">{s.venue}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="bg-slate-800 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-700">{s.stakes}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-400">
                                        {durationMs ? formatDuration(durationMs) : "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">
                                        {sym}{invested.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">
                                        {sym}{cashOut.toFixed(2)}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-right font-bold ${isProfit ? 'text-green-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {profit > 0 ? '+' : ''}{sym}{profit.toFixed(2)}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${hourly === null ? 'text-slate-500' : hourly >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                                        {hourly !== null ? `${hourly >= 0 ? '+' : ''}${sym}${hourly.toFixed(2)}/hr` : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {isConfirming ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleDelete(s.id)}
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
                                                onClick={() => setConfirmDeleteId(s.id)}
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
