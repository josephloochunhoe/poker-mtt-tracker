"use client";
import { useState } from "react";
import { PlusCircle, Flag, X, Loader2, Layers, Skull, Trophy, Briefcase, Clock } from "lucide-react";
import { useMYRRate } from "@/hooks/useMYRRate";
import { defaultSessionName } from "@/lib/analytics";
import { nowUTC8, todayUTC8, formatShortDateFromISO, formatShortTimeFromISO } from "@/lib/time";

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
    currency?: "USD" | "MYR";
    sessionName?: string;              // User-defined label (e.g., "Golden Bounty - Day 1A")
    isPhased?: boolean;                // True if part of a multi-flight event
    phasedStage?: "Day 1" | "Day 2";  // Tracks which stage this document represents
    flightStatus?: "Playing" | "Busted" | "Advanced"; // For Day 1 flights
    parentTournamentId?: string;        // If Day 2, links back to the qualifying Day 1 ID
    additionalParentIds?: string[];     // Extra Day 1 flights whose chips merged into this Day 2
    review?: string;                    // Free-text session review / bust-out notes
    lateRegMinutesRemaining?: number;   // Minutes left in late reg window when player joined
    lateRegPercentage?: number;         // How deep into the late reg window the player joined (0–100)
}

/** Pre-fill payload used to launch a Day 2 Final from a qualifying Day 1 flight. */
export interface Day2Prefill {
    sessionName: string;
    type: string;
    speed: string;
    currency: "USD" | "MYR";
    parentTournamentId: string;
}

interface LiveTournamentProps {
    initialTournament?: Tournament;
    onCompleted?: () => void;
    /** When provided, the launcher opens pre-filled to start a Day 2 Final. */
    prefill?: Day2Prefill;
    /** Called to dismiss a pending Day 2 pre-fill. */
    onCancelPrefill?: () => void;
}

