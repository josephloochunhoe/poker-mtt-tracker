"use client";
import { useEffect, useState } from "react";
import LiveTournament, { Tournament, Session, Day2Prefill } from "@/components/LiveTournament";
import SessionHistory from "@/components/SessionHistory";
import LiveCashSession, { CashSession } from "@/components/LiveCashSession";
import CashHistoryTable from "@/components/CashHistoryTable";
import WalletTab, { ExternalTransaction } from "@/components/WalletTab";
import { Clock, DollarSign, Target, Activity, Loader2, Trophy, ArrowRight, Layers, PlusCircle, Square } from "lucide-react";
import { defaultSessionName, getMttMetrics, calcMergedHours } from "@/lib/analytics";
import { formatSessionStart } from "@/lib/time";
import { useMYRRate } from "@/hooks/useMYRRate";

type Tab = "MTT" | "HomeGame" | "CashGame" | "Wallet";

export default function Dashboard() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [cashRecords, setCashRecords] = useState<CashSession[]>([]);
    const [walletTxs, setWalletTxs] = useState<ExternalTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("MTT");
    const [day2Prefill, setDay2Prefill] = useState<Day2Prefill | null>(null);
    const [isMutatingSession, setIsMutatingSession] = useState(false);

    const fetchAll = async () => {
        try {
            const [sessionRes, tourRes, walletRes] = await Promise.all([
                fetch("/api/sessions"),
                fetch("/api/tournaments"),
                fetch("/api/wallet"),
            ]);
            const sessionData = await sessionRes.json();
            const tourData = await tourRes.json();
            const walletData = await walletRes.json();
            if (sessionData.sessions) setSessions(sessionData.sessions);
            // /api/tournaments now returns only cash/home records (sessions & wallet excluded server-side).
            if (tourData.tournaments) {
                setCashRecords(
                    tourData.tournaments.filter(
                        (r: CashSession) => r.gameCategory === "HomeGame" || r.gameCategory === "CashGame"
                    )
                );
            }
            if (walletData.transactions) setWalletTxs(walletData.transactions);
        } catch (err) {
            console.error("Failed to fetch", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const homeGames = cashRecords.filter(s => s.gameCategory === "HomeGame");
    const cashGames = cashRecords.filter(s => s.gameCategory === "CashGame");

    // All MTT tournaments live inside sessions; flatten for analytics & cross-references.
    const mttTournaments = sessions.flatMap(s => s.tournaments);
    const completedMTT = mttTournaments.filter(t => t.status === "Completed");

    // MTT metrics (shared helper so overall === sum of every session)
    const mtt = getMttMetrics(completedMTT);

    // Cash/Home metrics — use interval merging to avoid double-counting overlapping sessions
    const cashMetrics = (gameSessions: CashSession[]) => {
        const completed = gameSessions.filter(s => s.status === "Completed");
        let invested = 0, cashOut = 0;
        const intervals: { start: number; end: number }[] = [];
        completed.forEach(s => {
            const inv = s.bullets.reduce((sum, b) => sum + b.cost, 0);
            invested += inv;
            cashOut += s.cashOut || 0;
            const first = new Date(s.bullets[0].registeredAt).getTime();
            const last = s.bullets[s.bullets.length - 1];
            if (last.bustedAt) intervals.push({ start: first, end: new Date(last.bustedAt).getTime() });
        });
        const hours = calcMergedHours(intervals);
        const profit = cashOut - invested;
        return { profit, hours, hourly: hours > 0 ? profit / hours : 0, sessions: completed.length };
    };

    const homeMetrics = cashMetrics(homeGames);
    const cashMetricsData = cashMetrics(cashGames);

    const myrRate = useMYRRate();

    // Wallet net investment
    const walletDeposits = walletTxs.filter(t => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
    const walletWithdrawals = walletTxs.filter(t => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);
    const netInvestment = walletDeposits - walletWithdrawals;

    // Current Bankroll = (Session Cashouts - Session Buyins) + (Total Deposits - Total Withdrawals)
    const mttProfitMYR = myrRate != null ? mtt.profit * myrRate : null;
    const sessionProfit = mttProfitMYR != null
        ? mttProfitMYR + homeMetrics.profit + cashMetricsData.profit
        : null;
    const currentBankroll = sessionProfit != null ? sessionProfit + netInvestment : null;

    // Active session (at most one at a time) and the tournaments running inside it.
    const activeSession = sessions.find(s => s.status === "Active") || null;
    const activeTournaments = activeSession ? activeSession.tournaments.filter(t => t.status === "Active") : [];
    const completedInSession = activeSession ? activeSession.tournaments.filter(t => t.status === "Completed") : [];
    const completedSessions = sessions.filter(s => s.status === "Completed");

    const activeHomeGames = homeGames.filter(s => s.status === "Active");
    const activeCashGames = cashGames.filter(s => s.status === "Active");

    // Phased events: advanced Day 1 flights that have qualified for a Day 2 Final.
    const launchedDay2ParentIds = new Set<string | undefined>([
        ...mttTournaments.filter(t => t.parentTournamentId).map(t => t.parentTournamentId),
        ...mttTournaments.flatMap(t => t.additionalParentIds || []),
    ]);
    const advancedDay1s = mttTournaments.filter(
        t => t.isPhased && t.phasedStage === "Day 1" && t.flightStatus === "Advanced"
    );
    const activeDay2s = activeTournaments.filter(t => t.isPhased && t.phasedStage === "Day 2");

    /** Find an already-active Day 2 that belongs to the same tournament series as a Day 1 flight. */
    const findMatchingActiveDay2 = (d1: Tournament): Tournament | undefined => {
        const baseName = (d1.sessionName || defaultSessionName(d1.type, d1.speed))
            .replace(/\s*[-–]\s*(Day\s*1\w*|Flight\s*\w+)\s*$/i, "").trim();
        const expectedDay2Name = `${baseName} - Day 2 Final`;
        return activeDay2s.find(d2 => d2.sessionName === expectedDay2Name);
    };

    const startSession = async () => {
        setIsMutatingSession(true);
        try {
            await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
            await fetchAll();
        } catch (err) {
            console.error("Failed to start session", err);
        } finally {
            setIsMutatingSession(false);
        }
    };

    const endSession = async () => {
        if (!activeSession) return;
        setIsMutatingSession(true);
        try {
            await fetch("/api/sessions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "END_SESSION", sessionId: activeSession.id }),
            });
            await fetchAll();
        } catch (err) {
            console.error("Failed to end session", err);
        } finally {
            setIsMutatingSession(false);
        }
    };

    const linkToActiveDay2 = async (day1: Tournament, day2: Tournament) => {
        if (!activeSession) return;
        await fetch("/api/sessions", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "LINK_FLIGHT", sessionId: activeSession.id, day2Id: day2.id, day1Id: day1.id }),
        });
        fetchAll();
    };

    const launchDay2 = (day1: Tournament) => {
        const baseName = day1.sessionName || defaultSessionName(day1.type, day1.speed);
        // Strip any trailing "Day 1" / "Flight" qualifier so the Day 2 label reads cleanly.
        const parentLabel = baseName.replace(/\s*[-–]\s*(Day\s*1\w*|Flight\s*\w+)\s*$/i, "").trim() || baseName;
        setDay2Prefill({
            sessionName: `${parentLabel} - Day 2 Final`,
            type: day1.type,
            speed: day1.speed,
            currency: day1.currency || "USD",
            parentTournamentId: day1.id,
        });
        setActiveTab("MTT");
        if (typeof window !== "undefined") {
            setTimeout(() => {
                document.getElementById("tournament-launcher")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 50);
        }
    };

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
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-5 py-3 text-right">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Current Bankroll</p>
                    {currentBankroll != null ? (
                        <p className={`text-2xl font-black tracking-tight ${currentBankroll >= 0 ? "text-green-400" : "text-rose-400"}`}>
                            {currentBankroll >= 0 ? "+" : ""}RM {currentBankroll.toFixed(2)}
                        </p>
                    ) : (
                        <p className="text-2xl font-black tracking-tight text-slate-500 flex items-center justify-end gap-2">
                            <Loader2 size={18} className="animate-spin" /> RM —
                        </p>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-1.5 w-fit flex-wrap">
                {(["MTT", "HomeGame", "CashGame", "Wallet"] as Tab[]).map(tab => {
                    const labels: Record<Tab, string> = { MTT: "MTT", HomeGame: "Home Games", CashGame: "Cash Games", Wallet: "Wallet" };
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
                        <MetricCard title="Net Profit" value={`$${mtt.profit.toFixed(2)}`} subValue={myrRate != null ? `(RM ${(mtt.profit * myrRate).toFixed(2)})` : undefined} icon={<DollarSign size={20} className={mtt.profit >= 0 ? "text-green-400" : "text-rose-400"} />} trend={mtt.profit >= 0 ? "positive" : "negative"} />
                        <MetricCard title="Avg Buy-In (ABI)" value={`$${mtt.abi.toFixed(2)}`} subValue={myrRate != null ? `(RM ${(mtt.abi * myrRate).toFixed(2)})` : undefined} icon={<Target size={20} className="text-blue-400" />} trend="neutral" />
                        <MetricCard title="Hourly Rate" value={`$${mtt.hourly.toFixed(2)}/hr`} subValue={myrRate != null ? `(RM ${(mtt.hourly * myrRate).toFixed(2)}/hr)` : undefined} icon={<Activity size={20} className={mtt.hourly >= 0 ? "text-green-400" : "text-rose-400"} />} trend={mtt.hourly >= 0 ? "positive" : "negative"} />
                        <MetricCard title="Hours Played" value={fmtHours(mtt.hours)} icon={<Clock size={20} className="text-blue-400" />} trend="neutral" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold tracking-tight text-white">Active Session</h3>
                                {activeSession && (
                                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                        {activeTournaments.length} Running
                                    </span>
                                )}
                            </div>

                            {!activeSession ? (
                                <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-8 text-center space-y-4">
                                    <div className="w-12 h-12 mx-auto rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <PlusCircle className="text-blue-400" size={26} />
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold">No active session</p>
                                        <p className="text-slate-500 text-sm mt-1">Start a session, then add the tournaments you play this sitting.</p>
                                    </div>
                                    <button
                                        onClick={startSession}
                                        disabled={isMutatingSession}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                                    >
                                        {isMutatingSession ? <Loader2 className="animate-spin" size={18} /> : <PlusCircle size={18} />}
                                        Start Session
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Active session banner */}
                                    <div className="bg-blue-500/[0.06] border border-blue-500/25 rounded-2xl p-4 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white">{activeSession.name ?? `Session #${activeSession.sessionNumber ?? "?"}`}</p>
                                            <p className="text-xs text-slate-400">Started {formatSessionStart(activeSession.startedAt)}</p>
                                        </div>
                                        <button
                                            onClick={endSession}
                                            disabled={isMutatingSession || activeTournaments.length > 0}
                                            title={activeTournaments.length > 0 ? "Finish all running tournaments first" : "End this session and move it to history"}
                                            className="shrink-0 flex items-center gap-2 bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white text-sm font-semibold px-3 py-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800 disabled:hover:text-slate-200"
                                        >
                                            {isMutatingSession ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                                            End Session
                                        </button>
                                    </div>

                                    {/* Running tournaments */}
                                    {activeTournaments.map(t => (
                                        <LiveTournament key={t.id} sessionId={activeSession.id} initialTournament={t} onCompleted={fetchAll} />
                                    ))}

                                    {/* Completed-this-session summary */}
                                    {completedInSession.length > 0 && (
                                        <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4 space-y-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Completed this session ({completedInSession.length})</p>
                                            {completedInSession.map(t => {
                                                const inv = t.bullets.reduce((s, b) => s + b.cost, 0);
                                                const cashed = (t.cashWon || 0) + (t.bountiesWon || 0);
                                                const profit = cashed - inv;
                                                const sym = t.currency === "MYR" ? "RM " : "$";
                                                return (
                                                    <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                                                        <span className="text-slate-300 truncate">{t.sessionName || t.type}</span>
                                                        <span className={`font-semibold tabular-nums shrink-0 ${profit > 0 ? "text-green-400" : profit < 0 ? "text-rose-400" : "text-slate-400"}`}>
                                                            {profit > 0 ? "+" : ""}{sym}{profit.toFixed(2)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Advanced Day 1s — qualifying flights awaiting their Day 2 Final */}
                                    {advancedDay1s.length > 0 && (
                                        <div className="bg-amber-500/[0.04] border border-amber-500/20 rounded-2xl p-5 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Trophy size={16} className="text-amber-400" />
                                                <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wider">Advanced Day 1s</h4>
                                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-xs font-semibold ml-auto">
                                                    {advancedDay1s.length}
                                                </span>
                                            </div>
                                            {advancedDay1s.map(d1 => {
                                                const launched = launchedDay2ParentIds.has(d1.id);
                                                const sym = d1.currency === "MYR" ? "RM " : "$";
                                                return (
                                                    <div key={d1.id} className="flex items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-white truncate">{d1.sessionName || d1.type}</p>
                                                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                                <Layers size={11} /> {d1.type}
                                                                {(d1.bountiesWon || 0) > 0 && <span className="text-amber-400/80">· {sym}{(d1.bountiesWon || 0).toFixed(2)} bounties</span>}
                                                            </p>
                                                        </div>
                                                        {launched ? (
                                                            <span className="shrink-0 text-xs font-semibold text-slate-400 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
                                                                Day 2 Launched
                                                            </span>
                                                        ) : (() => {
                                                            const matchingDay2 = findMatchingActiveDay2(d1);
                                                            return matchingDay2 ? (
                                                                <button
                                                                    onClick={() => linkToActiveDay2(d1, matchingDay2)}
                                                                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-all hover:shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                                                                >
                                                                    Link to Active Day 2 <ArrowRight size={13} />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => launchDay2(d1)}
                                                                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-all hover:shadow-[0_0_15px_rgba(217,119,6,0.4)]"
                                                                >
                                                                    Launch Day 2 Final <ArrowRight size={13} />
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Add-tournament launcher (adds into the active session) */}
                                    <div id="tournament-launcher" className="border-t border-slate-800/80 pt-6">
                                        <LiveTournament
                                            key={day2Prefill ? `launcher-day2-${day2Prefill.parentTournamentId}` : "launcher"}
                                            sessionId={activeSession.id}
                                            prefill={day2Prefill || undefined}
                                            onCancelPrefill={() => setDay2Prefill(null)}
                                            onCompleted={fetchAll}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="lg:col-span-2">
                            <SessionHistory sessions={completedSessions} allTournaments={mttTournaments} onChange={fetchAll} />
                        </div>
                    </div>
                </>
            )}

            {/* Home Games Tab */}
            {activeTab === "HomeGame" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard title="Net Profit" value={`RM ${homeMetrics.profit.toFixed(2)}`} icon={<DollarSign size={20} className={homeMetrics.profit >= 0 ? "text-green-400" : "text-rose-400"} />} trend={homeMetrics.profit >= 0 ? "positive" : "negative"} accent="purple" />
                        <MetricCard title="Hourly Rate" value={`RM ${homeMetrics.hourly.toFixed(2)}/hr`} icon={<Activity size={20} className={homeMetrics.hourly >= 0 ? "text-green-400" : "text-rose-400"} />} trend={homeMetrics.hourly >= 0 ? "positive" : "negative"} accent="purple" />
                        <MetricCard title="Hours Played" value={fmtHours(homeMetrics.hours)} icon={<Clock size={20} className="text-purple-400" />} trend="neutral" accent="purple" />
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

            {/* Wallet Tab */}
            {activeTab === "Wallet" && (
                <WalletTab transactions={walletTxs} onRefresh={fetchAll} />
            )}

            {/* Cash Games Tab */}
            {activeTab === "CashGame" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard title="Net Profit" value={`RM ${cashMetricsData.profit.toFixed(2)}`} icon={<DollarSign size={20} className={cashMetricsData.profit >= 0 ? "text-green-400" : "text-rose-400"} />} trend={cashMetricsData.profit >= 0 ? "positive" : "negative"} accent="emerald" />
                        <MetricCard title="Hourly Rate" value={`RM ${cashMetricsData.hourly.toFixed(2)}/hr`} icon={<Activity size={20} className={cashMetricsData.hourly >= 0 ? "text-green-400" : "text-rose-400"} />} trend={cashMetricsData.hourly >= 0 ? "positive" : "negative"} accent="emerald" />
                        <MetricCard title="Hours Played" value={fmtHours(cashMetricsData.hours)} icon={<Clock size={20} className="text-emerald-400" />} trend="neutral" accent="emerald" />
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

function fmtHours(h: number): string {
    const totalMins = Math.round(h * 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
}

function MetricCard({ title, value, subValue, icon, trend, accent = "blue" }: {
    title: string;
    value: string;
    subValue?: string;
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
            {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
        </div>
    );
}
