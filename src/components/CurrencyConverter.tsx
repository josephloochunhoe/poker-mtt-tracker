"use client";
import { useEffect, useState, useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface RatesPayload {
  rates: Record<string, number>;
  base: string;
  cachedAt: string;
}

export default function CurrencyConverter() {
  const [payload, setPayload] = useState<RatesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("MYR");

  useEffect(() => {
    fetch("/api/currency-rates")
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setPayload(data);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const currencies = useMemo(() => {
    if (!payload) return [];
    const all = Object.keys(payload.rates);
    return all.filter(c => c !== "MYR" && c !== payload.base).sort();
  }, [payload]);

  const result = useMemo(() => {
    if (!payload) return null;
    const num = parseFloat(amount);
    if (isNaN(num) || num < 0) return null;

    const rates = payload.rates;
    const base = payload.base;

    // Convert: amount in `from` → base → `to`
    const toBase = from === base ? num : num / (rates[from] ?? 1);
    const converted = to === base ? toBase : toBase * (rates[to] ?? 1);
    return converted.toFixed(2);
  }, [payload, amount, from, to]);

  const selectClass = "bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-slate-400">Loading exchange rates…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-6 text-rose-300 text-sm">
        Failed to load rates: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Converter card */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {/* Amount */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          {/* From */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">From</label>
            <select value={from} onChange={e => setFrom(e.target.value)} className={selectClass}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* To */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">To</label>
            <div className={selectClass}>MYR</div>
          </div>
        </div>

        {/* Result */}
        <div className="bg-slate-800/60 rounded-xl p-5 text-center">
          <p className="text-slate-500 text-sm mb-1">
            {amount || "0"} {from} =
          </p>
          <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            {result ?? "—"} <span className="text-2xl">{to}</span>
          </p>
          {payload && (
            <p className="text-slate-600 text-xs mt-3">
              1 {from} = {
                (() => {
                  const rates = payload.rates;
                  const base = payload.base;
                  const toBase = from === base ? 1 : 1 / (rates[from] ?? 1);
                  const val = to === base ? toBase : toBase * (rates[to] ?? 1);
                  return val.toFixed(6);
                })()
              } {to}
            </p>
          )}
        </div>
      </div>

      {/* Cache info */}
      {payload && (
        <div className="flex items-center gap-2 text-slate-600 text-xs">
          <RefreshCw size={12} />
          Rates cached at {new Date(payload.cachedAt).toLocaleString()} · Base: {payload.base} · Refreshes every 12 hours
        </div>
      )}
    </div>
  );
}
