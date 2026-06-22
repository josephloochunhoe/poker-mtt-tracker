"use client";
import { useState } from "react";
import { Tournament } from "./LiveTournament";
import { Search } from "lucide-react";

export default function HistoryTable({ tournaments }: { tournaments: Tournament[] }) {
    const [searchTerm, setSearchTerm] = useState("");

    const completedTournaments = tournaments.filter(t => t.status === "Completed");

    const filtered = completedTournaments.filter(t => 
        t.type.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.id.includes(searchTerm)
    );

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
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
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

                            return (
                                <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
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
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
