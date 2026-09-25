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
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Node Ledger <span className="text-xs text-red-500">(DEBUG: V2)</span></h2>
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
                        className="bg-[#111111] border border-white/5 p-5 rounded-[24px] flex flex-col gap-3"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-black border border-white/5 rounded-2xl flex items-center justify-center">
                                    {getIcon(tx.type)}
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-white uppercase tracking-tight">
                                        {tx.type === 'deposit' ? 'Funded' : (tx.type === 'swap' ? 'Swap' : (tx.type === 'trade' ? 'Trade' : tx.type))}
                                    </div>
                                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                        {new Date(tx.created_at).toLocaleString()}
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

                        {tx.type === 'trade' && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                {tx.entry_price && <div>Entry: <span className="text-white">{tx.entry_price.toLocaleString()}</span></div>}
                                {tx.settlement_price && <div>Settled: <span className="text-white">{tx.settlement_price.toLocaleString()}</span></div>}
                                {tx.options_duration && <div>Duration: <span className="text-white">{tx.options_duration}</span></div>}
                                {tx.direction && <div>Direction: <span className={tx.direction === 'Long' ? 'text-[#10B981]' : 'text-rose-500'}>{tx.direction}</span></div>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TransactionHistory;
