import React, { useState, useMemo, useEffect } from 'react';
import { AssetInfo, WalletData } from '../types';
import { ArrowLeftRight, ChevronDown, Shield, RefreshCw } from 'lucide-react';

interface SwapViewProps {
  assets: AssetInfo[];
  isConnected: boolean;
  wallet?: (WalletData & { pending_deposit_currency?: string, pending_deposit_amount?: number }) | null;
  onConnect: () => void;
  onSignUp: () => void;
  onSwap: (from: string, to: string, amount: string) => void;
  onDeposit: (amount: string, asset: string) => void;
  onRefreshBalances?: () => void;
  depositAddress?: string;
  protocolConfig?: any;
  protocolBalances?: { asset: string, balance: number, valueUsd?: string }[];
}

const SwapView: React.FC<SwapViewProps> = ({ 
  assets, 
  isConnected, 
  wallet, 
  onConnect, 
  onSignUp, 
  onSwap, 
  onDeposit, 
  onRefreshBalances, 
  depositAddress, 
  protocolConfig,
  protocolBalances = []
}) => {
  const [fromAsset, setFromAsset] = useState<AssetInfo | null>(assets.find(a => a.symbol === 'BTC') || assets[0] || null);
  const [toAsset, setToAsset] = useState<AssetInfo | null>(assets.find(a => a.symbol === 'SOL') || assets[1] || null);
  const [amount, setAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    if (assets.length >= 2) {
      if (!fromAsset) setFromAsset(assets.find(a => a.symbol === 'BTC') || assets[0]);
      if (!toAsset) setToAsset(assets.find(a => a.symbol === 'SOL') || assets[1]);
    }
  }, [assets]);

  const targetAmount = useMemo(() => {
    if (!amount || !fromAsset || !toAsset) return '0.00';
    return (parseFloat(amount) * (fromAsset.price / toAsset.price)).toFixed(4);
  }, [amount, fromAsset, toAsset]);

  return (
    <div className="h-full bg-black flex flex-col font-sans">
      <div className="flex-1 w-full max-w-md mx-auto p-6 flex flex-col justify-center space-y-8">
        
        <div className="text-center space-y-2">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Quick Swap</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Zero-Fee Internal Exchange</p>
        </div>

        <div className="bg-[#111111] border border-white/5 rounded-[40px] p-6 space-y-4 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-10 group-hover:opacity-30 transition-opacity"></div>
            
            {/* Pay Section */}
            <div className="bg-black border border-white/5 p-6 rounded-[32px] space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">
                    <span>You Pay</span>
                    <span>Balance: 0.00</span>
                </div>
                <div className="flex items-center justify-between">
                    <input 
                        type="text" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="0.00" 
                        className="bg-transparent text-3xl font-bold text-white outline-none w-1/2" 
                    />
                    <div className="bg-[#1A1A1A] border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2">
                        {fromAsset?.symbol === 'BTC' ? <div className="w-5 h-5 bg-[#F7931A] rounded-full flex items-center justify-center text-[10px] font-bold">B</div> : <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold">{fromAsset?.symbol[0]}</div>}
                        <span className="text-sm font-bold text-white">{fromAsset?.symbol || 'BTC'}</span>
                    </div>
                </div>
            </div>

            {/* Switch Icon */}
            <div className="flex justify-center -my-6 relative z-10">
                <button 
                    onClick={() => { const t = fromAsset; setFromAsset(toAsset); setToAsset(t); }}
                    className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-xl border-4 border-black hover:scale-110 transition-transform cursor-pointer"
                >
                    <ArrowLeftRight size={20} className="rotate-90" />
                </button>
            </div>

            {/* Receive Section */}
            <div className="bg-black border border-white/5 p-6 rounded-[32px] space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">
                    <span>You Receive</span>
                    <span>Est. Value</span>
                </div>
                <div className="flex items-center justify-between">
                    <input type="text" readOnly value={targetAmount} placeholder="0.00" className="bg-transparent text-3xl font-bold text-white outline-none w-1/2" />
                    <div className="bg-[#1A1A1A] border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2">
                        {toAsset?.symbol === 'SOL' ? <div className="w-5 h-5 bg-gradient-to-br from-[#14F195] to-[#9945FF] rounded-full flex items-center justify-center text-[10px] font-bold text-black italic">S</div> : <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center text-[10px] font-bold">{toAsset?.symbol[0]}</div>}
                        <span className="text-sm font-bold text-white">{toAsset?.symbol || 'SOL'}</span>
                    </div>
                </div>
            </div>
        </div>

        <button 
            disabled={!isConnected || isSwapping}
            onClick={() => setIsSwapping(true)}
            className="w-full py-6 bg-white text-black font-black uppercase italic tracking-[0.2em] rounded-[32px] shadow-2xl hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3"
        >
            {isSwapping ? <RefreshCw size={20} className="animate-spin" /> : (isConnected ? 'Execute Exchange' : 'Connect to Swap')}
        </button>

        <div className="flex items-center justify-center space-x-2 opacity-50">
            <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
            <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Slippage Tolerance: 0.1%</span>
        </div>

      </div>
    </div>
  );
};

export default SwapView;
