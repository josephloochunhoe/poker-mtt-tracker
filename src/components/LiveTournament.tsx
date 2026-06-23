"use client";
import { useState } from "react";
import { PlusCircle, Flag, X, Loader2 } from "lucide-react";

export interface Bullet {
    bulletNumber: number;
    registeredAt: string;
    bustedAt: string | null;
    cost: number;
}

export interface Tournament {
    id: string;
    date: string;
    type: string;
    speed: string;
    status: "Active" | "Completed";
    bullets: Bullet[];
    finishPosition?: number;
    fieldSize?: number;
    cashWon?: number;
    bountiesWon?: number;
}

interface LiveTournamentProps {
    initialTournament?: Tournament;
    onCompleted?: () => void;
}

export default function LiveTournament({ initialTournament, onCompleted }: LiveTournamentProps) {
    const [tournament, setTournament] = useState<Tournament | null>(initialTournament || null);
    const [isSaving, setIsSaving] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [formData, setFormData] = useState({
        finishPosition: "",
        fieldSize: "",
        cashWon: "",
        bountiesWon: "",
    });

    // Form state for creating a new tournament
    const [newBuyIn, setNewBuyIn] = useState("0");
    const [newType, setNewType] = useState("Standard");
    const [newSpeed, setNewSpeed] = useState("Regular");

    const totalInvested = tournament?.bullets.reduce((sum, bullet) => sum + bullet.cost, 0) || 0;

    const isLauncher = !initialTournament;

    const handleStartNew = async (type: string, speed: string, initialBuyIn: number) => {
        setIsSaving(true);
        const newTournament: Tournament = {
            id: `wpt_${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            type: type,
            speed: speed,
            status: "Active",
            bullets: [
                {
                    bulletNumber: 1,
                    registeredAt: new Date().toISOString(),
                    bustedAt: null,
                    cost: initialBuyIn,
                },
            ],
        };

        try {
            await fetch("/api/tournaments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTournament),
            });
            if (isLauncher) {
                setNewBuyIn("0");
                setNewType("Standard");
                setNewSpeed("Regular");
                if (onCompleted) onCompleted();
            } else {
                setTournament(newTournament);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRebuy = async () => {
        if (!tournament) return;
        setIsSaving(true);
        const now = new Date().toISOString();
        const lastIndex = tournament.bullets.length - 1;
        const initialBuyIn = tournament.bullets[0].cost;

        const newBullet = {
            bulletNumber: tournament.bullets.length + 1,
            registeredAt: now,
            bustedAt: null,
            cost: initialBuyIn,
        };

        const updatedBullets = [...tournament.bullets];
        updatedBullets[lastIndex].bustedAt = now;
        updatedBullets.push(newBullet);

        // Optimistic update
        setTournament((prev) => {
            if (!prev) return prev;
            return { ...prev, bullets: updatedBullets };
        });

        // API Call
        try {
            const res = await fetch("/api/tournaments", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "REBUY",
                    id: tournament.id,
                    bullets: updatedBullets,
                }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Server responded with ${res.status}`);
            }
        } catch (err) {
            console.error("Failed to append bullet:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const submitCompletion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tournament) return;
        setIsSaving(true);

        const now = new Date().toISOString();
        const finishPos = parseInt(formData.finishPosition) || undefined;
        const fieldSz = parseInt(formData.fieldSize) || undefined;
        const cashW = parseFloat(formData.cashWon) || 0;
        const bountiesW = parseFloat(formData.bountiesWon) || 0;

        const updatedBullets = [...tournament.bullets];
        updatedBullets[updatedBullets.length - 1].bustedAt = now;

        const completedTournament: Tournament = {
            ...tournament,
            status: "Completed",
            bullets: updatedBullets,
            finishPosition: finishPos,
            fieldSize: fieldSz,
            cashWon: cashW,
            bountiesWon: bountiesW,
        };

        // Optimistic
        setTournament(completedTournament);
        setShowCompleteModal(false);

        try {
            const res = await fetch("/api/tournaments", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "COMPLETE",
                    id: tournament.id,
                    status: "Completed",
                    finishPosition: finishPos,
                    fieldSize: fieldSz,
                    cashWon: cashW,
                    bountiesWon: bountiesW,
                    bullets: updatedBullets,
                }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Server responded with ${res.status}`);
            }
            if (onCompleted) onCompleted();
        } catch (err) {
            console.error("Failed to complete:", err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!tournament) {
        return (
            <div className="bg-slate-900/50 backdrop-blur-sm text-white rounded-2xl shadow-xl border border-slate-800/60 p-6 md:p-8 flex flex-col min-h-[300px]">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                        <PlusCircle className="text-blue-400" size={22} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold tracking-tight">Start New Session</h3>
                        <p className="text-slate-400 text-xs">Configure your tournament details</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Buy-In ($)</label>
                        <input
                            type="number"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-600"
                            placeholder="e.g. 110"
                            value={newBuyIn}
                            onChange={(e) => setNewBuyIn(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Type</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white [&>option]:bg-slate-900"
                                value={newType}
                                onChange={(e) => setNewType(e.target.value)}
                            >
                                <option value="Standard">Standard</option>
                                <option value="PKO">PKO</option>
                                <option value="Mystery Bounty">Mystery Bounty</option>
                                <option value="Satellite">Satellite</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Speed</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white [&>option]:bg-slate-900"
                                value={newSpeed}
                                onChange={(e) => setNewSpeed(e.target.value)}
                            >
                                <option value="Regular">Regular</option>
                                <option value="Turbo">Turbo</option>
                                <option value="Hyper">Hyper</option>
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={() => handleStartNew(newType, newSpeed, parseFloat(newBuyIn) || 0)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] flex justify-center items-center gap-2 mt-4 disabled:opacity-50"
                        disabled={isSaving || !newBuyIn}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : "Launch Tournament"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/80 backdrop-blur-sm text-white rounded-2xl shadow-xl overflow-hidden border border-slate-800/60 relative ring-1 ring-white/5">
            <div className="p-6 md:p-8">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></span>
                            <h2 className="text-2xl font-bold tracking-tight">WPT {tournament.type}</h2>
                        </div>
                        <p className="text-slate-400 text-sm ml-5">{new Date(tournament.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Total Invested</p>
                        <p className="text-3xl font-black text-rose-400 tracking-tight">-${totalInvested}</p>
                    </div>
                </div>

                <div className="space-y-3 mb-8">
                    {tournament.bullets.map((bullet) => (
                        <div key={bullet.bulletNumber} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="bg-slate-950 px-2.5 py-1 rounded text-sm font-semibold text-slate-300 border border-slate-800">
                                    #{bullet.bulletNumber}
                                </div>
                                <span className="text-slate-400 text-sm">
                                    {new Date(bullet.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <span className="text-slate-400 text-sm flex items-center gap-2">
                                {bullet.bustedAt ?
                                    <span className="text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded-md text-xs font-medium border border-rose-400/20">Busted</span> :
                                    <span className="text-green-400 bg-green-400/10 px-2.5 py-1 rounded-md text-xs font-medium border border-green-400/20">Playing</span>
                                }
                            </span>
                        </div>
                    ))}
                </div>

                {tournament.status === "Active" && (
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={handleRebuy}
                            disabled={isSaving}
                            className="group flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3.5 px-4 rounded-xl font-medium transition-all border border-slate-700 hover:border-slate-600 disabled:opacity-50"
                        >
                            <PlusCircle size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                            Fire Rebuy
                        </button>
                        <button
                            onClick={() => setShowCompleteModal(true)}
                            disabled={isSaving}
                            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3.5 px-4 rounded-xl font-medium transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50"
                        >
                            <Flag size={18} />
                            Complete
                        </button>
                    </div>
                )}
            </div>

            {/* Completion Modal */}
            {showCompleteModal && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-20 transition-all">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full shadow-2xl ring-1 ring-white/10 transform scale-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold tracking-tight">Complete Session</h3>
                            <button onClick={() => setShowCompleteModal(false)} className="text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={submitCompletion} className="space-y-5">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Finish Position</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-600"
                                        placeholder="e.g. 15"
                                        value={formData.finishPosition}
                                        onChange={(e) => setFormData({ ...formData, finishPosition: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Field Size</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-600"
                                        placeholder="e.g. 350"
                                        value={formData.fieldSize}
                                        onChange={(e) => setFormData({ ...formData, fieldSize: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Cash Won ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-white placeholder-slate-600"
                                        placeholder="0.00"
                                        value={formData.cashWon}
                                        onChange={(e) => setFormData({ ...formData, cashWon: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Bounties ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-white placeholder-slate-600"
                                        placeholder="0.00"
                                        value={formData.bountiesWon}
                                        onChange={(e) => setFormData({ ...formData, bountiesWon: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] flex justify-center items-center gap-2 mt-2 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : "Save Results"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}