
import React, { useState, useEffect } from 'react';
import { WalletData } from '../types';

interface Transaction {
    id: string | number;
    wallet_address: string;
    asset_symbol: string;
    amount: string | number;
    type: string;
    status: string;
    created_at: string;
    reference?: string;
    tx_signature?: string;
}

interface TransactionHistoryProps {
    wallet: WalletData;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ wallet }) => {
    const [txs, setTxs] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        if (!wallet.address) return;
        try {
            const res = await fetch(`/api/user/transactions?address=${wallet.address}`);
            if (res.ok) {
                setTxs(await res.json());
            }
        } catch (e) {
            console.error('Failed to fetch history', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const int = setInterval(fetchHistory, 30000);
        return () => clearInterval(int);
    }, [wallet.address]);

    return (
        <div className="flex-1 flex flex-col p-8 space-y-6 overflow-hidden">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black italic uppercase text-indigo-400 tracking-tight">Ledger_Archive</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Full Transaction History</p>
                </div>
                <button 
                    onClick={fetchHistory}
                    className="px-4 py-2 bg-[#1E2329] border border-[#2B3139] rounded-xl text-[10px] font-black uppercase text-gray-400 hover:text-white transition-all"
                >
                    Refresh Ledger
                </button>
            </div>

            <div className="flex-1 bg-[#181C25] border border-[#2B3139] rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-[#0B0E11] text-[9px] text-gray-500 uppercase font-black border-b border-[#2B3139] z-10">
                            <tr>
                                <th className="px-8 py-4">Timestamp</th>
                                <th className="px-8 py-4">Type</th>
                                <th className="px-8 py-4">Asset</th>
                                <th className="px-8 py-4">Amount</th>
                                <th className="px-8 py-4">Status</th>
                                <th className="px-8 py-4 text-right">Reference</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2B3139]">
                            {txs.map((tx) => (
                                <tr key={tx.id} className="hover:bg-[#1E2329] transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="text-[10px] font-mono text-gray-400">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${
                                            tx.type === 'deposit' || tx.type === 'credit' ? 'bg-emerald-900/20 text-emerald-500' : 
                                            tx.type === 'withdrawal' ? 'bg-amber-900/20 text-amber-500' : 'bg-indigo-900/20 text-indigo-500'
                                        }`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-xs font-bold text-gray-300">
                                        {tx.asset_symbol}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className={`text-sm font-black font-mono ${
                                            parseFloat(tx.amount as string) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                            {parseFloat(tx.amount as string).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-[9px] font-bold text-gray-500 uppercase">
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="text-[8px] font-mono text-gray-600 truncate max-w-[150px] ml-auto">
                                            {tx.tx_signature || tx.reference || '-'}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && txs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-32 text-center">
                                        <div className="space-y-2">
                                            <div className="text-[11px] text-gray-600 font-black uppercase tracking-[0.4em]">No Records Found</div>
                                            <p className="text-[9px] text-gray-700 uppercase tracking-widest font-bold">Protocol Ledger is currently empty</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TransactionHistory;
