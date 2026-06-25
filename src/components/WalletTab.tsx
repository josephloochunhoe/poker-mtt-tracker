"use client";
import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, DollarSign, X, Trash2 } from "lucide-react";
import { nowUTC8 } from "@/lib/time";
import { formatDateFromISO, formatTimeFromISO } from "@/lib/time";

export interface ExternalTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: "deposit" | "withdrawal";
  created_at: string;
  recordType: "wallet";
}

interface Props {
  transactions: ExternalTransaction[];
  onRefresh: () => void;
}

type ModalType = "deposit" | "withdrawal" | null;

export default function WalletTab({ transactions, onRefresh }: Props) {
  const [modal, setModal] = useState<ModalType>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const totalDeposits = transactions
    .filter(t => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = transactions
    .filter(t => t.type === "withdrawal")
    .reduce((sum, t) => sum + t.amount, 0);
  const netInvestment = totalDeposits - totalWithdrawals;

  const openModal = (type: ModalType) => {
    setAmount("");
    setModal(type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return;
    setSubmitting(true);
    try {
      await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, type: modal, created_at: nowUTC8() }),
      });
      setModal(null);
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/wallet?id=${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Metric + Actions row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Net Investment card */}
        <div className={`flex-1 bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden bg-gradient-to-br ${netInvestment >= 0 ? "from-amber-500/5" : "from-rose-500/5"} to-transparent ring-1 ring-white/5`}>
          <div className="flex justify-between items-start mb-4">
            <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Net Investment</p>
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 shadow-inner">
              <DollarSign size={20} className="text-amber-400" />
            </div>
          </div>
          <h4 className={`text-3xl font-black tracking-tight ${netInvestment >= 0 ? "text-amber-400" : "text-rose-400"}`}>
            {netInvestment >= 0 ? "+" : ""}RM {netInvestment.toFixed(2)}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            RM {totalDeposits.toFixed(2)} in · RM {totalWithdrawals.toFixed(2)} out
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex sm:flex-col gap-3 sm:w-48">
          <button
            onClick={() => openModal("deposit")}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl px-5 py-4 transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            <ArrowDownCircle size={20} />
            Deposit
          </button>
          <button
            onClick={() => openModal("withdrawal")}
            className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-2xl px-5 py-4 transition-all hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]"
          >
            <ArrowUpCircle size={20} />
            Withdraw
          </button>
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80">
          <h3 className="text-base font-bold text-white tracking-tight">Transaction History</h3>
        </div>
        {transactions.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-500 text-sm">
            No transactions yet. Add a deposit or withdrawal to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 transition-colors group">
                    <td className="px-5 py-3.5 text-slate-300">
                      <span>{formatDateFromISO(tx.created_at)}</span>
                      <span className="text-slate-500 text-xs ml-2">{formatTimeFromISO(tx.created_at)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        tx.type === "deposit"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {tx.type === "deposit" ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                        {tx.type === "deposit" ? "Deposit" : "Withdrawal"}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 text-right font-semibold tabular-nums ${
                      tx.type === "deposit" ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {tx.type === "deposit" ? "+" : "-"}RM {tx.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {confirmDelete === tx.id ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(tx.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-rose-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setModal(null)} />
          <div className="relative z-10 bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white capitalize">{modal}</h2>
              <button onClick={() => setModal(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Amount (RM)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 text-lg font-semibold"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !amount || parseFloat(amount) <= 0}
                className={`w-full font-semibold rounded-xl py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  modal === "deposit"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-rose-600 hover:bg-rose-500 text-white"
                }`}
              >
                {submitting ? "Saving…" : modal === "deposit" ? "Confirm Deposit" : "Confirm Withdrawal"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
