import React, { useState, useEffect } from 'react';
import { WalletData } from '../types';
import { Clock, CheckCircle, ArrowRightLeft, Zap, Shield, ChevronDown } from 'lucide-react';

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
        if (!wallet?.address) return;
        try {
            const res = await fetch(`/api/user/transactions?address=${wallet.address}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.transactions) setTxs(data.transactions);
                else if (Array.isArray(data)) setTxs(data);
            }
        } catch (e) {
            console.error('Failed to fetch history', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!wallet?.address) return;
        fetchHistory();
        const int = setInterval(fetchHistory, 10000);
        return () => clearInterval(int);
    }, [wallet?.address]);

    const getIcon = (type: string) => {
        if (type === 'deposit') return <Zap size={14} className="text-emerald-500" />;
        if (type === 'swap') return <ArrowRightLeft size={14} className="text-indigo-400" />;
        if (type === 'trade') return <Clock size={14} className="text-amber-500" />;
        return <Shield size={14} className="text-gray-400" />;
    };

    return (
        <div className="h-full bg-black flex flex-col font-sans">
            <div className="p-6 flex justify-between items-center shrink-0 pt-12">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Node Ledger</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Institutional Record Stream</p>
                </div>
                <button 
                    onClick={fetchHistory}
                    className="p-3 bg-[#111111] border border-white/5 rounded-2xl text-gray-500 hover:text-white transition-all"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-3 pb-32">
                {txs.map((tx) => (
                    <div key={tx.id} className="bg-[#111111] border border-white/5 p-5 rounded-[24px] flex items-center justify-between group hover:bg-[#1A1A1A] transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-black border border-white/5 rounded-2xl flex items-center justify-center">
                                {getIcon(tx.type)}
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white uppercase tracking-tight">
                                    {tx.type === 'deposit' ? 'Funded' : (tx.type === 'swap' ? 'Swap' : (tx.type === 'trade' ? 'Trade' : tx.type))}
                                </div>
                                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                    {new Date(tx.created_at).toLocaleDateString()} · {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-sm font-bold tabular-nums ${parseFloat(tx.amount as string) >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                {parseFloat(tx.amount as string) >= 0 ? '+' : ''}{parseFloat(tx.amount as string).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-gray-500 font-black uppercase">{tx.asset_symbol}</div>
                        </div>
                    </div>
                ))}

                {!loading && txs.length === 0 && (
                    <div className="py-32 text-center space-y-4 opacity-20">
                        <Shield size={64} className="mx-auto" />
                        <div className="space-y-1">
                            <div className="text-[11px] text-white font-black uppercase tracking-[0.4em]">Ledger Clear</div>
                            <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">No institutional records found</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

function RefreshCw({ size, className }: any) {
    return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.27L21 8"/><path d="M21 3v5h-5"/></svg>;
}

export default TransactionHistory;
