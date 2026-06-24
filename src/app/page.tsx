"use client";
import { useEffect, useState } from "react";
import LiveTournament, { Tournament } from "@/components/LiveTournament";
import HistoryTable from "@/components/HistoryTable";
import LiveCashSession, { CashSession } from "@/components/LiveCashSession";
import CashHistoryTable from "@/components/CashHistoryTable";
import { TrendingUp, DollarSign, Target, Activity, Loader2 } from "lucide-react";
import CurrencyConverter from "@/components/CurrencyConverter";

type Tab = "MTT" | "HomeGame" | "CashGame" | "Converter";

export default function Dashboard() {
    const [allRecords, setAllRecords] = useState<(Tournament | CashSession)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("MTT");

    const fetchAll = async () => {
        try {
            const res = await fetch("/api/tournaments");
            const data = await res.json();
            if (data.tournaments) setAllRecords(data.tournaments);
        } catch (err) {
            console.error("Failed to fetch", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    // Split records by type
    const isCashSession = (r: Tournament | CashSession): r is CashSession =>
        (r as CashSession).gameCategory === "HomeGame" || (r as CashSession).gameCategory === "CashGame";

    const tournaments = allRecords.filter((r): r is Tournament => !isCashSession(r));
    const homeGames = allRecords.filter((r): r is CashSession => isCashSession(r) && r.gameCategory === "HomeGame");
    const cashGames = allRecords.filter((r): r is CashSession => isCashSession(r) && r.gameCategory === "CashGame");

    // MTT metrics
    const completedMTT = tournaments.filter(t => t.status === "Completed");
    let mttInvested = 0, mttCashed = 0, mttBullets = 0;
    const mttIntervals: { start: number; end: number }[] = [];
    completedMTT.forEach(t => {
        t.bullets.forEach(b => {
            mttInvested += b.cost;
            mttBullets++;
            if (b.registeredAt && b.bustedAt)
                mttIntervals.push({ start: new Date(b.registeredAt).getTime(), end: new Date(b.bustedAt).getTime() });
        });
        mttCashed += (t.cashWon || 0) + (t.bountiesWon || 0);
    });
    const mttHours = calcMergedHours(mttIntervals);
    const mttProfit = mttCashed - mttInvested;
    const mttROI = mttInvested > 0 ? (mttProfit / mttInvested) * 100 : 0;
    const mttABI = mttBullets > 0 ? mttInvested / mttBullets : 0;
    const mttHourly = mttHours > 0 ? mttProfit / mttHours : 0;

    // Cash/Home metrics
    const cashMetrics = (sessions: CashSession[]) => {
        const completed = sessions.filter(s => s.status === "Completed");
        let invested = 0, cashOut = 0, totalMs = 0, sessionCount = 0;
        completed.forEach(s => {
            const inv = s.bullets.reduce((sum, b) => sum + b.cost, 0);
            invested += inv;
            cashOut += s.cashOut || 0;
            const first = new Date(s.bullets[0].registeredAt).getTime();
            const last = s.bullets[s.bullets.length - 1];
            if (last.bustedAt) { totalMs += new Date(last.bustedAt).getTime() - first; sessionCount++; }
        });
        const hours = totalMs / (1000 * 60 * 60);
        const profit = cashOut - invested;
        return { profit, hours, hourly: hours > 0 ? profit / hours : 0, sessions: completed.length };
    };

    const homeMetrics = cashMetrics(homeGames);
    const cashMetricsData = cashMetrics(cashGames);

    // Overall net profit (all game types combined)
    const overallProfit = mttProfit + homeMetrics.profit + cashMetricsData.profit;

    const activeTournaments = tournaments.filter(t => t.status === "Active");
    const activeHomeGames = homeGames.filter(s => s.status === "Active");
    const activeCashGames = cashGames.filter(s => s.status === "Active");

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">
                      Poker <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Tracker</span>
                    </h1>
                    <p className="text-slate-400">Your comprehensive poker performance dashboard.</p>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-5 py-3 text-right">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Overall Net Profit</p>
                    <p className={`text-2xl font-black tracking-tight ${overallProfit >= 0 ? "text-green-400" : "text-rose-400"}`}>
                        {overallProfit >= 0 ? "+" : ""}${overallProfit.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-1.5 w-fit flex-wrap">
                {(["MTT", "HomeGame", "CashGame", "Converter"] as Tab[]).map(tab => {
                    const labels: Record<Tab, string> = { MTT: "MTT", HomeGame: "Home Games", CashGame: "Cash Games", Converter: "Converter" };
                    const active = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                                active
                                    ? tab === "MTT" ? "bg-blue-600 text-white shadow-lg"
                                    : tab === "HomeGame" ? "bg-purple-600 text-white shadow-lg"
                                    : tab === "CashGame" ? "bg-emerald-600 text-white shadow-lg"
                                    : "bg-amber-600 text-white shadow-lg"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            {labels[tab]}
                        </button>
                    );
                })}
            </div>

            {/* MTT Tab */}
            {activeTab === "MTT" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard title="Net Profit" value={`$${mttProfit.toFixed(2)}`} icon={<DollarSign size={20} className={mttProfit >= 0 ? "text-green-400" : "text-rose-400"} />} trend={mttProfit >= 0 ? "positive" : "negative"} />
                        <MetricCard title="Overall ROI" value={`${mttROI.toFixed(1)}%`} icon={<TrendingUp size={20} className={mttROI >= 0 ? "text-green-400" : "text-rose-400"} />} trend={mttROI >= 0 ? "positive" : "negative"} />
                        <MetricCard title="Avg Buy-In (ABI)" value={`$${mttABI.toFixed(2)}`} icon={<Target size={20} className="text-blue-400" />} trend="neutral" />
                        <MetricCard title="Hourly Rate" value={`$${mttHourly.toFixed(2)}/hr`} icon={<Activity size={20} className={mttHourly >= 0 ? "text-green-400" : "text-rose-400"} />} trend={mttHourly >= 0 ? "positive" : "negative"} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold tracking-tight text-white">Active Sessions</h3>
                                {activeTournaments.length > 0 && (
                                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                        {activeTournaments.length} Running
                                    </span>
                                )}
                            </div>
                            {activeTournaments.map(t => (
                                <LiveTournament key={t.id} initialTournament={t} onCompleted={fetchAll} />
                            ))}
                            <div className="border-t border-slate-800/80 pt-6">
                                <LiveTournament key="launcher" onCompleted={fetchAll} />
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <HistoryTable tournaments={tournaments} onDelete={fetchAll} />
                        </div>
                    </div>
                </>
            )}

            {/* Home Games Tab */}
            {activeTab === "HomeGame" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard title="Net Profit" value={`$${homeMetrics.profit.toFixed(2)}`} icon={<DollarSign size={20} className={homeMetrics.profit >= 0 ? "text-green-400" : "text-rose-400"} />} trend={homeMetrics.profit >= 0 ? "positive" : "negative"} accent="purple" />
                        <MetricCard title="Hourly Rate" value={`$${homeMetrics.hourly.toFixed(2)}/hr`} icon={<Activity size={20} className={homeMetrics.hourly >= 0 ? "text-green-400" : "text-rose-400"} />} trend={homeMetrics.hourly >= 0 ? "positive" : "negative"} accent="purple" />
                        <MetricCard title="Sessions Played" value={`${homeMetrics.sessions}`} icon={<Target size={20} className="text-purple-400" />} trend="neutral" accent="purple" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold tracking-tight text-white">Active Sessions</h3>
                                {activeHomeGames.length > 0 && (
                                    <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                        {activeHomeGames.length} Running
                                    </span>
                                )}
                            </div>
                            {activeHomeGames.map(s => (
                                <LiveCashSession key={s.id} gameCategory="HomeGame" initialSession={s} onCompleted={fetchAll} />
                            ))}
                            <div className="border-t border-slate-800/80 pt-6">
                                <LiveCashSession gameCategory="HomeGame" onCompleted={fetchAll} />
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            {homeGames.length > 0 ? (
                                <CashHistoryTable sessions={homeGames} onDelete={fetchAll} />
                            ) : (
                                <div className="mt-8 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500">
                                    No home game sessions recorded yet.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Currency Converter Tab */}
            {activeTab === "Converter" && (
                <>
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Currency Converter</h2>
                        <p className="text-slate-400 text-sm mb-6">Rates cached server-side every 12 hours · All calculations run locally.</p>
                        <CurrencyConverter />
                    </div>
                </>
            )}

            {/* Cash Games Tab */}
            {activeTab === "CashGame" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard title="Net Profit" value={`$${cashMetricsData.profit.toFixed(2)}`} icon={<DollarSign size={20} className={cashMetricsData.profit >= 0 ? "text-green-400" : "text-rose-400"} />} trend={cashMetricsData.profit >= 0 ? "positive" : "negative"} accent="emerald" />
                        <MetricCard title="Hourly Rate" value={`$${cashMetricsData.hourly.toFixed(2)}/hr`} icon={<Activity size={20} className={cashMetricsData.hourly >= 0 ? "text-green-400" : "text-rose-400"} />} trend={cashMetricsData.hourly >= 0 ? "positive" : "negative"} accent="emerald" />
                        <MetricCard title="Sessions Played" value={`${cashMetricsData.sessions}`} icon={<Target size={20} className="text-emerald-400" />} trend="neutral" accent="emerald" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold tracking-tight text-white">Active Sessions</h3>
                                {activeCashGames.length > 0 && (
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                        {activeCashGames.length} Running
                                    </span>
                                )}
                            </div>
                            {activeCashGames.map(s => (
                                <LiveCashSession key={s.id} gameCategory="CashGame" initialSession={s} onCompleted={fetchAll} />
                            ))}
                            <div className="border-t border-slate-800/80 pt-6">
                                <LiveCashSession gameCategory="CashGame" onCompleted={fetchAll} />
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            {cashGames.length > 0 ? (
                                <CashHistoryTable sessions={cashGames} onDelete={fetchAll} />
                            ) : (
                                <div className="mt-8 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500">
                                    No live cash sessions recorded yet.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function calcMergedHours(intervals: { start: number; end: number }[]) {
    if (intervals.length === 0) return 0;
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        const cur = sorted[i];
        const last = merged[merged.length - 1];
        if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
        else merged.push(cur);
    }
    return merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / (1000 * 60 * 60);
}

function MetricCard({ title, value, icon, trend, accent = "blue" }: {
    title: string;
    value: string;
    icon: React.ReactNode;
    trend: "positive" | "negative" | "neutral";
    accent?: "blue" | "purple" | "emerald";
}) {
    const trendColor = trend === "positive" ? "text-green-400" : trend === "negative" ? "text-rose-400" : "text-slate-100";
    const bgGlow = trend === "positive" ? "from-green-500/5" : trend === "negative" ? "from-rose-500/5" : accent === "purple" ? "from-purple-500/5" : accent === "emerald" ? "from-emerald-500/5" : "from-blue-500/5";

    return (
        <div className={`bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden bg-gradient-to-br ${bgGlow} to-transparent ring-1 ring-white/5`}>
            <div className="flex justify-between items-start mb-4">
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">{title}</p>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 shadow-inner">
                    {icon}
                </div>
            </div>
            <h4 className={`text-3xl font-black tracking-tight ${trendColor}`}>{value}</h4>
        </div>
    );
}
