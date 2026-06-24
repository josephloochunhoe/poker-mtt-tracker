"use client";
import { useState } from "react";
import { PlusCircle, Flag, X, Loader2 } from "lucide-react";
import { Bullet } from "./LiveTournament";

export interface CashSession {
    id: string;
    date: string;
    gameCategory: "HomeGame" | "CashGame";
    venue: string;
    stakes: string;
    status: "Active" | "Completed";
    bullets: Bullet[];
    cashOut?: number;
    currency?: "USD" | "MYR";
}

interface LiveCashSessionProps {
    gameCategory: "HomeGame" | "CashGame";
    initialSession?: CashSession;
    onCompleted?: () => void;
}

export default function LiveCashSession({ gameCategory, initialSession, onCompleted }: LiveCashSessionProps) {
    const [session, setSession] = useState<CashSession | null>(initialSession || null);
    const [isSaving, setIsSaving] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [cashOutValue, setCashOutValue] = useState("");

    const [newBuyIn, setNewBuyIn] = useState("0");
    const [newVenue, setNewVenue] = useState("");
    const [newStakes, setNewStakes] = useState("");
    const [newCurrency, setNewCurrency] = useState<"USD" | "MYR">("MYR");
    const isLauncher = !initialSession;
    const totalInvested = session?.bullets.reduce((sum, b) => sum + b.cost, 0) || 0;
    const sym = session?.currency === "USD" ? "$" : "RM ";

    const label = gameCategory === "HomeGame" ? "Home Game" : "Cash Game";
    const prefix = gameCategory === "HomeGame" ? "home_" : "cash_";
    const accentColor = gameCategory === "HomeGame" ? "purple" : "emerald";

    const accentClasses = {
        purple: {
            icon: "bg-purple-500/10",
            iconText: "text-purple-400",
            ring: "focus:ring-purple-500/50 focus:border-purple-500",
            btn: "bg-purple-600 hover:bg-purple-500 hover:shadow-[0_0_20px_rgba(147,51,234,0.4)]",
            badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        },
        emerald: {
            icon: "bg-emerald-500/10",
            iconText: "text-emerald-400",
            ring: "focus:ring-emerald-500/50 focus:border-emerald-500",
            btn: "bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]",
            badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        },
    }[accentColor];

    const handleStart = async () => {
        setIsSaving(true);
        const newSession: CashSession = {
            id: `${prefix}${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            gameCategory,
            venue: newVenue.trim() || (gameCategory === "HomeGame" ? "Home Game" : "Casino"),
            stakes: newStakes.trim() || "-",
            status: "Active",
            currency: newCurrency,
            bullets: [{
                bulletNumber: 1,
                registeredAt: new Date().toISOString(),
                bustedAt: null,
                cost: parseFloat(newBuyIn) || 0,
            }],
        };

        try {
            await fetch("/api/tournaments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSession),
            });
            setNewBuyIn("0");
            setNewVenue("");
            setNewStakes("");
            setNewCurrency("MYR");
            if (onCompleted) onCompleted();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTopUp = async () => {
        if (!session) return;
        setIsSaving(true);
        const now = new Date().toISOString();
        const initialCost = session.bullets[0].cost;
        const lastIndex = session.bullets.length - 1;

        const newBullet: Bullet = {
            bulletNumber: session.bullets.length + 1,
            registeredAt: now,
            bustedAt: null,
            cost: initialCost,
        };

        const updatedBullets = [...session.bullets];
        updatedBullets[lastIndex] = { ...updatedBullets[lastIndex], bustedAt: now };
        updatedBullets.push(newBullet);

        setSession(prev => prev ? { ...prev, bullets: updatedBullets } : prev);

        try {
            await fetch("/api/tournaments", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "REBUY", id: session.id, bullets: updatedBullets }),
            });
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleComplete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session) return;
        setIsSaving(true);

        const now = new Date().toISOString();
        const cashOut = parseFloat(cashOutValue) || 0;
        const updatedBullets = [...session.bullets];
        updatedBullets[updatedBullets.length - 1] = { ...updatedBullets[updatedBullets.length - 1], bustedAt: now };

        setSession(prev => prev ? { ...prev, status: "Completed", bullets: updatedBullets, cashOut } : prev);
        setShowCompleteModal(false);

        try {
            await fetch("/api/tournaments", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "COMPLETE_CASH", id: session.id, cashOut, bullets: updatedBullets, status: "Completed" }),
            });
            if (onCompleted) onCompleted();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!session) {
        return (
            <div className="bg-slate-900/50 backdrop-blur-sm text-white rounded-2xl shadow-xl border border-slate-800/60 p-6 md:p-8 flex flex-col min-h-[300px]">
                <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 ${accentClasses.icon} rounded-xl flex items-center justify-center`}>
                        <PlusCircle className={accentClasses.iconText} size={22} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold tracking-tight">Start {label}</h3>
                        <p className="text-slate-400 text-xs">Log your session details</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Buy-In</label>
                            <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
                                {(["USD", "MYR"] as const).map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setNewCurrency(c)}
                                        className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-all ${newCurrency === c ? `${accentColor === "purple" ? "bg-purple-600" : "bg-emerald-600"} text-white` : "text-slate-400 hover:text-white"}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            type="number"
                            className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all text-white placeholder-slate-600 ${accentClasses.ring}`}
                            placeholder="e.g. 200"
                            value={newBuyIn}
                            onChange={(e) => setNewBuyIn(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                                {gameCategory === "HomeGame" ? "Host / Location" : "Casino"}
                            </label>
                            <input
                                type="text"
                                className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all text-white placeholder-slate-600 ${accentClasses.ring}`}
                                placeholder={gameCategory === "HomeGame" ? "e.g. John's" : "e.g. Crown"}
                                value={newVenue}
                                onChange={(e) => setNewVenue(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Stakes</label>
                            <input
                                type="text"
                                className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all text-white placeholder-slate-600 ${accentClasses.ring}`}
                                placeholder="e.g. 1/2"
                                value={newStakes}
                                onChange={(e) => setNewStakes(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleStart}
                        className={`w-full ${accentClasses.btn} text-white font-medium py-3 rounded-xl transition-all flex justify-center items-center gap-2 mt-4 disabled:opacity-50`}
                        disabled={isSaving || !newBuyIn}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : `Start ${label}`}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/80 backdrop-blur-sm text-white rounded-2xl shadow-xl overflow-hidden border border-slate-800/60 relative ring-1 ring-white/5">
            <div className="p-6 md:p-8">
                <div className="flex justify-between items-start mb-8 gap-4 flex-wrap">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${accentColor === "purple" ? "bg-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.6)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"} animate-pulse`}></span>
                            <h2 className="text-2xl font-bold tracking-tight break-words">{session.venue}</h2>
                        </div>
                        <p className="text-slate-400 text-sm ml-5">{session.stakes} · {(session.bullets.length > 0 ? new Date(session.bullets[0].registeredAt) : new Date(session.date)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Total In</p>
                        <p className="text-3xl font-black text-rose-400 tracking-tight">-{sym}{totalInvested}</p>
                    </div>
                </div>

                <div className="space-y-3 mb-8">
                    {session.bullets.map((bullet) => (
                        <div key={bullet.bulletNumber} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="bg-slate-950 px-2.5 py-1 rounded text-sm font-semibold text-slate-300 border border-slate-800">
                                    {bullet.bulletNumber === 1 ? "Buy-In" : `Top-Up #${bullet.bulletNumber - 1}`}
                                </div>
                                <span className="text-slate-400 text-sm">
                                    {new Date(bullet.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-slate-300 font-medium">{sym}{bullet.cost}</span>
                                {bullet.bustedAt ? (
                                    <span className="text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded-md text-xs font-medium border border-rose-400/20">Topped Up</span>
                                ) : (
                                    <span className={`${accentColor === "purple" ? "text-purple-400 bg-purple-400/10 border-purple-400/20" : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"} px-2.5 py-1 rounded-md text-xs font-medium border`}>Playing</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {session.status === "Active" && (
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={handleTopUp}
                            disabled={isSaving}
                            className="group flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3.5 px-4 rounded-xl font-medium transition-all border border-slate-700 hover:border-slate-600 disabled:opacity-50"
                        >
                            <PlusCircle size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                            Top Up
                        </button>
                        <button
                            onClick={() => setShowCompleteModal(true)}
                            disabled={isSaving}
                            className={`flex items-center justify-center gap-2 ${accentClasses.btn} text-white py-3.5 px-4 rounded-xl font-medium transition-all disabled:opacity-50`}
                        >
                            <Flag size={18} />
                            Cash Out
                        </button>
                    </div>
                )}
            </div>

            {showCompleteModal && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-20">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full shadow-2xl ring-1 ring-white/10 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold tracking-tight">Cash Out</h3>
                            <button onClick={() => setShowCompleteModal(false)} className="text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleComplete} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Cash Out Amount ({session?.currency || "MYR"})</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all text-white placeholder-slate-600 ${accentClasses.ring}`}
                                    placeholder="0.00"
                                    value={cashOutValue}
                                    onChange={(e) => setCashOutValue(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-400">Total Invested</span>
                                    <span className="text-slate-300">{sym}{totalInvested.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Estimated P/L</span>
                                    <span className={parseFloat(cashOutValue || "0") - totalInvested >= 0 ? "text-green-400 font-bold" : "text-rose-400 font-bold"}>
                                        {(parseFloat(cashOutValue || "0") - totalInvested) >= 0 ? "+" : ""}{sym}{(parseFloat(cashOutValue || "0") - totalInvested).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className={`w-full ${accentClasses.btn} text-white font-medium py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 mt-2 disabled:opacity-50`}
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : "Save Session"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
