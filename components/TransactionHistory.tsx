import React, { useState, useEffect } from 'react';
import { WalletData } from '../types';
import { Clock, ArrowRightLeft, Zap, Shield, X, RefreshCw } from 'lucide-react';

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
    direction?: string;
    fees?: number;
    trade_id?: string;
    trade_amount?: number | string;
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
                {txs.map((tx) => {
                    const isTrade = tx.type === 'trade';
                    const numAmt = parseFloat(tx.amount as string || '0');
                    const isPositive = numAmt >= 0;

                    return (
                        <div 
                            key={tx.id} 
                            onClick={() => {
                                if (isTrade) setSelectedTrade(tx);
                            }}
                            className={`bg-[#111111] border border-white/5 p-5 rounded-[24px] flex flex-col gap-3 transition-colors ${isTrade ? 'cursor-pointer hover:bg-[#1A1A1A]' : ''}`}
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
                                    {isTrade && tx.amount !== undefined && (
                                        <div className={`text-xs font-black uppercase tracking-wider ${isPositive ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                            {isPositive ? '+' : ''}{numAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                        </div>
                                    )}
                                    <div className="text-[10px] text-gray-500 font-black uppercase">{tx.asset_symbol}</div>
                                </div>
                            </div>

                            {isTrade && (
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                    {tx.entry_price !== undefined && tx.entry_price !== null && (
                                        <div>Entry: <span className="text-white">${parseFloat(tx.entry_price as any || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                    )}
                                    {tx.settlement_price !== undefined && tx.settlement_price !== null && (
                                        <div>Closing: <span className="text-white">${parseFloat(tx.settlement_price as any || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                    )}
                                    {tx.direction && (
                                        <div>Direction: <span className={tx.direction.toString().toUpperCase().includes('LONG') ? 'text-[#10B981]' : 'text-rose-500'}>{tx.direction.toUpperCase()}</span></div>
                                    )}
                                    {tx.options_duration && (
                                        <div>Duration: <span className="text-white">{tx.options_duration}</span></div>
                                    )}
                                    {tx.fees !== undefined && tx.fees !== null && (
                                        <div>Fees: <span className="text-white">{parseFloat(tx.fees as any || 0).toFixed(2)} USDT</span></div>
                                    )}
                                    <div>Pair: <span className="text-white">{tx.asset_symbol}</span></div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {txs.length === 0 && !loading && (
                    <div className="text-center py-20 opacity-20 border border-white/5 rounded-[40px] border-dashed">
                        <Clock size={40} className="mx-auto mb-2" />
                        <span className="text-[9px] font-black uppercase tracking-[0.3em]">Institutional Records Clear</span>
                    </div>
                )}
            </div>

            {/* Trade Details Modal */}
            {selectedTrade && (
                <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-[#111111] border border-white/10 rounded-[32px] p-8 w-full max-w-sm text-white">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold uppercase tracking-tight">{selectedTrade.asset_symbol || 'Trade'}</h3>
                            <button onClick={() => setSelectedTrade(null)} className="text-gray-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="text-center mb-8">
                            <div className={`text-3xl font-black mb-1 ${parseFloat(selectedTrade.amount as string || '0') >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                {selectedTrade.amount !== undefined ? (parseFloat(selectedTrade.amount as string || '0') >= 0 ? '+' : '') + parseFloat(selectedTrade.amount as string || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'} USDT
                            </div>
                            <div className={`text-[10px] font-bold uppercase tracking-widest ${parseFloat(selectedTrade.amount as string || '0') >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                {parseFloat(selectedTrade.amount as string || '0') >= 0 ? 'Profit (Win)' : 'Loss'}
                            </div>
                        </div>

                        <div className="space-y-4 mb-8 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 uppercase font-bold tracking-widest">Pair</span>
                                <span className="font-bold text-white">{selectedTrade.asset_symbol}</span>
                            </div>

                            {selectedTrade.direction && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 uppercase font-bold tracking-widest">Direction</span>
                                    <span className={`font-bold ${selectedTrade.direction.toString().toUpperCase().includes('LONG') ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                        {selectedTrade.direction.toUpperCase()}
                                    </span>
                                </div>
                            )}

                            {selectedTrade.entry_price !== undefined && selectedTrade.entry_price !== null && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 uppercase font-bold tracking-widest">Entry Price</span>
                                    <span className="font-bold text-white">${parseFloat(selectedTrade.entry_price as any || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {selectedTrade.settlement_price !== undefined && selectedTrade.settlement_price !== null && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 uppercase font-bold tracking-widest">Closing Price</span>
                                    <span className="font-bold text-white">${parseFloat(selectedTrade.settlement_price as any || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {selectedTrade.options_duration && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 uppercase font-bold tracking-widest">Duration</span>
                                    <span className="font-bold text-white">{selectedTrade.options_duration}</span>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <span className="text-gray-500 uppercase font-bold tracking-widest">Fees</span>
                                <span className="font-bold text-white">{parseFloat(selectedTrade.fees as any || 0).toFixed(2)} USDT</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500 uppercase font-bold tracking-widest">Time</span>
                                <span className="font-bold text-white">{selectedTrade.created_at ? new Date(selectedTrade.created_at).toLocaleString() : 'N/A'}</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => setSelectedTrade(null)} 
                            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200"
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
