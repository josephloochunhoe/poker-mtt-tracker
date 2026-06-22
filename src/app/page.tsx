"use client";
import { useEffect, useState } from "react";
import LiveTournament, { Tournament } from "@/components/LiveTournament";
import HistoryTable from "@/components/HistoryTable";
import { TrendingUp, DollarSign, Target, Activity, Loader2 } from "lucide-react";

export default function Dashboard() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTournaments = async () => {
        try {
            const res = await fetch("/api/tournaments");
            const data = await res.json();
            if (data.tournaments) {
                setTournaments(data.tournaments);
            }
        } catch (err) {
            console.error("Failed to fetch tournaments", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTournaments();
    }, []);

    // Calculate Top-Level Metrics
    const completed = tournaments.filter(t => t.status === "Completed");
    let totalInvested = 0;
    let totalCashed = 0;
    let totalBullets = 0;
    
    // Extract intervals to calculate true unique hours played (merging overlapping sessions)
    const intervals: { start: number; end: number }[] = [];

    completed.forEach(t => {
        t.bullets.forEach(b => {
            totalInvested += b.cost;
            totalBullets += 1;
            
            if (b.registeredAt && b.bustedAt) {
                intervals.push({
                    start: new Date(b.registeredAt).getTime(),
                    end: new Date(b.bustedAt).getTime()
                });
            }
        });
        totalCashed += (t.cashWon || 0) + (t.bountiesWon || 0);
    });

    // Merge overlapping intervals
    let totalHours = 0;
    if (intervals.length > 0) {
        // Sort intervals by start time
        const sorted = [...intervals].sort((a, b) => a.start - b.start);
        const merged = [sorted[0]];
        
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const last = merged[merged.length - 1];
            if (current.start <= last.end) {
                last.end = Math.max(last.end, current.end);
            } else {
                merged.push(current);
            }
        }
        
        let totalMs = 0;
        merged.forEach(interval => {
            totalMs += interval.end - interval.start;
        });
        totalHours = totalMs / (1000 * 60 * 60);
    }

    const netProfit = totalCashed - totalInvested;
    const roi = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;
    const abi = totalBullets > 0 ? totalInvested / totalBullets : 0;
    const hourly = totalHours > 0 ? netProfit / totalHours : 0;

    const activeTournaments = tournaments.filter(t => t.status === "Active");

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
            <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">
                    WPT <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Tracker</span>
                </h1>
                <p className="text-slate-400">Your comprehensive multi-table tournament performance.</p>
            </div>

            {/* High-Level Metrics Scorecard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                    title="Net Profit" 
                    value={`$${netProfit.toFixed(2)}`} 
                    icon={<DollarSign size={20} className={netProfit >= 0 ? "text-green-400" : "text-rose-400"} />} 
                    trend={netProfit >= 0 ? "positive" : "negative"}
                />
                <MetricCard 
                    title="Overall ROI" 
                    value={`${roi.toFixed(1)}%`} 
                    icon={<TrendingUp size={20} className={roi >= 0 ? "text-green-400" : "text-rose-400"} />} 
                    trend={roi >= 0 ? "positive" : "negative"}
                />
                <MetricCard 
                    title="Average Buy-In (ABI)" 
                    value={`$${abi.toFixed(2)}`} 
                    icon={<Target size={20} className="text-blue-400" />} 
                    trend="neutral"
                />
                <MetricCard 
                    title="Hourly Rate" 
                    value={`$${hourly.toFixed(2)}/hr`} 
                    icon={<Activity size={20} className={hourly >= 0 ? "text-green-400" : "text-rose-400"} />} 
                    trend={hourly >= 0 ? "positive" : "negative"}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Session Area */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold tracking-tight text-white">Active Sessions</h3>
                        {activeTournaments.length > 0 && (
                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                {activeTournaments.length} Running
                            </span>
                        )}
                    </div>
                    
                    {/* Render active tournaments */}
                    {activeTournaments.map(t => (
                        <LiveTournament 
                            key={t.id} 
                            initialTournament={t} 
                            onCompleted={fetchTournaments} 
                        />
                    ))}

                    {/* Always display a launcher card so users can start another session */}
                    <div className="border-t border-slate-800/80 pt-6">
                        <LiveTournament 
                            key="launcher" 
                            onCompleted={fetchTournaments} 
                        />
                    </div>
                </div>

                {/* History Area */}
                <div className="lg:col-span-2">
                    <HistoryTable tournaments={tournaments} />
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: "positive" | "negative" | "neutral" }) {
    const trendColor = trend === "positive" ? "text-green-400" : trend === "negative" ? "text-rose-400" : "text-slate-100";
    const bgGlow = trend === "positive" ? "from-green-500/5" : trend === "negative" ? "from-rose-500/5" : "from-blue-500/5";

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
