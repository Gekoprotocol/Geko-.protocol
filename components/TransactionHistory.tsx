import React, { useState, useEffect } from 'react';
import { WalletData } from '../types';
import { Clock, CheckCircle, ArrowRightLeft, Zap, Shield, ChevronDown, X, RefreshCw } from 'lucide-react';

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
    entry_price?: number;
    settlement_price?: number;
    options_duration?: string;
    direction?: 'Long' | 'Short';
    fees?: number;
}

interface TransactionHistoryProps {
    wallet: WalletData;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ wallet }) => {
    const [txs, setTxs] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrade, setSelectedTrade] = useState<Transaction | null>(null);

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
                    <div 
                        key={tx.id} 
                        className={`bg-[#111111] border border-white/5 p-5 rounded-[24px] flex items-center justify-between group transition-all ${tx.type === 'trade' ? 'hover:bg-[#1A1A1A] cursor-pointer' : ''}`}
                        onClick={() => tx.type === 'trade' && setSelectedTrade(tx)}
                    >
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
                            {tx.type === 'trade' && tx.amount && (
                                <div className={`text-xs font-black uppercase tracking-wider ${parseFloat(tx.amount as string) >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                    {parseFloat(tx.amount as string) >= 0 ? '+' : ''}{tx.amount} PnL
                                </div>
                            )}
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

            {selectedTrade && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#111111] border border-white/10 rounded-[32px] p-8 w-full max-w-sm text-white">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold uppercase tracking-tight">{selectedTrade.asset_symbol}</h3>
                            <button onClick={() => setSelectedTrade(null)} className="text-gray-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="text-center mb-8">
                            <div className="text-4xl font-black text-[#10B981] mb-1">
                                {parseFloat(selectedTrade.amount as string) >= 0 ? '+' : ''}{parseFloat(selectedTrade.amount as string).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-sm text-gray-500 font-bold uppercase tracking-widest">Settled</div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 uppercase font-bold tracking-widest">Time</span>
                                <span className="font-bold">{new Date(selectedTrade.created_at).toLocaleString()}</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => setSelectedTrade(null)}
                            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionHistory;