export default function LiveTournament({ initialTournament, onCompleted, prefill, onCancelPrefill }: LiveTournamentProps) {
    const [tournament, setTournament] = useState<Tournament | null>(initialTournament || null);
    const [isSaving, setIsSaving] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    // Completion outcome: for phased Day 1 flights the user can bag/advance to Day 2.
    const [outcome, setOutcome] = useState<"busted" | "won" | "advanced">("busted");
    const [formData, setFormData] = useState({
        finishPosition: "",
        fieldSize: "",
        cashWon: "",
        bountiesWon: "",
        review: "",
    });

    // Form state for creating a new tournament (seeded from a Day 2 pre-fill when present)
    const [newBuyIn, setNewBuyIn] = useState(prefill ? "0" : "0");
    const [newType, setNewType] = useState(prefill?.type || "Standard");
    const [newSpeed, setNewSpeed] = useState(prefill?.speed || "Regular");
    const [newCurrency, setNewCurrency] = useState<"USD" | "MYR">(prefill?.currency || "USD");
    const [newSessionName, setNewSessionName] = useState(prefill?.sessionName || "");
    const [sessionNameTouched, setSessionNameTouched] = useState(!!prefill);
    const [isPhasedDay1, setIsPhasedDay1] = useState(false);

    // Registration timing inputs (all optional — only saved when all three are provided)
    const [regStartTime, setRegStartTime] = useState("");
    const [regEndTime, setRegEndTime] = useState("");
    const [regJoinTime, setRegJoinTime] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    });

    const myrRate = useMYRRate();

    // Resolved session name: smart default unless the user has typed their own.
    const computedDefaultName = prefill ? prefill.sessionName : defaultSessionName(newType, newSpeed);
    const resolvedSessionName = sessionNameTouched ? newSessionName : computedDefaultName;
    const isDay2 = !!prefill;
    const totalInvested = tournament?.bullets.reduce((sum, bullet) => sum + bullet.cost, 0) || 0;
    const sym = tournament?.currency === "MYR" ? "RM " : "$";

    const isLauncher = !initialTournament;

    const regTimingPreview = (() => {
        if (!regStartTime || !regEndTime || !regJoinTime) return null;
        const toMins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
        const startMins = toMins(regStartTime);
        let endMins = toMins(regEndTime);
        let joinMins = toMins(regJoinTime);
        if (endMins < startMins) endMins += 24 * 60;
        if (joinMins < startMins) joinMins += 24 * 60;
        const totalWindow = endMins - startMins;
        if (totalWindow <= 0) return null;
        const minsRemaining = Math.max(0, endMins - joinMins);
        const pct = Math.round((1 - minsRemaining / totalWindow) * 100);
        return { minsRemaining, pct };
    })();

    const handleStartNew = async (type: string, speed: string, initialBuyIn: number, currency: "USD" | "MYR") => {
        setIsSaving(true);
        // A Day 2 Final binds to its parent; bullet #1 is free (paid on Day 1).
        // A flagged Day 1 flight starts a phased event in the "Playing" state.
        const phased = isDay2 || isPhasedDay1;
        const newTournament: Tournament = {
            id: `tournament_${Date.now()}`,
            date: todayUTC8(),
            type: type,
            speed: speed,
            status: "Active",
            currency,
            sessionName: resolvedSessionName || computedDefaultName,
            ...(phased ? { isPhased: true } : {}),
            ...(phased ? { phasedStage: (isDay2 ? "Day 2" : "Day 1") as "Day 1" | "Day 2" } : {}),
            ...(isPhasedDay1 && !isDay2 ? { flightStatus: "Playing" as const } : {}),
            ...(isDay2 && prefill ? { parentTournamentId: prefill.parentTournamentId } : {}),
            ...(regTimingPreview ? {
                lateRegMinutesRemaining: regTimingPreview.minsRemaining,
                lateRegPercentage: regTimingPreview.pct,
            } : {}),
            bullets: [
                {
                    bulletNumber: 1,
                    registeredAt: nowUTC8(),
                    bustedAt: null,
                    cost: isDay2 ? 0 : initialBuyIn,
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
                setNewCurrency("USD");
                setNewSessionName("");
                setSessionNameTouched(false);
                setIsPhasedDay1(false);
                setRegStartTime("");
                setRegEndTime("");
                const now = new Date();
                setRegJoinTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
                if (onCancelPrefill) onCancelPrefill();
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
        const now = nowUTC8();
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

    const isPhasedDay1Flight = !!tournament?.isPhased && tournament?.phasedStage === "Day 1";

    const submitCompletion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tournament) return;
        setIsSaving(true);

        const advanced = isPhasedDay1Flight && outcome === "advanced";
        const now = nowUTC8();
        // Bagged/advanced flights keep no finish position or field size and win no cash.
        const finishPos = advanced ? undefined : (parseInt(formData.finishPosition) || undefined);
        const fieldSz = advanced ? undefined : (parseInt(formData.fieldSize) || undefined);
        const cashW = advanced ? 0 : (parseFloat(formData.cashWon) || 0);
        const bountiesW = parseFloat(formData.bountiesWon) || 0;
        // Persist the flight outcome for phased Day 1 flights only.
        const flightStatus: Tournament["flightStatus"] | undefined = isPhasedDay1Flight
            ? (advanced ? "Advanced" : "Busted")
            : undefined;

        const updatedBullets = [...tournament.bullets];
        updatedBullets[updatedBullets.length - 1].bustedAt = now;

        const reviewText = formData.review.trim() || undefined;

        const completedTournament: Tournament = {
            ...tournament,
            status: "Completed",
            bullets: updatedBullets,
            finishPosition: finishPos,
            fieldSize: fieldSz,
            cashWon: cashW,
            bountiesWon: bountiesW,
            ...(flightStatus ? { flightStatus } : {}),
            ...(reviewText ? { review: reviewText } : {}),
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
                    flightStatus,
                    review: reviewText,
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
            <div className={`bg-slate-900/50 backdrop-blur-sm text-white rounded-2xl shadow-xl border p-6 md:p-8 flex flex-col min-h-[300px] ${isDay2 ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-slate-800/60"}`}>
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDay2 ? "bg-amber-500/10" : "bg-blue-500/10"}`}>
                            {isDay2 ? <Trophy className="text-amber-400" size={22} /> : <PlusCircle className="text-blue-400" size={22} />}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold tracking-tight">{isDay2 ? "Launch Day 2 Final" : "Start New Session"}</h3>
                            <p className="text-slate-400 text-xs">{isDay2 ? "Pre-filled from your qualifying Day 1 flight" : "Configure your tournament details"}</p>
                        </div>
                    </div>
                    {isDay2 && onCancelPrefill && (
                        <button
                            type="button"
                            onClick={onCancelPrefill}
                            className="text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg"
                            title="Cancel Day 2 launch"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {isDay2 && (
                    <div className="mb-5 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-300/90 text-xs">
                        <Trophy size={14} className="shrink-0" />
                        <span>Bullet&nbsp;#1 is free — you already paid your buy-in on Day&nbsp;1. Screen time starts immediately.</span>
                    </div>
                )}

                <div className="space-y-4">
                    {/* Session Name — top of the form, smart-defaulted from the selections below */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Session Name</label>
                        <input
                            type="text"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-600"
                            placeholder={computedDefaultName}
                            value={resolvedSessionName}
                            onChange={(e) => { setSessionNameTouched(true); setNewSessionName(e.target.value); }}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">{isDay2 ? "Buy-In (paid on Day 1)" : "Buy-In"}</label>
                            <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
                                {(["USD", "MYR"] as const).map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setNewCurrency(c)}
                                        className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-all ${newCurrency === c ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            type="number"
                            disabled={isDay2}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder={newCurrency === "USD" ? "e.g. 110" : "e.g. 500"}
                            value={isDay2 ? "0" : newBuyIn}
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

                    {/* Phased / multi-flight flag — not shown for a Day 2 launch (already phased) */}
                    {!isDay2 && (
                        <button
                            type="button"
                            onClick={() => setIsPhasedDay1(v => !v)}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all text-left ${isPhasedDay1 ? "bg-indigo-500/10 border-indigo-500/40" : "bg-slate-950 border-slate-800 hover:border-slate-700"}`}
                        >
                            <span className="flex items-center gap-2.5">
                                <Layers size={16} className={isPhasedDay1 ? "text-indigo-400" : "text-slate-500"} />
                                <span className="flex flex-col">
                                    <span className="text-sm font-medium text-white">Phased / Multi-Flight (Day 1)</span>
                                    <span className="text-[11px] text-slate-500">Bag & advance survivors to a Day 2 Final</span>
                                </span>
                            </span>
                            <span className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${isPhasedDay1 ? "bg-indigo-500" : "bg-slate-700"}`}>
                                <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${isPhasedDay1 ? "translate-x-4" : "translate-x-0"}`} />
                            </span>
                        </button>
                    )}

                    {/* Registration Timing — optional; records how late the player joined */}
                    <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Clock size={13} className="text-slate-500" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Registration Timing</span>
                            <span className="text-[10px] text-slate-600">optional</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Start Time</label>
                                <input
                                    type="time"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white [color-scheme:dark]"
                                    value={regStartTime}
                                    onChange={(e) => setRegStartTime(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Late Reg End</label>
                                <input
                                    type="time"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white [color-scheme:dark]"
                                    value={regEndTime}
                                    onChange={(e) => setRegEndTime(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Join Time</label>
                                <input
                                    type="time"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white [color-scheme:dark]"
                                    value={regJoinTime}
                                    onChange={(e) => setRegJoinTime(e.target.value)}
                                />
                            </div>
                        </div>
                        {regTimingPreview && (
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300/80 flex items-center gap-2">
                                <Clock size={11} className="shrink-0 text-blue-400" />
                                <span>
                                    Entering at <span className="font-bold text-white">{regTimingPreview.pct}%</span> of Late Reg (<span className="font-bold text-white">{regTimingPreview.minsRemaining}</span> mins remaining)
                                </span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => handleStartNew(newType, newSpeed, parseFloat(newBuyIn) || 0, newCurrency)}
                        className={`w-full text-white font-medium py-3 rounded-xl transition-all flex justify-center items-center gap-2 mt-4 disabled:opacity-50 ${isDay2 ? "bg-amber-600 hover:bg-amber-500 hover:shadow-[0_0_20px_rgba(217,119,6,0.4)]" : "bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]"}`}
                        disabled={isSaving || (!isDay2 && !newBuyIn)}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : isDay2 ? "Launch Day 2 Final" : "Launch Tournament"}
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
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)] shrink-0"></span>
                            <h2 className="text-2xl font-bold tracking-tight break-words">{tournament.sessionName || tournament.type}</h2>
                            {tournament.isPhased && tournament.phasedStage && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${tournament.phasedStage === "Day 2" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"}`}>
                                    {tournament.phasedStage}
                                </span>
                            )}
                        </div>
                        <p className="text-slate-400 text-sm ml-5">
                            {tournament.type} · {formatShortDateFromISO(tournament.bullets.length > 0 ? tournament.bullets[0].registeredAt : tournament.date)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Total Invested</p>
                        <p className="text-3xl font-black text-rose-400 tracking-tight">-{sym}{totalInvested}</p>
                        {tournament.currency === "USD" && myrRate && (
                            <p className="text-xs text-slate-500 mt-0.5">(RM {(totalInvested * myrRate).toFixed(2)})</p>
                        )}
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
                                    {formatShortTimeFromISO(bullet.registeredAt)}
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
                            onClick={() => { setOutcome("busted"); setShowCompleteModal(true); }}
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
                        {/* Outcome selector — only phased Day 1 flights can bag & advance */}
                        {isPhasedDay1Flight && (
                            <div className="grid grid-cols-3 gap-2 mb-5">
                                {([
                                    { key: "busted", label: "Busted", icon: <Skull size={15} />, active: "bg-rose-600 border-rose-500 text-white", idle: "border-slate-700 text-slate-400 hover:text-white" },
                                    { key: "won", label: "Won", icon: <Trophy size={15} />, active: "bg-green-600 border-green-500 text-white", idle: "border-slate-700 text-slate-400 hover:text-white" },
                                    { key: "advanced", label: "Bagged", icon: <Briefcase size={15} />, active: "bg-amber-600 border-amber-500 text-white", idle: "border-slate-700 text-slate-400 hover:text-white" },
                                ] as const).map(opt => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setOutcome(opt.key)}
                                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all ${outcome === opt.key ? opt.active : `bg-slate-950 ${opt.idle}`}`}
                                    >
                                        {opt.icon}
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {isPhasedDay1Flight && outcome === "advanced" && (
                            <div className="mb-5 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-300/90 text-xs">
                                <Briefcase size={14} className="shrink-0" />
                                <span>Bagged & advanced to Day&nbsp;2. No cash this flight — record any bounties banked, then launch the Day&nbsp;2 Final from your dashboard.</span>
                            </div>
                        )}

                        <form onSubmit={submitCompletion} className="space-y-5">
                            <div className="grid grid-cols-2 gap-5">
                                {!(isPhasedDay1Flight && outcome === "advanced") && (
                                    <>
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
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Cash Won ({tournament?.currency || "USD"})</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-white placeholder-slate-600"
                                                placeholder="0.00"
                                                value={formData.cashWon}
                                                onChange={(e) => setFormData({ ...formData, cashWon: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}
                                <div className={`space-y-1.5 ${isPhasedDay1Flight && outcome === "advanced" ? "col-span-2" : ""}`}>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Bounties ({tournament?.currency || "USD"})</label>
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
                            <div className="col-span-2 space-y-1.5">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Session Review / Notes</label>
                                <textarea
                                    rows={3}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-600 resize-none"
                                    placeholder="What busted you? Key hands, mistakes, reads, anything to review later…"
                                    value={formData.review}
                                    onChange={(e) => setFormData({ ...formData, review: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className={`w-full text-white font-medium py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 mt-2 disabled:opacity-50 ${isPhasedDay1Flight && outcome === "advanced" ? "bg-amber-600 hover:bg-amber-500 hover:shadow-[0_0_20px_rgba(217,119,6,0.4)]" : "bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]"}`}
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : isPhasedDay1Flight && outcome === "advanced" ? "Bag & Advance to Day 2" : "Save Results"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}